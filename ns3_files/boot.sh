#!/bin/bash
echo "🚀 [1/3] Starting NS-3 C++ Simulation in the background..."
cd /sim/ns-allinone-3.35/ns-3.35
./waf --run rl-tcp-inference &

echo "⏳ [2/3] Waiting 3 seconds for native memory pool to initialize..."
sleep 3

echo "🐍 [3/3] Starting Python ML Engine API..."
# Assuming your FastAPI app is in the ml-engine-python folder
cd /sim/ml-engine
uvicorn main:app --host 0.0.0.0 --port 5000