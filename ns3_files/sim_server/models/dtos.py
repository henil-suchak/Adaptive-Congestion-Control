from pydantic import BaseModel

class SimulationRequest(BaseModel):
    experimentId: int
    topology: str
    bandwidthMbps: float
    delayMs: float
    simDuration: int
    modelName: str

class TrainingRequest(BaseModel):
    trainingRunId: int
    experimentId: int
    totalTimesteps: int
    learningRate: float = 3e-4
    networkArch: str = "256,256,128"