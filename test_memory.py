from ctypes import *

class sTcpRlInferenceEnv(Structure):
    _fields_ = [
        ('nodeId', c_uint32),
        ('socketUid', c_uint32),
        ('envType', c_uint8),
        ('simTime_us', c_int64),
        ('ssThresh', c_uint32),
        ('cWnd', c_uint32),
        ('segmentSize', c_uint32),
        ('segmentsAcked', c_uint32),
        ('bytesInFlight', c_uint32),
        ('rtt_us', c_int64),
        ('throughput', c_double),
        ('packetLoss', c_uint32)
    ]

class TcpRlInferenceAct(Structure):
    _fields_ = [
        ('new_ssThresh', c_uint32),
        ('new_cWnd', c_uint32)
    ]

class EmptyInfo(Structure):
    _pack_ = 1
    _fields_ = [('_pad', c_uint8)]

class StorageType(Structure):
    _fields_ = [
        ('env',      sTcpRlInferenceEnv),
        ('act',      TcpRlInferenceAct),
        ('ext',      EmptyInfo),
        ('isFinish', c_bool),
    ]

print("--- ARM64 Memory Map ---")
print(f"Env Size: {sizeof(sTcpRlInferenceEnv)}")
print(f"Act Size: {sizeof(TcpRlInferenceAct)}")
print(f"Ext Size: {sizeof(EmptyInfo)}")
print(f"isFinish Size: {sizeof(c_bool)}")
print(f"TOTAL StorageType Size: {sizeof(StorageType)}")