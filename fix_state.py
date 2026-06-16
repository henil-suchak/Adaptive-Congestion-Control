import re

with open('ns3_files/sim_server/services/inference_svc.py', 'r') as f:
    content = f.read()

# Replace the fast fail
content = content.replace(
"""        if graph_json and '"algorithm":"SAC"' not in graph_json.replace(" ", ""):
            print("⚠️ [Worker] No SAC Agent found in topology! Inference requires an SAC Agent.", flush=True)
            print("🏁 [Worker] C++ signaled simulation end.", flush=True)
            _inference_state.update({"busy": False, "status": "failed"})
            return""",
"""        if graph_json and '"algorithm":"SAC"' not in graph_json.replace(" ", ""):
            print("⚠️ [Worker] No SAC Agent found in topology! Inference requires an SAC Agent.", flush=True)
            print("🏁 [Worker] C++ signaled simulation end.", flush=True)
            return"""
)

# Replace the while loop condition
content = content.replace(
"""        while True:
            # Check for stop signal or C++ process death
            if not _inference_state["busy"]:
                print("🛑 [Inference] Stop signal received.", flush=True)
                break
            if process.poll() is not None:
                print("🏁 [Worker] C++ process ended.", flush=True)
                break""",
"""        while True:
            # Check for C++ process death (parent kills this worker on stop)
            if process.poll() is not None:
                print("🏁 [Worker] C++ process ended.", flush=True)
                break"""
)

with open('ns3_files/sim_server/services/inference_svc.py', 'w') as f:
    f.write(content)
