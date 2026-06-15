from ctypes import Structure, c_uint32, c_uint8, c_int64, c_double, c_uint16

MAX_AGENTS = 10

class sTcpRlInferenceEnv(Structure):
    _pack_ = 1
    _fields_ = [
        ('numAgents', c_uint16),
        ('nodeId', c_uint32 * MAX_AGENTS),
        ('socketUid', c_uint32 * MAX_AGENTS),
        ('envType', c_uint8 * MAX_AGENTS),
        ('simTime_us', c_int64),
        ('ssThresh', c_uint32 * MAX_AGENTS),
        ('cWnd', c_uint32 * MAX_AGENTS),
        ('segmentSize', c_uint32 * MAX_AGENTS),
        ('segmentsAcked', c_uint32 * MAX_AGENTS),
        ('bytesInFlight', c_uint32 * MAX_AGENTS),
        ('rtt_us', c_int64 * MAX_AGENTS),
        ('throughput', c_double * MAX_AGENTS),
        ('packetLoss', c_uint32 * MAX_AGENTS),
    ]

class TcpRlInferenceAct(Structure):
    _pack_ = 1
    _fields_ = [
        ('new_ssThresh', c_uint32 * MAX_AGENTS),
        ('new_cWnd', c_uint32 * MAX_AGENTS)
    ]