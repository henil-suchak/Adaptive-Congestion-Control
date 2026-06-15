"""
env_wrapper.py — Fixed Gymnasium Environment Wrapper for ns3-ai TCP RL
=======================================================================
KEY FIXES (macOS Apple Silicon / ARM64):
  1. [DEADLOCK FIX] Shared memory lock is NO LONGER held while waiting
     for action from the RL agent. Lock is acquired, obs read, lock
     released — THEN action is waited for — THEN lock re-acquired to
     write action. This prevents the hang at Step 500.
  2. [EPISODE LENGTH FIX] max_steps default reduced to 2000 for sane
     episode lengths. 5,500,000 steps per episode was causing apparent
     freeze.
  3. [TIMEOUT FIX] Queue timeouts reduced + proper exception handling
     so hangs are detected and reported rather than silently blocking.
  4. [THREAD SAFETY] Stop event checked properly in _ns3_loop.
  5. [RESET FIX] Queues are cleared on reset to avoid stale data from
     previous episode causing immediate deadlock on next episode.
"""

import time
import queue
import threading
import numpy as np
import gymnasium as gym
from gymnasium.spaces import Box
from numpy import inf

import ctypes
from py_interface import Ns3AIRL, Experiment, Reset


# ── Shared memory struct layout (MUST match tcp-rl-env.cc exactly) ──────────
from ctypes import Structure, c_uint32, c_uint8, c_int64, c_double, c_bool, c_uint16

MAX_AGENTS = 10

class TcpRlEnv(Structure):
    """Mirrors sTcpRlEnv in tcp-rl-env.h — byte-for-byte match required."""
    _pack_ = 1
    _fields_ = [
        ('numAgents',       c_uint16),
        ('nodeId',          c_uint32 * MAX_AGENTS),
        ('socketUid',       c_uint32 * MAX_AGENTS),
        ('envType',         c_uint8 * MAX_AGENTS),
        ('simTime_us',      c_int64),
        ('ssThresh',        c_uint32 * MAX_AGENTS),
        ('cWnd',            c_uint32 * MAX_AGENTS),
        ('segmentSize',     c_uint32 * MAX_AGENTS),
        ('segmentsAcked',   c_uint32 * MAX_AGENTS),
        ('bytesInFlight',   c_uint32 * MAX_AGENTS),
        ('rtt_us',          c_int64 * MAX_AGENTS),
        ('throughput',      c_double * MAX_AGENTS),
        ('packetLoss',      c_uint32 * MAX_AGENTS),
    ]

class TcpRlAct(Structure):
    """Mirrors TcpRlAct in tcp-rl-env.h."""
    _pack_ = 1
    _fields_ = [
        ('new_ssThresh',    c_uint32 * MAX_AGENTS),
        ('new_cWnd',        c_uint32 * MAX_AGENTS),
    ]

# ── Constants ────────────────────────────────────────────────────────────────
SHM_KEY         = 1234
SHM_SIZE        = 1048576       # 1 MB
DEFAULT_STEPS   = 2000          # Sane default; override via max_steps
QUEUE_TIMEOUT   = 15            # seconds — ns-3 10ms steps should never take longer
NS3_PATH        = '/sim/ns-allinone-3.35/ns-3.35'

# ── Observation normalization maximums ───────────────────────────────────────
# Normalization bounds are now calculated dynamically per-episode based on
# the active network topology (bandwidth, delay) to prevent clipping when
# using custom topologies!

def parse_time_s(time_str: str) -> float:
    if time_str.endswith("ms"): return float(time_str[:-2]) / 1000.0
    if time_str.endswith("s"): return float(time_str[:-1])
    return float(time_str)

def parse_bps(bw_str: str) -> float:
    if bw_str.endswith("Mbps"): return float(bw_str[:-4]) * 1_000_000.0
    if bw_str.endswith("Kbps"): return float(bw_str[:-4]) * 1_000.0
    if bw_str.endswith("bps"): return float(bw_str[:-3])
    return float(bw_str)


