import os
from fastapi import APIRouter, BackgroundTasks
from models.dtos import SimulationRequest
from services.inference_svc import run_inference_loop, signal_stop

WORKER_ID = int(os.environ.get('WORKER_ID', 1))

router = APIRouter()

@router.post("/start", tags=["Inference"])
async def start_simulation(req: SimulationRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_inference_loop, req)
    return {"status": "success", "message": f"Simulation started on Worker #{WORKER_ID}."}

@router.post("/stop/{experiment_id}", tags=["Inference"])
async def stop_simulation(experiment_id: int):
    # signal_stop() kills the inference subprocess, which kills C++ and cleans shm
    signal_stop()

    # Belt-and-suspenders: force-kill any straggler C++ processes
    os.system("pkill -9 -f rl-tcp-inference")

    # Nuke shared memory from the main process too
    os.system("rm -f /dev/shm/*")
    os.system("ipcrm -a 2>/dev/null || true")

    return {"status": "success", "message": f"Killed NS-3 process on Worker #{WORKER_ID} and cleaned up."}
