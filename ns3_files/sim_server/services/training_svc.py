"""
Training Service — Wraps train_sac.py execution in a subprocess.

Parses stdout in real-time to extract training metrics:
  - step, episode, average reward, cWnd, rtt, throughput

Streams parsed metrics to Spring Boot backend via WebSocket
at ws://backend:8080/ws/training-ingest.

Also posts model checkpoints to POST /api/models when saved.
"""

import json
import os
import re
import subprocess
import sys
import threading
import time
import requests
import websocket

BACKEND_WS_URL = "ws://backend:8080/ws/training-ingest"
BACKEND_API_URL = "http://backend:8080/api"
WORKER_ID = int(os.environ.get('WORKER_ID', 1))
SHM_KEY_BASE = 2333   # training uses SHM_KEY_BASE + WORKER_ID
TRAIN_SCRIPT_DIR = "/sim/ns-allinone-3.35/ns-3.35/contrib/ns3-ai/examples/rl-tcp"
MODEL_DIR = "/sim/models"

# Global state
_training_process: subprocess.Popen = None
_training_thread: threading.Thread = None
_training_state = {
    "busy": False,
    "trainingRunId": None,
    "currentTimestep": 0,
    "currentEpisode": 0,
    "avgReward": 0.0,
    "totalTimesteps": 0,
}

_RECONNECT_DELAY = 2.0

# ── Regex patterns for parsing train_sac.py stdout ───────────────────────
# Pattern: [Step  123456] Ep:5 | cWnd:1234->5678 | ...  | R:0.1234
RE_STEP = re.compile(
    r'\[Step\s+(\d+)\].*Ep:(\d+).*R:([-\d.]+)'
)
# Pattern: [Episode 5 END] steps=123456 avg_r=0.1234 elapsed=600s
RE_EPISODE = re.compile(
    r'\[Episode\s+(\d+)\s+END\]\s+steps=(\d+)\s+avg_r=([-\d.]+)'
)
# Pattern: Saving model checkpoint to ./checkpoints/sac_tcp_100000_steps.zip
RE_CHECKPOINT = re.compile(
    r'Saving model checkpoint to\s+(\S+)'
)
# Pattern: [Training Complete] episodes=10 elapsed=600s
RE_COMPLETE = re.compile(
    r'\[Training Complete\]'
)
# Pattern: Saved sac_tcp_model_final.zip
RE_FINAL_SAVE = re.compile(
    r'\[Training\] Saved (\S+\.zip)'
)


def get_training_status() -> dict:
    """Returns current training state."""
    return dict(_training_state)


def _ws_connect():
    """Open WebSocket to backend training ingest."""
    for attempt in range(10):
        try:
            ws = websocket.create_connection(BACKEND_WS_URL, timeout=5)
            print(f"🎓 [Training] WebSocket connected to {BACKEND_WS_URL}", flush=True)
            return ws
        except Exception as e:
            print(
                f"⚠️ [Training] WS connect failed (attempt {attempt+1}): {e}. "
                f"Retrying in {_RECONNECT_DELAY}s...",
                flush=True
            )
            time.sleep(_RECONNECT_DELAY)
    return None


def _ws_send(ws, payload: dict):
    """Send JSON payload via WebSocket with auto-reconnect."""
    json_str = json.dumps(payload)
    try:
        ws.send(json_str)
    except Exception:
        try:
            ws = _ws_connect()
            if ws:
                ws.send(json_str)
        except Exception:
            print("❌ [Training] WS send failed, dropping payload.", flush=True)
    return ws


def _post_checkpoint(training_run_id, experiment_id, checkpoint_name, total_steps):
    """Post model checkpoint metadata to backend."""
    try:
        payload = {
            "experimentId": experiment_id,
            "checkpointName": checkpoint_name,
            "filePath": os.path.join(MODEL_DIR, checkpoint_name),
            "totalSteps": total_steps,
            "description": f"Auto-saved during training run #{training_run_id}"
        }
        resp = requests.post(f"{BACKEND_API_URL}/models", json=payload, timeout=5)
        print(f"📦 [Training] Posted checkpoint {checkpoint_name}: {resp.status_code}", flush=True)
    except Exception as e:
        print(f"⚠️ [Training] Failed to post checkpoint: {e}", flush=True)


