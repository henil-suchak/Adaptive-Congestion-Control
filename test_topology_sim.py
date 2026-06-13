import requests
import json
import time

payload = {
    "experimentId": 999,
    "topology": "CUSTOM",
    "bandwidthMbps": 5.5,
    "delayMs": 15.0,
    "accessBandwidthMbps": 50.0,
    "accessDelayMs": 5.0,
    "queueType": "CoDel",
    "mtu": 1500,
    "simDuration": 10,
    "modelName": "sac_baseline_v1"
}

print("Dispatching simulation request to ns3-sim-1...")
try:
    resp = requests.post("http://localhost:8001/simulate", json=payload)
    print("Response status:", resp.status_code)
    print("Response JSON:", resp.json())
except Exception as e:
    print("Error:", e)
