import os
import sys
import subprocess
import psutil
from core.state import active_simulations

WAF_DIR = "/sim/ns-allinone-3.35/ns-3.35"

def start_cpp_binary(experiment_id: int, shm_id: int = 2334):
    binary_path = "/sim/ns-allinone-3.35/ns-3.35/build/scratch/rl-tcp-inference/rl-tcp-inference"
    
    # 1. Define the directory where the .so files actually exist
    lib_path = os.path.join(WAF_DIR, "build", "lib")
    
    # 2. Prepare the environment
    custom_env = os.environ.copy()
    
    # 3. Inject the library path so the binary can find its own .so files
    current_ld = custom_env.get("LD_LIBRARY_PATH", "")
    custom_env["LD_LIBRARY_PATH"] = f"{lib_path}:{current_ld}"

    # 4. Pass the dynamic SHM ID to the C++ binary via environment variable
    custom_env["NS3_SHM_ID"] = str(shm_id)

    process = subprocess.Popen(
        [binary_path],
        cwd=WAF_DIR,
        stdout=sys.stdout,
        stderr=sys.stderr,
        env=custom_env
    )
    active_simulations[experiment_id] = process
    print(f"🚀 [Process] Started C++ binary PID={process.pid} for Exp {experiment_id} (SHM={shm_id})", flush=True)
    return process

def kill_cpp_binary(experiment_id: int) -> bool:
    print(f"🛑 [Process] kill_cpp_binary called for Exp {experiment_id}", flush=True)
    print(f"🛑 [Process] Active simulations: {list(active_simulations.keys())}", flush=True)

    if experiment_id in active_simulations:
        process = active_simulations.pop(experiment_id)
        if process and process.poll() is None:
            try:
                parent = psutil.Process(process.pid)
                for child in parent.children(recursive=True):
                    child.kill()
                parent.kill()
                print(f"🛑 [Process] Killed PID={process.pid} and children for Exp {experiment_id}", flush=True)
            except psutil.NoSuchProcess:
                print(f"⚠️ [Process] PID={process.pid} already gone", flush=True)
        else:
            print(f"⚠️ [Process] Process already exited for Exp {experiment_id}", flush=True)

        os.system("pkill -9 -f rl-tcp-inference")
        print(f"🛑 [Process] Hard-killed any remaining rl-tcp-inference processes", flush=True)
        return True

    # Not tracked — still try a hard kill
    print(f"⚠️ [Process] Exp {experiment_id} not in active_simulations, forcing pkill", flush=True)
    os.system("pkill -9 -f rl-tcp-inference")
    return False