class Ns3TcpEnv(gym.Env):
    """
    Gymnasium wrapper around ns3-ai shared memory interface.

    Observation space (6,):
        [cWnd, rtt_us, throughput, packetLoss, segmentSize, bytesInFlight]

    Action space (1,):
        Scalar multiplier applied to cWnd: new_cWnd = cWnd * action
        Clipped to [0.5, 2.0]
    """

    metadata = {'render_modes': []}

    observation_space = Box(
        low   = np.zeros(MAX_AGENTS * 6, dtype=np.float32),
        high  = np.ones(MAX_AGENTS * 6,  dtype=np.float32),   # normalized [0,1]
        dtype = np.float32,
    )
    # Default action space (dynamically overridden in __init__)
    action_space = Box(
        low   = np.full(MAX_AGENTS, 0.8, dtype=np.float32),
        high  = np.full(MAX_AGENTS, 1.2, dtype=np.float32),
        dtype = np.float32,
    )

    def __init__(
        self,
        shm_key      = SHM_KEY,
        shm_size     = SHM_SIZE,
        max_steps    = DEFAULT_STEPS,
        sim_duration = 200,
        ns3_path     = NS3_PATH,
        bottleneck_bandwidth = "2Mbps",
        bottleneck_delay     = "20ms",
        access_bandwidth     = "10Mbps",
        access_delay         = "20ms",
        queue_disc_type      = "ns3::PfifoFastQueueDisc",
        topology_file        = "",
        reward_profile       = "BALANCED",
    ):
        super().__init__()
        self.shm_key      = shm_key
        self.shm_size     = shm_size
        self.max_steps    = max_steps
        self.sim_duration = sim_duration
        self.ns3_path     = ns3_path
        self.bottleneck_bandwidth = bottleneck_bandwidth
        self.bottleneck_delay     = bottleneck_delay
        self.access_bandwidth     = access_bandwidth
        self.access_delay         = access_delay
        self.queue_disc_type      = queue_disc_type
        self.topology_file        = topology_file
        self.reward_profile       = reward_profile

        # Dynamic Action Space based on Profile
        if self.reward_profile == "AGGRESSIVE":
            act_low, act_high = 0.5, 2.0
        elif self.reward_profile == "CALM":
            act_low, act_high = 0.7, 1.1
        else: # BALANCED
            act_low, act_high = 0.8, 1.2
            
        self.action_space = Box(
            low   = np.full(MAX_AGENTS, act_low, dtype=np.float32),
            high  = np.full(MAX_AGENTS, act_high, dtype=np.float32),
            dtype = np.float32,
        )
        self.act_low = act_low
        self.act_high = act_high

        # Calculate dynamic normalization bounds based on topology
        bottleneck_bps = parse_bps(self.bottleneck_bandwidth)
        access_bps     = parse_bps(self.access_bandwidth)
        bottle_delay_s = parse_time_s(self.bottleneck_delay)
        access_delay_s = parse_time_s(self.access_delay)

        # Baseline physics limits
        self.TMAX = bottleneck_bps / 8.0  # Max bytes per second
        self.RTT_MIN_S = 2.0 * (bottle_delay_s + 2.0 * access_delay_s)
        self.RTT_MIN_US = self.RTT_MIN_S * 1_000_000.0
        self.BDP_BYTES = self.TMAX * self.RTT_MIN_S

        # Realistic maximums for normalization (with headroom for burstiness)
        self.MAX_CWND_BYTES = max(self.BDP_BYTES * 5.0, 1500.0 * 100.0)
        self.MAX_RTT_US = max(self.RTT_MIN_US * 10.0, 200_000.0)
        
        self.OBS_MAX = np.array([
            self.MAX_CWND_BYTES,      # cWnd
            self.MAX_RTT_US,          # rtt_us
            self.TMAX * 2.0,          # throughput (burst up to 2x capacity)
            100.0,                    # packetLoss
            1_500.0,                  # segmentSize
            self.MAX_CWND_BYTES,      # bytesInFlight
        ], dtype=np.float32)

        # Shared memory bridge (created once, reused across episodes)
        self._var  = None
        self._exp  = Experiment(shm_key, shm_size, 'rl-tcp', ns3_path)

        # Thread communication queues
        self._obs_queue = queue.Queue(maxsize=1)
        self._act_queue = queue.Queue(maxsize=1)

        # Thread control
        self._loop_thread = None
        self._stop_event  = threading.Event()

        # Episode tracking
        self._episode_step = 0
        self._episode      = 0

    # ── Gymnasium API ─────────────────────────────────────────────────────────

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        self._episode += 1
        self._episode_step = 0

        print(f"[Env] reset() called for episode {self._episode}", flush=True)

        # 1. Stop any running background thread
        print("[Env] Step 1: Stopping background thread...", flush=True)
        self._stop_background_thread()
        print("[Env] Step 1: Done.", flush=True)

        # 2. Kill ns-3 process
        print("[Env] Step 2: Killing ns-3...", flush=True)
        self._exp.kill()
        time.sleep(0.5)   # give ns-3 time to fully exit on macOS
        print("[Env] Step 2: Done.", flush=True)

        # 3. Clear stale queue data from previous episode
        self._drain_queue(self._obs_queue)
        self._drain_queue(self._act_queue)

        # 4. Reset shared memory data region (preserves control blocks)
        Reset()

        # 4b. Reset SHM version counter to 0 for clean episode start.
        # The SharedMemoryLockable header (version, nextVersion) sits
        # 2 bytes before the data pointer returned by RegisterMemory.
        if self._var is not None:
            try:
                addr = ctypes.addressof(self._var.m_obj)
                ctypes.c_uint8.from_address(addr - 2).value = 0  # version
                ctypes.c_uint8.from_address(addr - 1).value = 0  # nextVersion
                self._var.finished = False
                self._var.m_obj.isFinish = False
                self._var.m_obj.act.new_cWnd     = 3400
                self._var.m_obj.act.new_ssThresh = 65535
            except Exception:
                pass  # safe to ignore if memory not yet mapped

        # 5. Start fresh ns-3 simulation — use episode number as seed for diversity
        sim_seed = (seed if seed is not None else self._episode) % 10000 + 1
        setting = {
            'duration':        self.sim_duration,
            'bottleneckBw':    self.bottleneck_bandwidth,
            'bottleneckDelay': self.bottleneck_delay,
            'accessBw':        self.access_bandwidth,
            'accessDelay':     self.access_delay,
        }
        if self.topology_file:
            setting['topologyFile'] = self.topology_file
        print("[Env] Step 5: Starting new ns-3...", flush=True)
        self._exp.run(setting=setting, show_output=True)
        time.sleep(2.0)   # increased: give ns-3 more time to init on macOS ARM64
        print("[Env] Step 5: Done.", flush=True)

        # 6. Register shared memory on first episode only
        if self._var is None:
            self._var = Ns3AIRL(self.shm_key, TcpRlEnv, TcpRlAct)

        # 7. Launch background sync thread
        self._stop_event.clear()
        self._loop_thread = threading.Thread(
            target=self._ns3_loop, daemon=True, name='ns3-sync'
        )
        self._loop_thread.start()
        print("[Env] Step 7: Sync thread launched.", flush=True)

        # 8. Get first observation and send a default action back
        print("[Env] Step 8: Waiting for first obs...", flush=True)
        try:
            obs_dict = self._obs_queue.get(timeout=QUEUE_TIMEOUT)
        except queue.Empty:
            raise RuntimeError(
                f"[Env] DEADLOCK: ns-3 did not send first observation "
                f"within {QUEUE_TIMEOUT}s. Check ns-3 build and shm_key."
            )

        # Send a default "keep current cWnd" action so sync thread can proceed
        # FIX: cap ssThresh to a sane value — 0xFFFFFFFF must NEVER be used as
        # new_ssThresh in the first action because ns-3 may interpret it as cWnd
        default_cWnds = []
        default_ssThreshs = []
        for i in range(MAX_AGENTS):
            if i < obs_dict['numAgents']:
                cWnd = max(obs_dict['agents'][i].get('cWnd', 3400), 340)
                ssThresh = min(obs_dict['agents'][i].get('ssThresh', 65535), 0x7FFFFFFF)
                default_cWnds.append(cWnd)
                default_ssThreshs.append(ssThresh)
            else:
                default_cWnds.append(3400)
                default_ssThreshs.append(65535)

        self._act_queue.put({
            'new_cWnds':     default_cWnds,
            'new_ssThreshs': default_ssThreshs,
        })

        obs = self._to_obs(obs_dict)
        print(f"[Info] Episode {self._episode} started. "
              f"cWnd={obs_dict.get('cWnd', '?')}")
        return obs, {}

    def step(self, action):
        self._episode_step += 1

        # 1. Wait for observation from ns-3 sync thread
        try:
            obs_dict = self._obs_queue.get(timeout=QUEUE_TIMEOUT)
        except queue.Empty:
            # ns-3 finished early — treat as episode truncation, not a crash
            print(f"[Env] ns-3 ended early at step {self._episode_step} "
                  f"— treating as episode end (truncated).")
            obs = self._last_obs if hasattr(self, '_last_obs') else np.zeros(6, dtype=np.float32)
            return obs, 0.0, False, True, {'early_termination': True}

        # 2. Compute reward (sum over active agents)
        reward = 0.0
        for i in range(obs_dict['numAgents']):
            reward += self._compute_reward(obs_dict['agents'][i])

        # 3. Compute actions
        new_cWnds = []
        new_ssThreshs = []
        for i in range(MAX_AGENTS):
            if i < obs_dict['numAgents']:
                agent_obs = obs_dict['agents'][i]
                factor    = float(np.clip(action[i], self.act_low, self.act_high))
                cWnd      = agent_obs['cWnd']
                seg_size  = max(agent_obs['segmentSize'], 340)
                MAX_CWND  = max(self.MAX_CWND_BYTES, seg_size * 10)
                new_cWnd  = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
                if factor < 1.0:
                    new_ssThresh = int(new_cWnd * 0.75)
                else:
                    new_ssThresh = min(int(new_cWnd * 2), MAX_CWND * 2)
            else:
                new_cWnd = 3400
                new_ssThresh = 65535
                
            new_cWnds.append(new_cWnd)
            new_ssThreshs.append(new_ssThresh)

        # 4. Send action to sync thread (NON-BLOCKING put with timeout)
        try:
            self._act_queue.put(
                {'new_cWnds': new_cWnds, 'new_ssThreshs': new_ssThreshs},
                timeout=QUEUE_TIMEOUT,
            )
        except queue.Full:
            raise RuntimeError(
                f"[Env] Action queue full at step {self._episode_step}. "
                f"Sync thread appears stuck."
            )

        # 5. Check termination
        truncated  = (self._episode_step >= self.max_steps)
        terminated = False

        obs  = self._to_obs(obs_dict)
        self._last_obs = obs  # cache for early termination fallback
        info = {
            'episode_step': self._episode_step,
            'numAgents':    obs_dict['numAgents']
        }
        if obs_dict['numAgents'] > 0:
            agent_0 = obs_dict['agents'][0]
            info['cWnd'] = agent_0['cWnd']
            info['new_cWnd'] = new_cWnds[0]
            info['rtt_us'] = agent_0['rtt_us']
            info['throughput'] = agent_0['throughput']
            info['packetLoss'] = agent_0['packetLoss']
        return obs, reward, terminated, truncated, info

    def close(self):
        self._stop_background_thread()
        self._exp.kill()

    # ── Background Sync Thread ────────────────────────────────────────────────

    def _ns3_loop(self):
        """
        Background thread: syncs with ns-3 via shared memory.

        Single-phase lock pattern (matching the ns3-ai SHM protocol):
            1. Acquire lock (Python acquires when version is odd)
            2. Read observation from shared memory
            3. Write action to shared memory
            4. Release lock (increments version to even → C++ can acquire)

        The action written is from the PREVIOUS step's decision. On the
        first step we write a safe default action. This pipelining avoids
        holding the SHM lock while waiting for the RL agent.
        """
        print("[SyncThread] Started.", flush=True)

        # Pre-computed action for the NEXT SHM write (pipelining)
        pending_action = {
            'new_cWnds':     [3400] * MAX_AGENTS,    # safe default: ~10 segments
            'new_ssThreshs': [65535] * MAX_AGENTS,
        }

        while not self._stop_event.is_set():
            try:
                # ── Single-phase: read obs + write action in one lock hold ──
                with self._var as data:
                    if data is None:
                        print("[SyncThread] ns-3 signalled finish.")
                        break

                    # Read observation
                    numAgents = data.env.numAgents
                    obs_dict = {
                        'numAgents': numAgents,
                        'agents': []
                    }
                    
                    for i in range(MAX_AGENTS):
                        if i < numAgents:
                            agent_obs = {
                                'nodeId':        data.env.nodeId[i],
                                'socketUid':     data.env.socketUid[i],
                                'envType':       data.env.envType[i],
                                'simTime_us':    data.env.simTime_us,
                                'ssThresh':      data.env.ssThresh[i],
                                'cWnd':          data.env.cWnd[i],
                                'segmentSize':   max(data.env.segmentSize[i], 340),
                                'segmentsAcked': data.env.segmentsAcked[i],
                                'bytesInFlight': data.env.bytesInFlight[i],
                                'rtt_us':        data.env.rtt_us[i],
                                'throughput':    data.env.throughput[i],
                                'packetLoss':    data.env.packetLoss[i],
                            }
                            # Sanitize fields
                            seg = agent_obs['segmentSize']
                            if agent_obs['cWnd'] == 0 or agent_obs['cWnd'] > seg * 1000:
                                agent_obs['cWnd'] = seg
                            if agent_obs['ssThresh'] == 0 or agent_obs['ssThresh'] > seg * 2000:
                                agent_obs['ssThresh'] = seg * 100
                            if agent_obs['rtt_us'] < 0 or agent_obs['rtt_us'] > 500_000:
                                agent_obs['rtt_us'] = 0
                            if agent_obs['throughput'] < 0 or agent_obs['throughput'] > 2_500_000:
                                agent_obs['throughput'] = 0.0
                            if agent_obs['bytesInFlight'] > seg * 1000:
                                agent_obs['bytesInFlight'] = 0
                            if agent_obs['packetLoss'] > 1000:
                                agent_obs['packetLoss'] = 0
                            
                            obs_dict['agents'].append(agent_obs)

                    # Write the pending action (from previous step or default)
                    for i in range(MAX_AGENTS):
                        if i < numAgents:
                            seg_size  = max(obs_dict['agents'][i].get('segmentSize', 340), 340)
                            MAX_CWND  = max(self.MAX_CWND_BYTES, seg_size * 10)
                            MIN_CWND  = seg_size
                            safe_cWnd     = int(np.clip(pending_action['new_cWnds'][i],     MIN_CWND, MAX_CWND))
                            safe_ssThresh = int(np.clip(pending_action['new_ssThreshs'][i], MIN_CWND, MAX_CWND * 2))
                            data.act.new_cWnd[i]     = safe_cWnd
                            data.act.new_ssThresh[i] = safe_ssThresh
                        else:
                            data.act.new_cWnd[i] = 3400
                            data.act.new_ssThresh[i] = 65535
                # Lock released — C++ reads action and advances

                # Pass obs to main thread
                try:
                    self._obs_queue.put(obs_dict, timeout=QUEUE_TIMEOUT)
                except queue.Full:
                    if self._stop_event.is_set():
                        break
                    continue

                # Wait for RL agent's action (will be written on NEXT SHM cycle)
                try:
                    pending_action = self._act_queue.get(timeout=QUEUE_TIMEOUT)
                except queue.Empty:
                    if self._stop_event.is_set():
                        break
                    print("[SyncThread] WARNING: Timed out waiting for action.", flush=True)
                    pending_action = {
                        'new_cWnds':      [agent['cWnd'] for agent in obs_dict.get('agents', [])] + [3400]*(MAX_AGENTS-obs_dict.get('numAgents', 0)),
                        'new_ssThreshs':  [agent['ssThresh'] for agent in obs_dict.get('agents', [])] + [65535]*(MAX_AGENTS-obs_dict.get('numAgents', 0)),
                    }

            except Exception as e:
                if not self._stop_event.is_set():
                    print(f"[SyncThread] Exception: {e}", flush=True)
                break

        print("[SyncThread] Exited.", flush=True)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _compute_reward(self, obs: dict) -> float:
        rtt_us     = obs['rtt_us']
        throughput = obs['throughput']
        loss       = obs['packetLoss']
        cWnd       = obs['cWnd']
        seg_size   = max(obs['segmentSize'], 340)

        if throughput == 0 and rtt_us == 0:
            return 0.0

        TMAX = self.TMAX
        RTT_MIN = self.RTT_MIN_US
        BDP = max(self.BDP_BYTES, 10_000.0)
        
        tput_norm = min(throughput / TMAX, 1.0)
        rtt_safe = max(rtt_us, RTT_MIN)

        if self.reward_profile == "AGGRESSIVE":
            # 1. Throughput: Piecewise with convex kink at 90%
            if tput_norm < 0.90:
                reward_tput = float(np.sqrt(tput_norm))
            else:
                reward_tput = 1.0 + 3.0 * (tput_norm - 0.90)

            # 2. RTT Penalty: Cubic, fires beyond 4x base RTT
            e = (rtt_safe - RTT_MIN) / (4.0 * RTT_MIN)
            penalty_rtt = min((e ** 3) * 0.6, 0.4) if e > 0 else 0.0

            # 3. Loss
            penalty_loss = 0.3 + min(loss * 0.05, 0.5) if loss > 0 else 0.0

            # 4. Stability
            cwnd_ratio = cWnd / BDP
            gauss = float(np.exp(-((cwnd_ratio - 1.0) ** 2) / (2 * 0.5 ** 2)))
            stability = 0.1 * tput_norm * gauss
            
            reward = reward_tput - penalty_rtt - penalty_loss + stability
            return float(np.clip(reward, -2.0, 1.5))

        elif self.reward_profile == "CALM":
            # 1. Throughput
            reward_tput = float(np.sqrt(tput_norm))

            # 2. RTT Penalty: Exponential, fires at first byte
            e = (rtt_safe - RTT_MIN) / RTT_MIN
            penalty_rtt = min(1.0 * (np.exp(3.0 * e) - 1.0), 1.2) if e > 0 else 0.0

            # 3. Loss: Catastrophic
            penalty_loss = 0.8 + min((loss - 1) * 0.10, 0.7) if loss > 0 else 0.0

            # 4. Stability
            cwnd_ratio = cWnd / BDP
            gauss = float(np.exp(-((cwnd_ratio - 1.0) ** 2) / (2 * 0.5 ** 2)))
            stability = 0.1 * tput_norm * gauss

            reward = reward_tput - penalty_rtt - penalty_loss + stability
            return float(np.clip(reward, -2.0, 1.1))

        else: # BALANCED
            # 1. Throughput: Log-utility (Proportional Fairness)
            reward_tput = float(np.log10(1.0 + 9.0 * tput_norm))

            # 2. RTT Penalty: Piecewise safe zone
            e = (rtt_safe - RTT_MIN) / RTT_MIN
            if e <= 0.5:
                penalty_rtt = 0.0
            elif e <= 2.0:
                penalty_rtt = 0.8 * ((e - 0.5) ** 2)
            else:
                penalty_rtt = 1.2

            # 3. Loss
            penalty_loss = 0.3 + min(loss * 0.05, 0.5) if loss > 0 else 0.0

            # 4. Stability
            cwnd_ratio = cWnd / BDP
            gauss = float(np.exp(-((cwnd_ratio - 1.0) ** 2) / (2 * 0.5 ** 2)))
            stability = 0.1 * tput_norm * gauss

            reward = reward_tput - penalty_rtt - penalty_loss + stability
            return float(np.clip(reward, -2.0, 1.1))

        
    def _to_obs(self, obs_dict: dict) -> np.ndarray:
        """Convert obs dict to normalized numpy array in [0, 1] for all agents."""
        obs_array = np.zeros(MAX_AGENTS * 6, dtype=np.float32)
        
        for i in range(MAX_AGENTS):
            if i < obs_dict.get('numAgents', 0):
                agent_obs = obs_dict['agents'][i]
                raw = np.array([
                    agent_obs['cWnd'],
                    agent_obs['rtt_us'],
                    agent_obs['throughput'],
                    agent_obs['packetLoss'],
                    agent_obs['segmentSize'],
                    agent_obs['bytesInFlight'],
                ], dtype=np.float32)
                norm = np.clip(raw / self.OBS_MAX, 0.0, 1.0)
                obs_array[i*6:(i+1)*6] = norm
            else:
                obs_array[i*6:(i+1)*6] = 0.0
                
        return obs_array

    def _stop_background_thread(self):
        if self._loop_thread and self._loop_thread.is_alive():
            self._stop_event.set()

            # CRITICAL: Unblock the C-level AcquireMemoryCond spin-wait.
            # The sync thread may be stuck in AcquireMemoryCond (C-level)
            # waiting for version%2==1. We cannot use IncMemoryVersion()
            # because it uses CAS which deadlocks if the lock is held.
            # Instead, directly write to the SHM header via ctypes:
            #   - Set isFinish=True so Acquire() returns None
            #   - Set version=1 so AcquireMemoryCond(mod=2,res=1) unblocks
            #   - Set nextVersion=1 so the CAS succeeds
            if self._var is not None:
                try:
                    self._var.m_obj.isFinish = True
                    addr = ctypes.addressof(self._var.m_obj)
                    ctypes.c_uint8.from_address(addr - 2).value = 1  # version=1 (odd)
                    ctypes.c_uint8.from_address(addr - 1).value = 1  # nextVersion=1
                except Exception:
                    pass

            # Unblock queues so thread can exit
            self._drain_queue(self._obs_queue)
            try:
                self._act_queue.put_nowait({
                    'new_cWnds': [0] * MAX_AGENTS, 
                    'new_ssThreshs': [0] * MAX_AGENTS
                })
            except queue.Full:
                pass
            self._loop_thread.join(timeout=5.0)
            if self._loop_thread.is_alive():
                print("[Env] WARNING: Sync thread did not exit cleanly.", flush=True)
        self._stop_event.clear()

    @staticmethod
    def _drain_queue(q: queue.Queue):
        """Empty a queue without blocking."""
        while True:
            try:
                q.get_nowait()
            except queue.Empty:
                break
