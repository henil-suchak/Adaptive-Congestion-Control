from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI()

# Load trained model
model = joblib.load("model.pkl")

class FlowInput(BaseModel):
    rttMs: float
    packetLossRate: float
    cwndBytes: float
    throughputMbps: float
    sendingRateMbps: float

@app.post("/predict")
def predict(data: FlowInput):

    log_cwnd = np.log1p(data.cwndBytes)

    features = np.array([[
        data.rttMs,
        data.packetLossRate,
        log_cwnd,
        data.throughputMbps,
        data.sendingRateMbps
    ]])

    prediction = model.predict(features)[0]

    return {
        "predictedRateMbps": float(prediction),
        "confidence": 0.95
    }