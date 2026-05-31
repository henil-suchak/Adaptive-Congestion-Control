from pydantic import BaseModel

class SimulationRequest(BaseModel):
    experimentId: int
    topology: str
    bandwidthMbps: float
    delayMs: float
    simDuration: int
    modelName: str