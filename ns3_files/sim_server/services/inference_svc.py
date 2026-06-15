import time
import sys
import os
import subprocess
import multiprocessing
import numpy as np
from stable_baselines3 import SAC
import ctypes

from py_interface import Ns3AIRL, Init

from models.dtos import SimulationRequest
from models.shm_types import sTcpRlInferenceEnv, TcpRlInferenceAct
from core.state import active_simulations
from services.process_svc import start_cpp_binary, kill_cpp_binary, WAF_DIR
from services.telemetry_svc import TelemetrySender

MODEL_DIR = "/sim/models"

# ── Dynamic SHM ID based on WORKER_ID ────────────────────────────────────
# Each sidecar instance gets a unique shared memory ID so multiple
# simulations can run concurrently without SHM collisions.
WORKER_ID = int(os.environ.get('WORKER_ID', 1))
SHM_ID = 2333 + WORKER_ID
print(f"🔧 [Config] Worker ID: {WORKER_ID}, SHM ID: {SHM_ID}", flush=True)

# ── Track the inference subprocess so we can kill it on stop ──────────────
_inference_process: multiprocessing.Process = None
_current_experiment_id = None


def get_status():
    """Returns the current status of this sidecar (used by /status endpoint)."""
    global _inference_process, _current_experiment_id
    busy = _inference_process is not None and _inference_process.is_alive()
    return {
        "busy": busy,
        "currentExperimentId": _current_experiment_id if busy else None
    }


def _shm_cleanup():
    """Nuke ALL shared memory so the next run starts fresh."""
    print("🧹 [Cleanup] Wiping shared memory (POSIX + SysV)...", flush=True)
    os.system("rm -f /dev/shm/*")
    os.system("ipcrm -a 2>/dev/null || true")


