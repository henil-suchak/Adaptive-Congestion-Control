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
                      access_bw=10.0, access_delay=20.0, queue_type="FqCoDel", mtu=400):
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
        if env_size != 57 or act_size != 8:
            raise RuntimeError(
                f"❌ Struct size mismatch! "
                f"Expected env=57, act=8. Got env={env_size}, act={act_size}"
            )

        # ── Step 4: Initialize shared memory with DYNAMIC SHM ID ─────────────
        print(f"🔌 [Worker] Initializing Shared Memory on ID {shm_id}...", flush=True)
        Init(shm_id, 4096)
        agent = Ns3AIRL(shm_id, sTcpRlInferenceEnv, TcpRlInferenceAct)

        # ── Step 5: Load AI model ─────────────────────────────────────────────
        model_path = os.path.join(MODEL_DIR, model_name)
        print(f"🧠 [Worker] Loading AI Model: {model_path}...", flush=True)
        model = SAC.load(model_path, device="cpu")
        OBS_MAX = np.array([
            1_400_000.0, 200_000.0, 250_000.0,
            100.0, 1_500.0, 1_400_000.0
        ], dtype=np.float32)
        print("✅ [Worker] AI Model loaded successfully.", flush=True)

        # ── Step 6: Start telemetry sender (Queue + WebSocket) ────────────────
        sender.start()

        # ── Step 7: Launch C++ binary (with dynamic SHM ID) ───────────────────
        print("🚀 [Worker] Launching NS-3 binary...", flush=True)
        start_cpp_binary(
            experiment_id, shm_id=shm_id,
            bottleneck_bw=f"{bandwidth}Mbps",
            bottleneck_delay=f"{delay}ms",
            access_bw=f"{access_bw}Mbps",
            access_delay=f"{access_delay}ms",
            mtu=mtu
        )

        # ── Step 8: Inference loop ────────────────────────────────────────────
        print("📈 [Worker] Entering inference loop (waiting for C++)...", flush=True)
        step_counter = 0

        while True:
            with agent as data:
                if data is None or agent.isFinish():
                    print("🏁 [Worker] C++ signaled simulation end.", flush=True)
                    break

                step_counter += 1

                # Read observation
                cWnd     = data.env.cWnd
                seg_size = max(data.env.segmentSize, 340)

                raw_obs = np.array([
                    cWnd,
                    data.env.rtt_us,
                    data.env.throughput,
                    data.env.packetLoss,
                    seg_size,
                    data.env.bytesInFlight
                ], dtype=np.float32)

                # Normalize and predict
                normalized_obs = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                action, _ = model.predict(normalized_obs, deterministic=True)

                # Compute new cWnd and ssThresh
                factor   = float(np.clip(action[0], 0.8, 1.2))
                MAX_CWND = seg_size * 1000
                new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))

                if factor < 1.0:
                    new_ssThresh = int(new_cWnd * 0.75)
                else:
                    new_ssThresh = min(int(new_cWnd * 2), MAX_CWND * 2)

                # Write action
                data.act.new_cWnd     = new_cWnd
                data.act.new_ssThresh = new_ssThresh

                # Debug first 3 steps
                if step_counter <= 3:
                    print(
                        f"✅ [Step {step_counter}] "
                        f"cWnd={cWnd}→{new_cWnd}, "
                        f"ssThresh={new_ssThresh}, "
                        f"rtt={data.env.rtt_us}µs, "
                        f"tput={data.env.throughput:.0f}B/s",
                        flush=True
                    )

                # Telemetry every 20 steps
                if step_counter % 20 == 0:
                    payload = {
                        "experimentId":   experiment_id,
                        "cwndBytes":      float(cWnd),
                        "rttMs":          float(data.env.rtt_us / 1000.0),
                        "throughputMbps": float((data.env.throughput * 8) / 1_000_000.0),
                        "packetLossRate": float(data.env.packetLoss)
                    }
                    print(
                        f"📊 [Step {step_counter}] TELEMETRY → backend  "
                        f"expId={payload['experimentId']}  "
                        f"cwnd={payload['cwndBytes']:.0f}B  "
                        f"rtt={payload['rttMs']:.2f}ms  "
                        f"tput={payload['throughputMbps']:.4f}Mbps  "
                        f"loss={payload['packetLossRate']:.0f}",
                        flush=True
                    )
                    # Drop into queue — sender thread handles WebSocket delivery
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