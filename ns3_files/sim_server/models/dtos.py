from pydantic import BaseModel

class SimulationRequest(BaseModel):
    experimentId: int
    topology: str
    bandwidthMbps: float
    delayMs: float
    accessBandwidthMbps: float = 10.0
    accessDelayMs: float = 20.0
    queueType: str = "FqCoDel"
    mtu: int = 400
    simDuration: int
    modelName: str

class TrainingRequest(BaseModel):
    trainingRunId: int
    experimentId: int
    totalTimesteps: int
    learningRate: float = 3e-4
    networkArch: str = "256,256,128"
    bandwidthMbps: float = 2.0
    delayMs: float = 20.0
    accessBandwidthMbps: float = 10.0
    accessDelayMs: float = 20.0
    queueType: str = "ns3::PfifoFastQueueDisc"