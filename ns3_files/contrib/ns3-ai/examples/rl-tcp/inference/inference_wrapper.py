#!/usr/bin/env python3
import ctypes, sys, os, time

# Auto-detect ns3 root: Docker container or local
NS3_ROOT = os.environ.get('NS3_ROOT', '/sim/ns-allinone-3.35/ns-3.35')
sys.path.insert(0, os.path.join(NS3_ROOT, 'contrib/ns3-ai/py_interface'))
from py_interface import Ns3AIRL, AcquireMemoryCond, ReleaseMemory

class sTcpRlInferenceEnv(ctypes.Structure):
    _pack_ = 1
    _fields_ = [
        ('nodeId',        ctypes.c_uint32),   # 4
        ('socketUid',     ctypes.c_uint32),   # 4
        ('envType',       ctypes.c_uint8),    # 1
        ('simTime_us',    ctypes.c_int64),    # 8
        ('ssThresh',      ctypes.c_uint32),   # 4
        ('cWnd',          ctypes.c_uint32),   # 4
        ('segmentSize',   ctypes.c_uint32),   # 4
        ('segmentsAcked', ctypes.c_uint32),   # 4
        ('bytesInFlight', ctypes.c_uint32),   # 4
        ('rtt_us',        ctypes.c_int64),    # 8
        ('throughput',    ctypes.c_double),   # 8
        ('packetLoss',    ctypes.c_uint32),   # 4
    ]                                         # = 57 bytes total

class TcpRlInferenceAct(ctypes.Structure):
    _pack_ = 1
    _fields_ = [
        ('new_ssThresh', ctypes.c_uint32),    # 4
        ('new_cWnd',     ctypes.c_uint32),    # 4
    ]                                         # = 8 bytes total

# Sanity check: sizes must match C++ exactly
_env_size = ctypes.sizeof(sTcpRlInferenceEnv)
_act_size = ctypes.sizeof(TcpRlInferenceAct)
_expected_data = 67  # 57 env + 8 act + 1 EmptyInfo + 1 bool
_actual_data   = _env_size + _act_size + 1 + 1
assert _actual_data == _expected_data, (
    f"[FATAL] Struct size mismatch! Python data={_actual_data}B, "
    f"C++ data={_expected_data}B  (env={_env_size}, act={_act_size})"
)
print(f"[size-check] env={_env_size}B  act={_act_size}B  total-data={_actual_data}B  ✓", flush=True)


class InferenceWrapper:
    def __init__(self, shm_id=2333, shm_size=74):
        self.shm_id = shm_id
        self.var    = Ns3AIRL(shm_id, sTcpRlInferenceEnv, TcpRlInferenceAct)
        self._obj   = self.var.m_obj
        print(f"[InferenceWrapper] registered shm_id={shm_id}  "
              f"env={_env_size}B  act={_act_size}B  ready", flush=True)

    def step(self, new_ssThresh, new_cWnd):
        # Spin until it is Python's turn (version % 2 == 1)
        while True:
            if self.var.isFinish():
                return None
            if self.var.GetVersion() % 2 == 1:
                break
            time.sleep(0.001)

        AcquireMemoryCond(self.shm_id, 2, 1)

        if self.var.isFinish():
            ReleaseMemory(self.shm_id)
            return None

        obj = self._obj
        snapshot = {
            'nodeId':        obj.env.nodeId,
            'socketUid':     obj.env.socketUid,
            'envType':       obj.env.envType,
            'simTime_us':    obj.env.simTime_us,
            'ssThresh':      obj.env.ssThresh,
            'cWnd':          obj.env.cWnd,
            'segmentSize':   max(obj.env.segmentSize, 340),
            'segmentsAcked': obj.env.segmentsAcked,
            'bytesInFlight': obj.env.bytesInFlight,
            'rtt_us':        obj.env.rtt_us,
            'throughput':    obj.env.throughput,
            'packetLoss':    obj.env.packetLoss,
        }
        obj.act.new_ssThresh = int(new_ssThresh)
        obj.act.new_cWnd     = int(new_cWnd)
        ReleaseMemory(self.shm_id)
        return snapshot

    def is_finished(self):
        return self.var.isFinish()

    def close(self):
        try:
            from py_interface import ResetAll
            ResetAll()
        except Exception:
            pass