def _training_worker(training_run_id, experiment_id, total_timesteps, learning_rate, network_arch,
                     bottleneck_bw="2Mbps", bottleneck_delay="20ms",
                     access_bw="10Mbps", access_delay="20ms",
                     queue_type="ns3::PfifoFastQueueDisc"):
    """
    Main training worker function. Runs in a separate thread.
    Spawns train_sac.py, parses output, streams metrics.
    """
    global _training_process, _training_state

    _training_state.update({
        "busy": True,
        "trainingRunId": training_run_id,
        "currentTimestep": 0,
        "currentEpisode": 0,
        "avgReward": 0.0,
        "totalTimesteps": total_timesteps,
    })

    shm_key = SHM_KEY_BASE + WORKER_ID
    save_path = os.path.join(MODEL_DIR, f"run_{training_run_id}")
    os.makedirs(save_path, exist_ok=True)

    cmd = [
        sys.executable,
        os.path.join(TRAIN_SCRIPT_DIR, "train_sac.py"),
        "--timesteps", str(total_timesteps),
        "--learning_rate", str(learning_rate),
        "--shm_key", str(shm_key),
        "--save_path", save_path,
        "--log_interval", "50",
        "--bottleneck_bandwidth", str(bottleneck_bw),
        "--bottleneck_delay", str(bottleneck_delay),
        "--access_bandwidth", str(access_bw),
        "--access_delay", str(access_delay),
        "--queue_disc_type", str(queue_type),
    ]

    print(f"🎓 [Training] Starting train_sac.py for run #{training_run_id}", flush=True)
    print(f"🎓 [Training] CMD: {' '.join(cmd)}", flush=True)
    print(f"🎓 [Training] SHM key: {shm_key}, save: {save_path}", flush=True)

    ws = _ws_connect()

    try:
        env = os.environ.copy()
        env["NS3_SHM_ID"] = str(shm_key)
        env["PYTHONUNBUFFERED"] = "1"  # Force line-buffered stdout for real-time log parsing
        env["PYTHONPATH"] = TRAIN_SCRIPT_DIR + ":" + env.get("PYTHONPATH", "")

        _training_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=TRAIN_SCRIPT_DIR,
            env=env,
            text=True,
            bufsize=1,
        )

        latest_step = 0
        latest_episode = 0
        latest_reward = 0.0

        for line in iter(_training_process.stdout.readline, ''):
            line = line.rstrip()
            if not line:
                continue

            # Print to sidecar logs
            print(f"  [train] {line}", flush=True)

            # Parse step-level log
            m = RE_STEP.search(line)
            if m:
                latest_step = int(m.group(1))
                latest_episode = int(m.group(2))
                latest_reward = float(m.group(3))

                _training_state["currentTimestep"] = latest_step
                _training_state["currentEpisode"] = latest_episode
                _training_state["avgReward"] = latest_reward

                # Stream every 500 steps to avoid flooding
                if latest_step % 500 == 0 and ws:
                    payload = {
                        "trainingRunId": training_run_id,
                        "currentTimestep": latest_step,
                        "currentEpisode": latest_episode,
                        "avgReward": latest_reward,
                        "totalTimesteps": total_timesteps,
                        "status": "training",
                    }
                    ws = _ws_send(ws, payload)

            # Parse episode-level log
            m = RE_EPISODE.search(line)
            if m:
                ep_num = int(m.group(1))
                ep_step = int(m.group(2))
                ep_reward = float(m.group(3))

                _training_state["currentTimestep"] = ep_step
                _training_state["currentEpisode"] = ep_num
                _training_state["avgReward"] = ep_reward

                if ws:
                    payload = {
                        "trainingRunId": training_run_id,
                        "currentTimestep": ep_step,
                        "currentEpisode": ep_num,
                        "avgReward": ep_reward,
                        "totalTimesteps": total_timesteps,
                        "status": "training",
                        "eventType": "episodeEnd",
                    }
                    ws = _ws_send(ws, payload)

            # Parse checkpoint save
            m = RE_CHECKPOINT.search(line)
            if m:
                ckpt_path = m.group(1)
                ckpt_name = os.path.basename(ckpt_path)
                if not ckpt_name.endswith(".zip"):
                    ckpt_name += ".zip"
                _post_checkpoint(training_run_id, experiment_id, ckpt_name, latest_step)

            # Parse final save
            m = RE_FINAL_SAVE.search(line)
            if m:
                final_name = m.group(1)
                # Copy final model to shared model dir
                final_src = os.path.join(TRAIN_SCRIPT_DIR, final_name)
                final_dst = os.path.join(MODEL_DIR, final_name)
                try:
                    if os.path.exists(final_src):
                        import shutil
                        shutil.copy2(final_src, final_dst)
                        print(f"📦 [Training] Copied final model to {final_dst}", flush=True)
                except Exception as e:
                    print(f"⚠️ [Training] Failed to copy final model: {e}", flush=True)

                _post_checkpoint(training_run_id, experiment_id, final_name, latest_step)

        # Wait for process to finish
        _training_process.wait()
        exit_code = _training_process.returncode

        # Also copy any checkpoint models to the shared models dir
        try:
            import glob, shutil
            for ckpt in glob.glob(os.path.join(save_path, "*.zip")):
                dst = os.path.join(MODEL_DIR, os.path.basename(ckpt))
                shutil.copy2(ckpt, dst)
                print(f"📦 [Training] Copied {os.path.basename(ckpt)} to {MODEL_DIR}", flush=True)
        except Exception as e:
            print(f"⚠️ [Training] Checkpoint copy error: {e}", flush=True)

        # Send completion status
        final_status = "completed" if exit_code == 0 else "failed"
        print(f"🎓 [Training] Run #{training_run_id} finished: {final_status} (exit={exit_code})", flush=True)

        if ws:
            # Find model file name
            model_file = None
            try:
                import glob
                models = sorted(glob.glob(os.path.join(save_path, "*.zip")))
                if models:
                    model_file = os.path.basename(models[-1])
            except Exception:
                pass

            payload = {
                "trainingRunId": training_run_id,
                "currentTimestep": latest_step,
                "currentEpisode": latest_episode,
                "avgReward": latest_reward,
                "totalTimesteps": total_timesteps,
                "status": final_status,
                "modelFileName": model_file,
            }
            ws = _ws_send(ws, payload)

    except Exception as e:
        print(f"❌ [Training] Worker crashed: {e}", flush=True)
        import traceback
        traceback.print_exc()

        if ws:
            payload = {
                "trainingRunId": training_run_id,
                "status": "failed",
                "error": str(e),
            }
            ws = _ws_send(ws, payload)

    finally:
        _training_state.update({
            "busy": False,
            "trainingRunId": None,
        })
        _training_process = None

        # Clean up shared memory
        os.system("rm -f /dev/shm/*")
        os.system("ipcrm -a 2>/dev/null || true")
        os.system("pkill -9 -f rl-tcp 2>/dev/null || true")

        if ws:
            try:
                ws.close()
            except Exception:
                pass

        print(f"🎓 [Training] Cleanup done for run #{training_run_id}.", flush=True)


