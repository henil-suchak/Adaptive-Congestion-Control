"""
py_interface.py — Fixed ns3-ai Python Bridge
=============================================
KEY FIXES (macOS Apple Silicon / ARM64):
  1. [DEADLOCK FIX] Acquire() now checks isFinish() AFTER the version
     check in a single atomic-safe loop.
  2. [SLEEP FIX] Polling sleep is 1ms (matches C++ usleep(1000)).
  3. [CONTEXT MANAGER FIX] __exit__ now always calls Release() unless
     the simulation is finished.
  4. [EMPTYINFO FIX] EmptyInfo._fields_ = [] (zero bytes) to match
     C++ void SimInfoType (RLEmptyInfo is NOT used in inference path).
"""

import os
import subprocess
import time
import threading
from ctypes import sizeof

from shm_pool import (
    Init, Reset, ResetAll, RegisterMemory,
    AcquireMemory, AcquireMemoryCond, AcquireMemoryCondFunc,
    AcquireMemoryTarget, FreeMemory, GetMemory,
    GetMemoryVersion, IncMemoryVersion, ReleaseMemory, ReleaseMemoryRB,
)

__all__ = [
    'Init', 'Reset', 'ResetAll',
    'RegisterMemory', 'AcquireMemory', 'ReleaseMemory',
    'GetMemoryVersion', 'IncMemoryVersion',
    'Ns3AIRL', 'Experiment',
]

from ctypes import Structure, c_uint8

# CRITICAL: _fields_ must have 1 byte ('_pad') to match C++ default
# SimInfoType = RLEmptyInfo { uint8_t unused; } (1 byte).
# C++ Ns3AIRL<EnvType, ActType> defaults 3rd param to RLEmptyInfo.
# C++ RegisterMemory size = 57(env) + 8(act) + 1(RLEmptyInfo) + 1(bool) = 67.
# Python must also be 67: 57 + 8 + 1(EmptyInfo) + 1(c_bool) = 67.
# If _fields_ = [] (0 bytes), Python registers 66B vs C++ 67B →
# GetMemory "Size of memory error" abort → no valid pointer → deadlock.
class EmptyInfo(Structure):
    _pack_ = 1
    _fields_ = [('_pad', c_uint8)]   # 1 byte — matches C++ RLEmptyInfo


class Ns3AIRL:
    _MOD = 2
    _RES = 1   # Python acquires when version % 2 == 1

    def __init__(self, uid, EnvType, ActType, ExtInfo=EmptyInfo):
        from ctypes import Structure, c_bool

        class StorageType(Structure):
            _pack_ = 1
            _fields_ = [
                ('env',      EnvType),
                ('act',      ActType),
                ('ext',      ExtInfo),
                ('isFinish', c_bool),
            ]

        self.m_id       = uid
        self.m_size     = sizeof(StorageType)
        self.m_obj      = StorageType.from_address(
                              RegisterMemory(uid, self.m_size)
                          )
        self.finished   = False
        self._lock      = threading.Lock()

    def GetVersion(self):
        return GetMemoryVersion(self.m_id)

    def isFinish(self):
        try:
            return bool(self.m_obj.isFinish)
        except Exception:
            return False

    def Acquire(self):
        while True:
            if self.isFinish():
                with self._lock:
                    self.finished = True
                return None
            if self.GetVersion() % self._MOD == self._RES:
                break
            time.sleep(0.001)
        AcquireMemory(self.m_id)
        return self.m_obj

    def Release(self):
        ReleaseMemory(self.m_id)

    def __enter__(self):
        return self.Acquire()

    def __exit__(self, exc_type, exc_val, exc_tb):
        with self._lock:
            is_finished = self.finished
        if not is_finished:
            self.Release()
        return False


class Experiment:
    def __init__(self, shmKey, memSize, programName, path):
        self.shmKey      = shmKey
        self.memSize     = memSize
        self.programName = programName
        self.path        = os.path.abspath(path)
        self.proc        = None
        Init(shmKey, memSize)

    def run(self, setting=None, show_output=False):
        cmd = self._build_command(setting)
        print(f"[Info] Starting ns-3 simulation...")
        print(f"[Info] Command: {' '.join(cmd)}")
        stdout = None if show_output else subprocess.DEVNULL
        stderr = None if show_output else subprocess.DEVNULL
        self.proc = subprocess.Popen(cmd, cwd=self.path, stdout=stdout, stderr=stderr)
        deadline = time.time() + 5.0
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError(
                    f"[Experiment] ns-3 process exited immediately "
                    f"(returncode={self.proc.returncode}).")
            time.sleep(0.1)
        time.sleep(1.0)
        print(f"[Info] ns-3 started (PID={self.proc.pid})")

    def kill(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try: self.proc.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self.proc.kill(); self.proc.wait()
            print(f"[Info] ns-3 process killed.")
        self.proc = None

    def _build_command(self, setting):
        ns3_root = self.path
        binary = os.path.join(ns3_root, 'build', 'contrib', 'ns3-ai',
                              'examples', 'rl-tcp', 'ns3-dev-rl-tcp-optimized')
        if not os.path.exists(binary):
            binary = os.path.join(ns3_root, 'build', 'scratch', 'rl-tcp', 'rl-tcp')
        if not os.path.exists(binary):
            raise FileNotFoundError(f"Cannot find ns-3 binary: {binary}")
        cmd = [binary]
        if setting:
            for k, v in setting.items():
                cmd.append(f'--{k}={v}')
        return cmd


def run_single_ns3(path, programName, setting=None, show_output=False):
    exp = Experiment(0, 0, programName, path)
    exp.run(setting=setting, show_output=show_output)
    return exp.proc
