import requests
import json

JAVA_BACKEND_URL = "http://backend:8080/api/telemetry"

def send_telemetry(payload: dict):
    try:
        response = requests.post(JAVA_BACKEND_URL, json=payload, timeout=2.0)
        if response.status_code in (200, 201, 204):
            print(
                f"✅ [Telemetry→Backend] HTTP {response.status_code}  "
                f"tput={payload.get('throughputMbps', '?')}  "
                f"rtt={payload.get('rttMs', '?')}",
                flush=True
            )
        else:
            print(
                f"⚠️ [Telemetry] Java rejected: HTTP {response.status_code}  "
                f"body={response.text[:200]}  "
                f"sent={json.dumps(payload)}",
                flush=True
            )
    except Exception as e:
        print(f"❌ [Telemetry] Network error connecting to Java backend: {e}", flush=True)