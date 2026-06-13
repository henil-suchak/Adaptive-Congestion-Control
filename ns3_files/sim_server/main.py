import sys
import os
# FORCE Python to recognize the current directory as the root for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, BackgroundTasks, HTTPException
import uvicorn

from models.dtos import SimulationRequest, TrainingRequest
from services.inference_svc import run_inference_loop, signal_stop, get_status
from services.training_svc import run_training, signal_stop_training, get_training_status

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
    Used by SimulationQueueService and TrainingQueueService to find available workers."""
    inference_info = get_status()
    training_info = get_training_status()

    # Busy if EITHER inference or training is running
    is_busy = inference_info["busy"] or training_info["busy"]

    return {
        "workerId": WORKER_ID,
        "busy": is_busy,
        "currentExperimentId": inference_info["currentExperimentId"],
        "trainingRunId": training_info.get("trainingRunId"),
        "mode": "training" if training_info["busy"] else ("inference" if inference_info["busy"] else "idle"),
    }


# ── Inference Endpoints ──────────────────────────────────────────────────────

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


# ── Training Endpoints ───────────────────────────────────────────────────────

@app.post("/start-training")
async def start_training(req: TrainingRequest):
    """Start a training job on this sidecar."""
    training_info = get_training_status()
    inference_info = get_status()

    if training_info["busy"] or inference_info["busy"]:
        raise HTTPException(
            status_code=409,
            detail=f"Worker #{WORKER_ID} is busy. Cannot start training."
        )

    config = {
        "trainingRunId": req.trainingRunId,
        "experimentId": req.experimentId,
        "totalTimesteps": req.totalTimesteps,
        "learningRate": req.learningRate,
        "networkArch": req.networkArch,
        "bottleneckBw": f"{req.bandwidthMbps}Mbps",
        "bottleneckDelay": f"{req.delayMs}ms",
        "accessBw": f"{req.accessBandwidthMbps}Mbps",
        "accessDelay": f"{req.accessDelayMs}ms",
        "queueType": req.queueType,
    }
    run_training(config)
    return {
        "status": "success",
        "message": f"Training started on Worker #{WORKER_ID} for run #{req.trainingRunId}."
    }


@app.post("/stop-training")
async def stop_training():
    """Stop the current training job."""
    signal_stop_training()
    return {"status": "success", "message": f"Training stopped on Worker #{WORKER_ID}."}


@app.get("/training-status")
async def training_status():
    """Returns current training progress."""
    return get_training_status()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)