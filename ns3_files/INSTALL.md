# ns-3 Simulation Files — Setup Instructions

These files are the **project-specific** source code for the ns-3.35 simulation.  
ns-3 itself is **NOT** included in this repo (it's 500MB+). You must download it separately.

## Prerequisites

- **Linux or macOS** (ns-3 does NOT run on native Windows — use WSL2)
- GCC/Clang, Python 3.9+, `pip`

## Step-by-Step Setup

### 1. Download & Extract ns-3.35

```bash
wget https://www.nsnam.org/releases/ns-allinone-3.35.tar.bz2
tar xjf ns-allinone-3.35.tar.bz2
cd ns-allinone-3.35/ns-3.35
```

### 2. Copy Project Files Into ns-3

From the **repository root**, run:

```bash
# Inference simulation (C++)
cp -r ns3_files/scratch/rl-tcp-inference \
     ns-allinone-3.35/ns-3.35/scratch/

# Python interface + inference scripts + training files + checkpoints
cp -r ns3_files/contrib/ns3-ai \
     ns-allinone-3.35/ns-3.35/contrib/
```

### 3. Create Python Virtual Environment

```bash
cd ns-allinone-3.35/ns-3.35
python3 -m venv ns3env
source ns3env/bin/activate
pip install stable_baselines3 numpy requests
```

### 4. Compile the Shared Memory Module (Platform-Specific)

```bash
cd contrib/ns3-ai/py_interface
# If setup.py exists:
python setup.py build_ext --inplace
# Otherwise, the .so will be generated during ns-3 build
```

### 5. Build ns-3

```bash
cd ns-allinone-3.35/ns-3.35
./waf configure --enable-examples
./waf build
```

### 6. Run Inference

```bash
# Terminal 1 — Start the backend first (from repo root)
mvn spring-boot:run

# Terminal 2 — Setup experiment in backend DB
cd ns-allinone-3.35/ns-3.35
source ns3env/bin/activate
python contrib/ns3-ai/examples/rl-tcp/inference/setup_experiment.py

# Terminal 3 — Run inference
python contrib/ns3-ai/examples/rl-tcp/inference/run_inference.py \
  --model contrib/ns3-ai/examples/rl-tcp/checkpoints/sac_tcp_1500000_steps.zip \
  --duration=300 --log_every=20 --post_every=5
```

## Windows Users (WSL2)

1. Install WSL2: `wsl --install -d Ubuntu-22.04`
2. Inside WSL2, follow all steps above
3. The backend (Java) and frontend (React) can run natively on Windows
4. To connect WSL2 Python → Windows backend: use `http://$(hostname).local:8080/api` or `http://localhost:8080/api`
