import sys
import os
# FORCE Python to recognize the current directory as the root for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, BackgroundTasks, HTTPException
import uvicorn

from models.dtos import SimulationRequest
from services.inference_svc import run_inference_loop, signal_stop

app = FastAPI(title="Unified NS-3 & ML Manager")



@app.post("/start")
async def start_simulation(req: SimulationRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_inference_loop, req)
    return {"status": "success", "message": "Simulation started."}

@app.post("/stop/{experiment_id}")
async def stop_simulation(experiment_id: int):
    # signal_stop() kills the inference subprocess, which kills C++ and cleans shm
    signal_stop()

    # Belt-and-suspenders: force-kill any straggler C++ processes
    os.system("pkill -9 -f rl-tcp-inference")

    # Nuke shared memory from the main process too
    os.system("rm -f /dev/shm/*")
    os.system("ipcrm -a 2>/dev/null || true")

    return {"status": "success", "message": "Killed NS-3 process and cleaned up."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)