import requests
import random
import time
import sys

BACKEND = "http://localhost:8080/api"
USER = f"testuser_{random.randint(1000, 9999)}"
PASS = "password"

print(f"1. Registering user {USER}...")
res = requests.post(f"{BACKEND}/auth/register", json={"username": USER, "email": f"{USER}@test.com", "password": PASS})
res.raise_for_status()
token = res.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

print("2. Creating Custom Topology...")
res = requests.post(f"{BACKEND}/topologies", json={
    "name": "Verification Topology 99",
    "topologyType": "DUMBBELL",
    "bottleneckBandwidthMbps": 99.5,
    "bottleneckDelayMs": 88.5,
    "accessBandwidthMbps": 100.0,
    "accessDelayMs": 10.0,
    "queueType": "RED",
    "graphJson": "{}"
}, headers=headers)
res.raise_for_status()
topo_id = res.json()["id"]
print(f"   Created Topology ID={topo_id}")

print("3. Creating Experiment...")
res = requests.post(f"{BACKEND}/experiments", json={
    "name": "Test Inference Run",
    "topologyId": topo_id,
    "topology": "dumbbell-dual",
    "bottleneckBandwidthMbps": 99.5,
    "baseDelayMs": 88.5,
    "queueType": "RED"
}, headers=headers)
res.raise_for_status()
exp_id = res.json()["experimentId"]
print(f"   Created Experiment ID={exp_id}")

print("4. Starting Experiment...")
requests.post(f"{BACKEND}/experiments/{exp_id}/start", headers=headers).raise_for_status()
print(f"   Experiment {exp_id} RUNNING!")

print("Waiting a few seconds for queue dispatch...")
time.sleep(5)
print("Done. Please check the sidecar logs for 'bottleneckBw=99.5Mbps'.")
