
# Adaptive TCP Congestion Control using Deep Reinforcement Learning

A research project that uses a **Soft Actor-Critic (SAC)** reinforcement learning agent to dynamically control TCP congestion window size, trained and evaluated using **ns-3** network simulation. Includes a **Spring Boot** backend for data persistence and a **React** dashboard for real-time visualization.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Dashboard                         │
│                  (Recharts + STOMP WebSocket)                  │
│                     http://localhost:3000                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │  WebSocket /ws + REST /api
┌──────────────────────────▼──────────────────────────────────────┐
│                   Spring Boot Backend                          │
│          (JPA + H2/PostgreSQL + WebSocket)                     │
│                     http://localhost:8080                       │
└──────────────────────────▲──────────────────────────────────────┘
                           │  HTTP POST /api/flows/{id}/metrics
┌──────────────────────────┴──────────────────────────────────────┐
│              Python Inference Script                            │
│     (stable_baselines3 SAC model + inference_wrapper)          │
└──────────────────────────▲──────────────────────────────────────┘
                           │  Shared Memory (SysV shmget/shmat)
┌──────────────────────────┴──────────────────────────────────────┐
│              ns-3.35 Network Simulation                        │
│      (C++ — dumbbell topology, FqCoDel queue)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Spring Boot 3.2, Maven, JPA/Hibernate, H2 (dev) / PostgreSQL (prod) |
| Frontend | React 19, Recharts, STOMP WebSocket, Tailwind CSS |
| Simulation | ns-3.35 (C++), Python 3.9, stable_baselines3, NumPy |
| RL Agent | SAC (Soft Actor-Critic), trained for 1.5M steps |

## Prerequisites

### macOS / Linux

| Tool | Version | Install |
|------|---------|---------|
| Java JDK | 17+ | `brew install openjdk@17` |
| Maven | 3.8+ | `brew install maven` |
| Node.js | 18+ | `brew install node` |
| Python | 3.9+ | `brew install python@3.9` |
| GCC/Clang | Any recent | `xcode-select --install` (macOS) |

### Windows

> **Important:** ns-3 does **NOT** run on native Windows.

