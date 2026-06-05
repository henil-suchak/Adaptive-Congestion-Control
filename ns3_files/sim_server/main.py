import sys
import os
# FORCE Python to recognize the current directory as the root for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, BackgroundTasks, HTTPException
import uvicorn

from models.dtos import SimulationRequest
from services.inference_svc import run_inference_loop, signal_stop, get_status

# ── Worker Identity (set by Docker Compose per sidecar instance) ──────────
WORKER_ID = int(os.environ.get('WORKER_ID', 1))

app = FastAPI(title=f"NS-3 Sidecar Worker #{WORKER_ID}")


@app.get("/health")
async def health():
    """Healthcheck endpoint for Docker and monitoring."""
    return {"status": "healthy", "workerId": WORKER_ID}


@app.get("/status")
async def status():
    """Returns whether this sidecar is busy or idle.
    Used by SimulationQueueService to find available workers."""
    info = get_status()
    return {
        "workerId": WORKER_ID,
        "busy": info["busy"],
        "currentExperimentId": info["currentExperimentId"]
    }


@app.post("/start")
async def start_simulation(req: SimulationRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_inference_loop, req)
    return {"status": "success", "message": f"Simulation started on Worker #{WORKER_ID}."}

@app.post("/stop/{experiment_id}")
async def stop_simulation(experiment_id: int):
    # signal_stop() kills the inference subprocess, which kills C++ and cleans shm
    signal_stop()

    # Belt-and-suspenders: force-kill any straggler C++ processes
    os.system("pkill -9 -f rl-tcp-inference")

    # Nuke shared memory from the main process too
    os.system("rm -f /dev/shm/*")
    os.system("ipcrm -a 2>/dev/null || true")

    return {"status": "success", "message": f"Killed NS-3 process on Worker #{WORKER_ID} and cleaned up."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)