def _inference_worker(experiment_id, topology, bandwidth, delay, sim_duration, model_name, shm_id,
                      access_bw=10.0, access_delay=20.0, queue_type="FqCoDel", mtu=400, graph_json=None):
    """
    Runs in a CHILD PROCESS — the C extension 'shm_pool' has fresh state,
    so Init(shm_id) always creates/attaches correctly.
    """
    print(f"🚀 [Worker] Starting inference for Exp {experiment_id} (PID={os.getpid()}, SHM={shm_id})...", flush=True)

    # Create the telemetry sender (local to this subprocess)
    sender = TelemetrySender()

    try:
        # ── Step 1: Blocking pre-compile ─────────────────────────────────────
        print("🔨 [Worker] Pre-compiling NS-3 C++ binary (blocking)...", flush=True)
        compile_result = subprocess.run(
            ["./waf", "build"],
            cwd=WAF_DIR,
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        if compile_result.returncode != 0:
            raise RuntimeError("❌ waf build failed.")
        print("✅ [Worker] Compilation successful.", flush=True)

        # ── Step 2: Wipe shared memory ────────────────────────────────────────
        _shm_cleanup()

        # ── Step 3: Struct size sanity check ─────────────────────────────────
        env_size = ctypes.sizeof(sTcpRlInferenceEnv)
        act_size = ctypes.sizeof(TcpRlInferenceAct)
        print(f"🔬 [Debug] sTcpRlInferenceEnv size: {env_size} bytes", flush=True)
        print(f"🔬 [Debug] TcpRlInferenceAct size:  {act_size} bytes", flush=True)
        if env_size != 500 or act_size != 80:
            raise RuntimeError(
                f"❌ Struct size mismatch! "
                f"Expected env=500, act=80. Got env={env_size}, act={act_size}"
            )

        # ── Step 4: Initialize shared memory with DYNAMIC SHM ID ─────────────
        print(f"🔌 [Worker] Initializing Shared Memory on ID {shm_id}...", flush=True)
        Init(shm_id, 4096)
        agent = Ns3AIRL(shm_id, sTcpRlInferenceEnv, TcpRlInferenceAct)

        # ── Step 5: Load AI model ─────────────────────────────────────────────
        model_path = os.path.join(MODEL_DIR, model_name)
        print(f"🧠 [Worker] Loading AI Model: {model_path}...", flush=True)
        model = SAC.load(model_path, device="cpu")
        
        # Calculate dynamic normalization bounds based on topology (matches env_wrapper.py)
        bottleneck_bps = float(bandwidth) * 1_000_000.0
        access_bps     = float(access_bw) * 1_000_000.0
        max_bps        = max(bottleneck_bps, access_bps)
        
        OBS_MAX = np.array([
            max_bps * 0.1,  # cWnd max (bytes)
            500_000.0,      # RTT max (us)
            max_bps / 8.0,  # Throughput max (bytes/sec)
            100.0,          # Packet loss max
            1_500.0,        # Segment size max
            max_bps * 0.1   # Bytes in flight max
        ], dtype=np.float32)
        
        print("✅ [Worker] AI Model loaded successfully.", flush=True)

        # ── Step 6: Start telemetry sender (Queue + WebSocket) ────────────────
        sender.start()

        # ── Fast Fail for Non-RL Topologies ──────────────────────────
        if graph_json and '"algorithm":"SAC"' not in graph_json.replace(" ", ""):
            print("⚠️ [Worker] No SAC Agent found in topology! Inference requires an SAC Agent.", flush=True)
            print("🏁 [Worker] C++ signaled simulation end.", flush=True)
            _inference_state.update({"busy": False, "status": "failed"})
            return

        # ── Step 7: Launch C++ binary (with dynamic SHM ID) ───────────────────
        print("🚀 [Worker] Launching NS-3 binary...", flush=True)
        process = start_cpp_binary(
            experiment_id, shm_id=shm_id,
            bottleneck_bw=f"{bandwidth}Mbps",
            bottleneck_delay=f"{delay}ms",
            access_bw=f"{access_bw}Mbps",
            access_delay=f"{access_delay}ms",
            mtu=mtu,
            sim_duration=sim_duration,
            graph_json=graph_json,
            return_process=True
        )

        # ── Step 8: Inference loop in a separate process ──────────────────────
        print("📈 [Worker] Launching inference loop process...", flush=True)
        
        def _run_agent_loop(shm_id, model_path, obs_max):
            import numpy as np
            from py_interface import Ns3AIRL
            from stable_baselines3 import SAC
            import time
            
            # Re-load model in subprocess
            try:
                model = SAC.load(model_path, device="cpu")
                agent = Ns3AIRL(shm_id, Env=500, Act=80)
                
                while True:
                    with agent as data:
                        if data is None or agent.isFinish():
                            break
                        
                        num_agents = data.env.numAgents
                        if num_agents == 0:
                            continue
                            
                        obs_shape = model.observation_space.shape[0]
                        if obs_shape == 60:
                            flat_obs = np.zeros(60, dtype=np.float32)
                            for i in range(10):
                                if i < num_agents:
                                    seg_size = max(data.env.segmentSize[i], 340)
                                    raw_obs = np.array([
                                        data.env.cWnd[i], data.env.rtt_us[i], data.env.throughput[i],
                                        data.env.packetLoss[i], seg_size, data.env.bytesInFlight[i]
                                    ], dtype=np.float32)
                                    flat_obs[i*6:(i+1)*6] = np.clip(raw_obs / obs_max, 0.0, 1.0)
                            actions, _ = model.predict(flat_obs, deterministic=True)
                            for i in range(10):
                                if i < num_agents:
                                    data.act.new_cWnd[i] = max(1, int(actions[i] * 10000))
                        else:
                            for i in range(num_agents):
                                seg_size = max(data.env.segmentSize[i], 340)
                                raw_obs = np.array([
                                    data.env.cWnd[i], data.env.rtt_us[i], data.env.throughput[i],
                                    data.env.packetLoss[i], seg_size, data.env.bytesInFlight[i]
                                ], dtype=np.float32)
                                norm_obs = np.clip(raw_obs / obs_max, 0.0, 1.0)
                                action, _ = model.predict(norm_obs, deterministic=True)
                                data.act.new_cWnd[i] = max(1, int(action[0] * 10000))
            except Exception as e:
                print(f"⚠️ [InferenceLoop] Crashed: {e}", flush=True)

        import multiprocessing
        loop_proc = multiprocessing.Process(target=_run_agent_loop, args=(shm_id, model_path, OBS_MAX))
        loop_proc.start()

        # ── Step 9: Monitor both processes ─────────────────────────────────────
        try:
            while loop_proc.is_alive() and process.poll() is None:
                if not _inference_state["busy"]:
                    print("🛑 [Inference] Stop signal received.", flush=True)
                    break
                            ], dtype=np.float32)
                            flat_obs[i*6:(i+1)*6] = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                    
                    actions, _ = model.predict(flat_obs, deterministic=True)
                    
                    for i in range(num_agents):
                        seg_size = max(data.env.segmentSize[i], 340)
                        
                        act_low = float(model.action_space.low[0]) if hasattr(model.action_space, 'low') else 0.5
                        act_high = float(model.action_space.high[0]) if hasattr(model.action_space, 'high') else 2.0
                        factor = float(np.clip(actions[i], act_low, act_high))
                        
                        MAX_CWND = seg_size * 1000
                        new_cWnd = int(np.clip(data.env.cWnd[i] * factor, seg_size, MAX_CWND))
                        new_ssThresh = int(new_cWnd * 0.75) if factor < 1.0 else min(int(new_cWnd * 2), MAX_CWND * 2)
                        data.act.new_cWnd[i] = new_cWnd
                        data.act.new_ssThresh[i] = new_ssThresh
                        
                else:
                    # LEGACY Single-agent model (expects 6 features, returns 1 action)
                    for i in range(num_agents):
                        cWnd = data.env.cWnd[i]
                        seg_size = max(data.env.segmentSize[i], 340)
                        raw_obs = np.array([
                            cWnd, data.env.rtt_us[i], data.env.throughput[i],
                            data.env.packetLoss[i], seg_size, data.env.bytesInFlight[i]
                        ], dtype=np.float32)
                        normalized_obs = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                        action, _ = model.predict(normalized_obs, deterministic=True)
                        
                        act_low = float(model.action_space.low[0]) if hasattr(model.action_space, 'low') else 0.5
                        act_high = float(model.action_space.high[0]) if hasattr(model.action_space, 'high') else 2.0
                        raw_factor = action[0] if isinstance(action, np.ndarray) else action
                        factor = float(np.clip(raw_factor, act_low, act_high))
                        
                        MAX_CWND = seg_size * 1000
                        new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
                        new_ssThresh = int(new_cWnd * 0.75) if factor < 1.0 else min(int(new_cWnd * 2), MAX_CWND * 2)
                        data.act.new_cWnd[i] = new_cWnd
                        data.act.new_ssThresh[i] = new_ssThresh

                # Debug first 3 steps
                if step_counter <= 3:
                    print(f"   [Step {step_counter}] num_agents={num_agents} cWnd[0]={data.env.cWnd[0]} -> new_cWnd[0]={data.act.new_cWnd[0]}", flush=True)

                if step_counter % 20 == 0:
                    sim_time_sec = round(step_counter * 0.040, 3)
                    payload = {
                        "experimentId":   experiment_id,
                        "cwndBytes":      float(data.env.cWnd[0]),
                        "ssThresh":       float(data.act.new_ssThresh[0]),
                        "rttMs":          float(data.env.rtt_us[0] / 1000.0),
                        "throughputMbps": float((data.env.throughput[0] * 8) / 1_000_000.0),
                        "packetLossRate": float(data.env.packetLoss[0]),
                        "simTimeSec":     sim_time_sec
                    }
                    print(
                        f"📊 [Step {step_counter}] TELEMETRY → backend  "
                        f"expId={payload['experimentId']}  "
                        f"cwnd={payload['cwndBytes']:.0f}B  "
                        f"ssThresh={payload['ssThresh']:.0f}  "
                        f"rtt={payload['rttMs']:.2f}ms  "
                        f"tput={payload['throughputMbps']:.4f}Mbps  "
                        f"loss={payload['packetLossRate']:.0f}  "
                        f"simTime={sim_time_sec:.1f}s",
                        flush=True
                    )
                    sender.enqueue(payload)

        print(f"🏁 [Worker] Experiment {experiment_id} finished cleanly!", flush=True)

    except Exception as e:
        print(f"❌ [Worker] Loop crashed: {e}", flush=True)
        import traceback
        traceback.print_exc()
    finally:
        # Shut down telemetry sender (closes WebSocket, drains queue)
        sender.stop()
        # Kill C++ if still running
        kill_cpp_binary(experiment_id)
        _shm_cleanup()
        print(f"🧹 [Worker] Final cleanup done for Exp {experiment_id}.", flush=True)