- **Backend & Frontend**: Run natively — install Java 17, Maven, Node.js
- **ns-3 Simulation**: Install **WSL2** with Ubuntu 22.04 (see [Windows Setup](#windows-specific-setup))

## Repository Structure

```
CongestionControl/
├── pom.xml                          ← Maven build (Spring Boot backend)
├── src/                             ← Spring Boot backend source
│   └── main/
│       ├── java/com/HAJ/congestion/
│       │   ├── Main.java            ← Application entry point
│       │   ├── config/              ← WebSocket configuration
│       │   ├── controller/          ← REST API controllers
│       │   ├── entity/              ← JPA entities
│       │   ├── repository/          ← Spring Data repositories
│       │   ├── service/             ← Business logic interfaces
│       │   │   └── implementation/  ← Service implementations
│       │   ├── DTO/                 ← Data transfer objects
│       │   └── ML/                  ← ML prediction service
│       └── resources/
│           ├── application.yml      ← Active config (H2)
│           └── application.yml.example  ← Template config
├── frontend/                        ← React dashboard
│   ├── package.json
│   ├── src/
│   │   ├── components/              ← Dashboard UI components
│   │   └── hooks/                   ← Custom React hooks
│   └── tailwind.config.js
├── ns3_files/                       ← Simulation source files (portable)
│   ├── INSTALL.md                   ← Setup instructions
│   ├── scratch/rl-tcp-inference/    ← C++ inference simulation
│   └── contrib/ns3-ai/
│       ├── py_interface/            ← Python ↔ ns-3 shared memory
│       └── examples/rl-tcp/
│           ├── inference/           ← Python inference scripts
│           ├── checkpoints/         ← Trained SAC model (1.5M steps)
│           ├── train_sac.py         ← Training script
│           └── *.cc, *.h            ← Training env source
└── .gitignore
```

## Setup Instructions

### 1. Backend (Spring Boot)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/CongestionControl.git
cd CongestionControl

# (Optional) Configure database — default is H2 (no setup needed)
# For PostgreSQL, copy and edit the example config:
cp src/main/resources/application.yml.example src/main/resources/application.yml
# Then edit application.yml with your PostgreSQL credentials

# Build and run
mvn spring-boot:run
```

The backend starts at `http://localhost:8080`.

**Verify it works:**
- H2 Console: http://localhost:8080/h2-console (JDBC URL: `jdbc:h2:file:./data/congestion-db`, user: `sa`, no password)
- API: http://localhost:8080/api/metrics/latest

### 2. Frontend (React)

```bash
cd frontend
npm install
npm start
```

Opens at `http://localhost:3000`. Connects to backend via WebSocket at `ws://localhost:8080/ws`.

### 3. ns-3 Simulation (Linux / macOS / WSL2 only)

See [ns3_files/INSTALL.md](ns3_files/INSTALL.md) for detailed instructions.

**Quick start:**
```bash
# Download ns-3.35 (NOT included in repo — 500MB+)
wget https://www.nsnam.org/releases/ns-allinone-3.35.tar.bz2
tar xjf ns-allinone-3.35.tar.bz2

# Copy project files into ns-3
cp -r ns3_files/scratch/rl-tcp-inference ns-allinone-3.35/ns-3.35/scratch/
cp -r ns3_files/contrib/ns3-ai ns-allinone-3.35/ns-3.35/contrib/

# Create Python environment
cd ns-allinone-3.35/ns-3.35
python3 -m venv ns3env && source ns3env/bin/activate
pip install stable_baselines3 numpy requests

# Build ns-3
./waf configure --enable-examples && ./waf build
```

## Running the Full Pipeline

Open **3 terminals**:

```bash
# Terminal 1 — Backend
cd CongestionControl
mvn spring-boot:run

# Terminal 2 — Frontend
cd CongestionControl/frontend
npm start

# Terminal 3 — Inference (inside ns-3 directory)
cd ns-allinone-3.35/ns-3.35
source ns3env/bin/activate
python contrib/ns3-ai/examples/rl-tcp/inference/setup_experiment.py
python contrib/ns3-ai/examples/rl-tcp/inference/run_inference.py \
  --model contrib/ns3-ai/examples/rl-tcp/checkpoints/sac_tcp_1500000_steps.zip \
  --duration=300 --log_every=20 --post_every=5
```

Then open **http://localhost:3000** to view the live dashboard.

## Windows-Specific Setup

### Install WSL2

```powershell
# In PowerShell (Admin)
wsl --install -d Ubuntu-22.04
```

After restart, open Ubuntu terminal and install dependencies:

```bash
sudo apt update && sudo apt install -y build-essential gcc g++ python3 python3-pip python3-venv
```

### What Runs Where

| Component | Runs On | Notes |
|-----------|---------|-------|
| Spring Boot Backend | Windows (native) | Needs Java 17+ and Maven |
| React Frontend | Windows (native) | Needs Node.js 18+ |
| PostgreSQL | Windows (native) | Alternative to H2 |
| ns-3 Simulation | WSL2 only | Linux system calls required |
| Python Inference | WSL2 only | Needs shared memory (SysV) |

### Connecting WSL2 to Windows Backend

From inside WSL2, access the Windows backend at:
```bash
# Use localhost (WSL2 automatically bridges to Windows)
python setup_experiment.py --backend http://localhost:8080/api
```

### Platform-Specific Files (DO NOT share)

These files are **platform-specific** and must be rebuilt on each machine:
- `shm_pool.cpython-*.so` — Compiled C extension (rebuild with `python setup.py build_ext --inplace`)
- `ns3env/` — Python virtual environment (recreate with `python3 -m venv ns3env`)
- ns-3 `build/` directory — Compiled C++ binaries (rebuild with `./waf build`)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/experiments` | Create experiment |
| POST | `/api/experiments/{id}/start` | Start experiment |
| POST | `/api/experiments/{id}/end` | End experiment |
| GET | `/api/experiments/{id}` | Get experiment |
| POST | `/api/experiments/{id}/flows` | Create flow |
| GET | `/api/experiments/{id}/flows` | List flows |
| GET | `/api/flows/{id}` | Get flow |
| POST | `/api/flows/{id}/metrics` | Record metric |
| GET | `/api/flows/{id}/metrics` | Get flow metrics |
| GET | `/api/metrics/latest` | Latest metrics |
| GET | `/api/experiments/{id}/metrics` | Experiment metrics |
| WS | `/ws` | STOMP WebSocket endpoint |

## Project Results

- **Training**: SAC agent trained for **1,500,000 steps** on dumbbell topology
- **Model**: `ns3_files/contrib/ns3-ai/examples/rl-tcp/checkpoints/sac_tcp_1500000_steps.zip`
- **Inference Results**: Avg RTT ~124ms, Avg throughput 0.18–0.24 Mbps
- **Topology**: Dumbbell (2 Mbps bottleneck, 20ms base delay, FqCoDel queue)

## Team

HAJ Research Group


