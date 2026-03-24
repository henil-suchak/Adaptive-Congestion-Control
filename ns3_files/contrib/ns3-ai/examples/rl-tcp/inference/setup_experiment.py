#!/usr/bin/env python3
"""
Run this ONCE before starting inference to set up the database.
Creates experiment ID and flow ID in RUNNING state.

Usage:
    python setup_experiment.py
    python setup_experiment.py --backend http://localhost:8080/api
"""
import argparse
import requests
import sys


def setup(backend_url):
    print(f"[setup] Backend: {backend_url}")

    # 1. Create experiment
    print("[setup] Creating experiment...")
    resp = requests.post(f"{backend_url}/experiments", json={
        "name": "SAC TCP Inference Run",
        "topology": "dumbbell",
        "bottleneckBandwidthMbps": 2.0,
        "baseDelayMs": 20.0,
        "queueType": "FqCoDel"
    })
    if resp.status_code not in (200, 201):
        print(f"[setup] FAILED to create experiment: {resp.status_code} {resp.text}")
        sys.exit(1)
    exp_id = resp.json()["experimentId"]
    print(f"[setup] ✓ Created experiment ID={exp_id}")

    # 2. Start it
    print("[setup] Starting experiment...")
    resp = requests.post(f"{backend_url}/experiments/{exp_id}/start")
    if resp.status_code not in (200, 201, 204):
        print(f"[setup] FAILED to start experiment: {resp.status_code} {resp.text}")
        sys.exit(1)
    print(f"[setup] ✓ Started experiment ID={exp_id} (RUNNING)")

    # 3. Create flow
    print("[setup] Creating flow...")
    resp = requests.post(f"{backend_url}/experiments/{exp_id}/flows", json={
        "sender": "10.1.1.1",
        "receiver": "10.1.3.1",
        "protocol": "TCP-SAC"
    })
    if resp.status_code not in (200, 201):
        print(f"[setup] FAILED to create flow: {resp.status_code} {resp.text}")
        sys.exit(1)
    flow_id = resp.json()["flowId"]
    print(f"[setup] ✓ Created flow ID={flow_id}")

    # 4. Verify
    print(f"\n{'='*50}")
    print(f"  Setup complete!")
    print(f"  experiment_id = {exp_id}")
    print(f"  flow_id       = {flow_id}")
    print(f"{'='*50}")
    print(f"\nNow run inference:")
    print(f"  python run_inference.py \\")
    print(f"    --model ../checkpoints/sac_tcp_1500000_steps.zip \\")
    print(f"    --duration=300 --log_every=20 --post_every=5")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Setup experiment & flow in backend DB")
    parser.add_argument("--backend", type=str, default="http://localhost:8080/api",
                        help="Backend API base URL")
    args = parser.parse_args()
    setup(args.backend)