def run_training(config: dict):
    """Start training in a background thread."""
    global _training_thread

    if _training_state["busy"]:
        raise RuntimeError("Worker is already busy with a training job")

    _training_thread = threading.Thread(
        target=_training_worker,
        args=(
            config["trainingRunId"],
            config["experimentId"],
            config["totalTimesteps"],
            config.get("learningRate", 3e-4),
            config.get("networkArch", "256,256,128"),
            config.get("bottleneckBw", "2Mbps"),
            config.get("bottleneckDelay", "20ms"),
            config.get("accessBw", "10Mbps"),
            config.get("accessDelay", "20ms"),
            config.get("queueType", "ns3::PfifoFastQueueDisc"),
        ),
        daemon=True,
    )
    _training_thread.start()
    print(f"🎓 [Training] Thread launched for run #{config['trainingRunId']}", flush=True)


def signal_stop_training():
    """Stop the current training subprocess."""
    global _training_process
    print("🛑 [Training] Stop signal received.", flush=True)
    if _training_process is not None:
        try:
            _training_process.terminate()
            _training_process.wait(timeout=10)
        except Exception:
            try:
                _training_process.kill()
            except Exception:
                pass
        _training_process = None
    # Kill any lingering NS-3 processes
    os.system("pkill -9 -f rl-tcp 2>/dev/null || true")
    os.system("rm -f /dev/shm/*")
    os.system("ipcrm -a 2>/dev/null || true")
    print("🛑 [Training] Training stopped and cleaned up.", flush=True)
