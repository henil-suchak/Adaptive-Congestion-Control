import sys
import os
# FORCE Python to recognize the current directory as the root for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
import uvicorn

from routers import health, inference, training

# ── Worker Identity (set by Docker Compose per sidecar instance) ──────────
WORKER_ID = int(os.environ.get('WORKER_ID', 1))

app = FastAPI(title=f"NS-3 Sidecar Worker #{WORKER_ID}")

app.include_router(health.router)
app.include_router(inference.router)
app.include_router(training.router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)