import os
from fastapi import APIRouter, HTTPException
from models.dtos import TrainingRequest
from services.training_svc import run_training, signal_stop_training, get_training_status
from services.inference_svc import get_status

WORKER_ID = int(os.environ.get('WORKER_ID', 1))

router = APIRouter()

@router.post("/start-training", tags=["Training"])
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
        "graphJson": req.graphJson,
    }
    run_training(config)
    return {
        "status": "success",
        "message": f"Training started on Worker #{WORKER_ID} for run #{req.trainingRunId}."
    }

@router.post("/stop-training", tags=["Training"])
async def stop_training():
    """Stop the current training job."""
    signal_stop_training()
    return {"status": "success", "message": f"Training stopped on Worker #{WORKER_ID}."}

@router.get("/training-status", tags=["Training"])
async def training_status():
    """Returns current training progress."""
    return get_training_status()
