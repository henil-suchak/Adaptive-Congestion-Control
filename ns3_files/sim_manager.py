import os
import subprocess
import time
import psutil
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Unified NS-3 & ML Manager")

# Global dictionary to track exactly which experiment is running
active_simulations = {}
WAF_DIR = "/sim/ns-allinone-3.35/ns-3.35"

# THIS PERFECTLY MATCHES YOUR JAVA SPRING BOOT PAYLOAD
class SimulationRequest(BaseModel):
    experimentId: int
    topology: str
    bandwidthMbps: float
    delayMs: float
    simDuration: int
    modelName: str
    
def kill_simulation(experiment_id: int):
    """Safely kills the C++ simulation process for a specific experiment."""
    if experiment_id in active_simulations:
        process = active_simulations.pop(experiment_id)
        if process and process.poll() is None:
            try:
                parent = psutil.Process(process.pid)
                for child in parent.children(recursive=True):
                    child.kill()
                parent.kill()
                print(f"🛑 [Manager] C++ Simulation killed for Exp {experiment_id}.")
            except psutil.NoSuchProcess:
                pass
        
        # Absolute safety: kill any lingering waf or ns-3 binaries
        os.system("pkill -9 -f rl-tcp-inference")
        return True
    return False

def run_inference_loop(req: SimulationRequest):
    """The function that starts C++ and connects the Python ML Engine."""
    
    # 1. Start C++ Simulation in the background
    print(f"🚀 [Manager] Starting NS-3 C++ Binary for Exp {req.experimentId}...")
    process = subprocess.Popen(
        ["./waf", "--run", "rl-tcp-inference"], 
        cwd=WAF_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    active_simulations[req.experimentId] = process
    
    print("⏳ [Manager] Waiting 3 seconds for Shared Memory initialization...")
    time.sleep(3)
    
    try:
        import sys
        import numpy as np
        import requests
        from stable_baselines3 import SAC
        from ctypes import Structure, c_uint32, c_uint8, c_int64, c_double
        
        # Add compilation paths
        for p in [os.path.join(WAF_DIR, "contrib", "ns3-ai", "py_interface"), 
                  os.path.join(WAF_DIR, "scratch", "rl-tcp-inference")]:
            if p not in sys.path: sys.path.append(p)
            
        from py_interface import Ns3AIRL, Init
        
        # 2. Define the Memory Structures (Matching your C++ exact layout)
        class sTcpRlInferenceEnv(Structure):
            _pack_ = 1
            _fields_ = [
                ('nodeId', c_uint32), ('socketUid', c_uint32), ('envType', c_uint8),
                ('simTime_us', c_int64), ('ssThresh', c_uint32), ('cWnd', c_uint32),
                ('segmentSize', c_uint32), ('segmentsAcked', c_uint32),
                ('bytesInFlight', c_uint32), ('rtt_us', c_int64),
                ('throughput', c_double), ('packetLoss', c_uint32),
            ]

        class TcpRlInferenceAct(Structure):
            _pack_ = 1
            _fields_ = [('new_ssThresh', c_uint32), ('new_cWnd', c_uint32)]

        print(f"🔌 [Manager] Connecting ML Agent natively for Exp {req.experimentId}...")
        Init(1234, 4096)
        
        # Connect Agent
        agent = Ns3AIRL(1234, sTcpRlInferenceEnv, TcpRlInferenceAct)
        print("✅ [Manager] ML Agent successfully connected and running!")
        
        # 3. Load the specific AI Model
        model_path = os.path.join(WAF_DIR, "models", req.modelName)
        print(f"🧠 [Manager] Loading AI Model: {model_path}...")
        model = SAC.load(model_path, device="cpu")
        
        # Normalization array exactly from your env_wrapper.py
        OBS_MAX = np.array([1_400_000.0, 200_000.0, 250_000.0, 100.0, 1_500.0, 1_400_000.0], dtype=np.float32)
        
        print("📈 [Manager] Starting Telemetry Heartbeat...")
        
        # 4. The Inference Heartbeat Loop
        while True:
            with agent as data:
                # Check if C++ simulation is finished
                if data is None or agent.isFinish():
                    break
                    
                cWnd = data.env.cWnd
                seg_size = max(data.env.segmentSize, 340)

                # Format the observation for the Neural Network
                raw_obs = np.array([
                    cWnd, data.env.rtt_us, data.env.throughput, 
                    data.env.packetLoss, seg_size, data.env.bytesInFlight
                ], dtype=np.float32)
                
                normalized_obs = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                
                # AI makes a prediction
                action, _ = model.predict(normalized_obs, deterministic=True)
                
                # Denormalize action back into TCP logic
                factor = float(np.clip(action[0], 0.8, 1.2))
                MAX_CWND = seg_size * 1000
                new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
                
                if factor < 1.0:
                    new_ssThresh = int(new_cWnd * 0.75)
                else:
                    new_ssThresh = min(int(new_cWnd * 2), MAX_CWND * 2)

                # Write action instantly to C++ kernel
                data.act.new_cWnd = new_cWnd
                data.act.new_ssThresh = new_ssThresh
                
                # 5. Send Live Telemetry to Java Backend via HTTP
                try:
                    payload = {
                        "experimentId": req.experimentId,
                        "cwndBytes": float(cWnd),
                        "rttMs": float(data.env.rtt_us / 1000.0),
                        "throughputMbps": float((data.env.throughput * 8) / 1_000_000.0),
                        "packetLossRate": float(data.env.packetLoss)
                    }
                    # Send to backend (timeout prevents Python from slowing down C++)
                    requests.post("http://backend:8080/api/telemetry", json=payload, timeout=0.1)
                except Exception:
                    pass # Silently drop the telemetry frame if Java is lagging
                    
        print(f"🏁 [Manager] Experiment {req.experimentId} Finished!")

    except Exception as e:
        print(f"❌ [Manager] Loop crashed: {e}")
        kill_simulation(req.experimentId)

# ROUTE MATCHES JAVA BACKEND: /start
@app.post("/start")
async def start_simulation(req: SimulationRequest, background_tasks: BackgroundTasks):
    if req.experimentId in active_simulations:
        raise HTTPException(status_code=400, detail=f"Experiment {req.experimentId} is already running.")
    
    # Run the simulation loop in the background so we can immediately return a success response to Java
    background_tasks.add_task(run_inference_loop, req)
    return {"status": "success", "message": f"Simulation {req.experimentId} started in background."}

# ROUTE MATCHES JAVA BACKEND: /stop/{experimentId}
@app.post("/stop/{experiment_id}")
async def stop_simulation(experiment_id: int):
    success = kill_simulation(experiment_id)
    if success:
        return {"status": "success", "message": f"Killed NS-3 process for Exp {experiment_id}"}
    
    os.system("pkill -9 -f rl-tcp-inference")
    return {"status": "error", "message": f"Simulation {experiment_id} not found in tracking, but hard cleanup was forced."}

@app.get("/status")
async def get_status():
    return {"active_experiments": list(active_simulations.keys())}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)