def run_inference_loop(req: SimulationRequest):
    """
    Called by FastAPI BackgroundTasks — spawns a SUBPROCESS for the inference.
    Using a subprocess ensures the C extension's global Init() state is fresh.
    """
    global _inference_process, _current_experiment_id

    # Kill any leftover inference subprocess
    if _inference_process is not None and _inference_process.is_alive():
        print("🛑 [Inference] Killing previous inference subprocess...", flush=True)
        _inference_process.kill()
        _inference_process.join(timeout=5)

    _shm_cleanup()

    _current_experiment_id = req.experimentId

    _inference_process = multiprocessing.Process(
        target=_inference_worker,
        args=(
            req.experimentId,
            req.topology,
            req.bandwidthMbps,
            req.delayMs,
            req.simDuration,
            req.modelName,
            SHM_ID,  # Pass the dynamic SHM ID
            req.accessBandwidthMbps,
            req.accessDelayMs,
            req.queueType,
            req.mtu,
            req.graphJson,
        ),
        daemon=True,
    )
    _inference_process.start()
    print(f"🚀 [Inference] Subprocess PID={_inference_process.pid} launched for Exp {req.experimentId} (SHM={SHM_ID})", flush=True)


def signal_stop():
    """Called by the stop endpoint to kill the inference subprocess."""
    global _inference_process, _current_experiment_id
    print("🛑 [Inference] Stop signal received.", flush=True)

    if _inference_process is not None and _inference_process.is_alive():
        print(f"🛑 [Inference] Killing inference subprocess PID={_inference_process.pid}...", flush=True)
        _inference_process.kill()
        _inference_process.join(timeout=5)
        print("🛑 [Inference] Subprocess killed.", flush=True)
    _inference_process = None
    _current_experiment_id = None

    # Clean up shared memory
    _shm_cleanup()