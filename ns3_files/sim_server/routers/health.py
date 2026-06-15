import os
from fastapi import APIRouter
from services.inference_svc import get_status
from services.training_svc import get_training_status

# Worker Identity
WORKER_ID = int(os.environ.get('WORKER_ID', 1))

router = APIRouter()

@router.get("/health", tags=["Monitoring"])
async def health():
    """Healthcheck endpoint for Docker and monitoring."""
    return {"status": "healthy", "workerId": WORKER_ID}

@router.get("/status", tags=["Monitoring"])
async def status():
    """Returns whether this sidecar is busy or idle."""
    inference_info = get_status()
    training_info = get_training_status()

    is_busy = inference_info["busy"] or training_info["busy"]

    return {
        "workerId": WORKER_ID,
        "busy": is_busy,
        "currentExperimentId": inference_info["currentExperimentId"],
        "trainingRunId": training_info.get("trainingRunId"),
        "mode": "training" if training_info["busy"] else ("inference" if inference_info["busy"] else "idle"),
    }
