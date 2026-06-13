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
from ctypes import Structure, c_uint32, c_uint8, c_int64, c_double, c_bool


class TcpRlEnv(Structure):
    """Mirrors sTcpRlEnv in tcp-rl-env.h — byte-for-byte match required."""
    _pack_ = 1
    _fields_ = [
        ('nodeId',          c_uint32),
        ('socketUid',       c_uint32),
        ('envType',         c_uint8),
        ('simTime_us',      c_int64),
        ('ssThresh',        c_uint32),
        ('cWnd',            c_uint32),
        ('segmentSize',     c_uint32),
        ('segmentsAcked',   c_uint32),
        ('bytesInFlight',   c_uint32),
        ('rtt_us',          c_int64),
        ('throughput',      c_double),
        ('packetLoss',      c_uint32),
    ]


class TcpRlAct(Structure):
    """Mirrors TcpRlAct in tcp-rl-env.h."""
    _pack_ = 1
    _fields_ = [
        ('new_ssThresh',    c_uint32),
        ('new_cWnd',        c_uint32),
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
        low   = np.zeros(6, dtype=np.float32),
        high  = np.ones(6,  dtype=np.float32),   # normalized [0,1]
        dtype = np.float32,
    )
    # Action: multiplier on cWnd. Tightened to [0.8, 1.2] to prevent
    # random policy from causing huge cWnd spikes early in training.
    action_space = Box(
        low   = np.array([0.8], dtype=np.float32),
        high  = np.array([1.2], dtype=np.float32),
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
            'transport_prot': 'ns3::TcpRlTimeBased',
            'duration':       self.sim_duration,
            'simSeed':        sim_seed,
            'data':           10000,   # 10,000 MB ≈ unlimited for any sim_duration
                                       # data=0 means 0 MB (send nothing!) — NOT unlimited
            'bottleneck_bandwidth': self.bottleneck_bandwidth,
            'bottleneck_delay':     self.bottleneck_delay,
            'access_bandwidth':     self.access_bandwidth,
            'access_delay':         self.access_delay,
            'queue_disc_type':      self.queue_disc_type,
        }
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
        default_cWnd     = max(obs_dict.get('cWnd', 3400), 340)
        default_ssThresh = min(obs_dict.get('ssThresh', 65535), 0x7FFFFFFF)
        self._act_queue.put({
            'new_cWnd':     default_cWnd,
            'new_ssThresh': default_ssThresh,
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

        # 2. Compute reward
        reward = self._compute_reward(obs_dict)

        # 3. Compute action — cWnd multiplier capped to dynamic max segments
        factor    = float(np.clip(action[0], 0.8, 1.2))
        cWnd      = obs_dict['cWnd']
        seg_size  = max(obs_dict['segmentSize'], 340)
        MAX_CWND  = max(self.MAX_CWND_BYTES, seg_size * 10)
        new_cWnd  = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
        if factor < 1.0:
            new_ssThresh = int(new_cWnd * 0.75)
        else:
            new_ssThresh = min(int(new_cWnd * 2), MAX_CWND * 2)

        # 4. Send action to sync thread (NON-BLOCKING put with timeout)
        try:
            self._act_queue.put(
                {'new_cWnd': new_cWnd, 'new_ssThresh': new_ssThresh},
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
            'cWnd':         obs_dict['cWnd'],
            'rtt_us':       obs_dict['rtt_us'],
            'throughput':   obs_dict['throughput'],
            'packetLoss':   obs_dict['packetLoss'],
            'new_cWnd':     new_cWnd,
        }
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
            'new_cWnd':     3400,    # safe default: ~10 segments
            'new_ssThresh': 65535,
        }

        while not self._stop_event.is_set():
            try:
                # ── Single-phase: read obs + write action in one lock hold ──
                with self._var as data:
                    if data is None:
                        print("[SyncThread] ns-3 signalled finish.")
                        break

                    # Read observation
                    obs_dict = {
                        'nodeId':        data.env.nodeId,
                        'socketUid':     data.env.socketUid,
                        'envType':       data.env.envType,
                        'simTime_us':    data.env.simTime_us,
                        'ssThresh':      data.env.ssThresh,
                        'cWnd':          data.env.cWnd,
                        'segmentSize':   max(data.env.segmentSize, 340),
                        'segmentsAcked': data.env.segmentsAcked,
                        'bytesInFlight': data.env.bytesInFlight,
                        'rtt_us':        data.env.rtt_us,
                        'throughput':    data.env.throughput,
                        'packetLoss':    data.env.packetLoss,
                    }

                    # Sanitize fields
                    seg = max(obs_dict['segmentSize'], 340)
                    if obs_dict['cWnd'] == 0 or obs_dict['cWnd'] > seg * 1000:
                        obs_dict['cWnd'] = seg
                    if obs_dict['ssThresh'] == 0 or obs_dict['ssThresh'] > seg * 2000:
                        obs_dict['ssThresh'] = seg * 100
                    if obs_dict['rtt_us'] < 0 or obs_dict['rtt_us'] > 500_000:
                        obs_dict['rtt_us'] = 0
                    if obs_dict['throughput'] < 0 or obs_dict['throughput'] > 2_500_000:
                        obs_dict['throughput'] = 0.0
                    if obs_dict['bytesInFlight'] > seg * 1000:
                        obs_dict['bytesInFlight'] = 0
                    if obs_dict['packetLoss'] > 1000:
                        obs_dict['packetLoss'] = 0

                    # Write the pending action (from previous step or default)
                    seg_size  = max(obs_dict.get('segmentSize', 340), 340)
                    MAX_CWND  = max(self.MAX_CWND_BYTES, seg_size * 10)
                    MIN_CWND  = seg_size
                    safe_cWnd     = int(np.clip(pending_action['new_cWnd'],     MIN_CWND, MAX_CWND))
                    safe_ssThresh = int(np.clip(pending_action['new_ssThresh'], MIN_CWND, MAX_CWND * 2))
                    data.act.new_cWnd     = safe_cWnd
                    data.act.new_ssThresh = safe_ssThresh
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
                        'new_cWnd':      obs_dict['cWnd'],
                        'new_ssThresh':  obs_dict['ssThresh'],
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

        # 1. Throughput: sqrt gives gradient at all levels
        TMAX        = self.TMAX
        tput_norm   = min(throughput / TMAX, 1.0)
        reward_tput = float(np.sqrt(tput_norm))

        # 2. RTT: quadratic penalty above physical baseline
        RTT_MIN     = self.RTT_MIN_US
        rtt_safe    = max(rtt_us, RTT_MIN)
        excess      = max(rtt_safe - RTT_MIN, 0.0) / (RTT_MIN * 10.0)  # scale by baseline
        penalty_rtt = min(excess ** 2 * 12.0, 1.0)

        # 3. Loss: hard base + proportional
        if loss > 0:
            penalty_loss = 0.3 + min(loss * 0.05, 0.5)
        else:
            penalty_loss = 0.0

        # 4. Stability: small bonus for cWnd near BDP, only when tput is high
        BDP        = max(self.BDP_BYTES, 10_000.0)
        cwnd_ratio = cWnd / BDP
        gauss      = float(np.exp(-((cwnd_ratio - 1.0) ** 2) / (2 * 0.5 ** 2)))
        stability  = 0.1 * tput_norm * gauss

        reward = reward_tput - penalty_rtt - penalty_loss + stability
        return float(np.clip(reward, -2.0, 1.1))

        
    def _to_obs(self, obs_dict: dict) -> np.ndarray:
        """Convert obs dict to normalized numpy array in [0, 1]."""
        raw = np.array([
            obs_dict['cWnd'],
            obs_dict['rtt_us'],
            obs_dict['throughput'],
            obs_dict['packetLoss'],
            obs_dict['segmentSize'],
            obs_dict['bytesInFlight'],
        ], dtype=np.float32)
        return np.clip(raw / self.OBS_MAX, 0.0, 1.0)

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
                self._act_queue.put_nowait({'new_cWnd': 0, 'new_ssThresh': 0})
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
