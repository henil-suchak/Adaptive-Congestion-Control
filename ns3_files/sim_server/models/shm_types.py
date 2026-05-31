from ctypes import Structure, c_uint32, c_uint8, c_int64, c_double

class sTcpRlInferenceEnv(Structure):
    _pack_ = 1
    _fields_ = [
        ('nodeId', c_uint32), ('socketUid', c_uint32), ('envType', c_uint8),
        ('simTime_us', c_int64), ('ssThresh', c_uint32), ('cWnd', c_uint32),
        ('segmentSize', c_uint32), ('segmentsAcked', c_uint32),
        ('bytesInFlight', c_uint32), ('rtt_us', c_int64),
        ('throughput', c_double), ('packetLoss', c_uint32),
    ]

class TcpRlInferenceAct(Structure):
    _pack_ = 1
    _fields_ = [('new_ssThresh', c_uint32), ('new_cWnd', c_uint32)]