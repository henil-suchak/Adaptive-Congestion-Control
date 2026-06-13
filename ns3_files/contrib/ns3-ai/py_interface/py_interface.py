import os
import time
import threading
import subprocess
from ctypes import sizeof, Structure, c_uint8

from shm_pool import (
    Init, Reset, ResetAll, RegisterMemory,
    AcquireMemory, AcquireMemoryCond,
    FreeMemory, GetMemory,
    GetMemoryVersion, IncMemoryVersion,
    ReleaseMemory, ReleaseMemoryRB,
)

__all__ = [
    'Init', 'Reset', 'ResetAll',
    'RegisterMemory', 'AcquireMemory', 'ReleaseMemory',
    'GetMemoryVersion', 'IncMemoryVersion',
    'Ns3AIRL', 'Experiment',
]


class EmptyInfo(Structure):
    _pack_ = 1
    _fields_ = [('_pad', c_uint8)]


class Ns3AIRL:
    _MOD = 2
    _RES = 1  # Python acquires when version%2==1

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

        self.m_id     = uid
        self.m_size   = sizeof(StorageType)
        self.m_obj    = StorageType.from_address(
                            RegisterMemory(uid, self.m_size)
                        )
        self.finished = False
        self._lock    = threading.Lock()

    def GetVersion(self):
        return GetMemoryVersion(self.m_id)

    def isFinish(self):
        try:
            return bool(self.m_obj.isFinish)
        except Exception:
            return False

    def Acquire(self):
        # Go straight to blocking C-level spin-wait — no Python pre-check
        # AcquireMemoryCond spins until version%_MOD == _RES
        if self.isFinish():
            with self._lock:
                self.finished = True
            return None
        AcquireMemoryCond(self.m_id, self._MOD, self._RES)
        if self.isFinish():
            with self._lock:
                self.finished = True
            return None
        return self.m_obj

    def Release(self):
        ReleaseMemory(self.m_id)  # increments version: 1→2

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
        stdout = None if show_output else subprocess.DEVNULL
        stderr = None if show_output else subprocess.DEVNULL
        self.proc = subprocess.Popen(
            cmd, cwd=self.path, stdout=stdout, stderr=stderr
        )
        deadline = time.time() + 5.0
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError(
                    f"[Experiment] ns-3 exited immediately "
                    f"(returncode={self.proc.returncode})."
                )
            time.sleep(0.1)
        time.sleep(1.0)
        print(f"[Info] ns-3 started (PID={self.proc.pid})")

    def kill(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
            print("[Info] ns-3 process killed.")
        self.proc = None

    def _build_command(self, setting):
        ns3_root = self.path
        prog = self.programName

        # Search for the binary in multiple possible locations:
        #   1. scratch/{prog}/{prog}          — for scratch modules (inference)
        #   2. contrib/ns3-ai/examples/{prog}/{prog} — for training examples
        #   3. examples/ns3-ai/{prog}/{prog}  — alternate example path
        candidates = [
            os.path.join(ns3_root, 'build', 'scratch', prog, prog),
            os.path.join(ns3_root, 'build', 'contrib', 'ns3-ai', 'examples', prog, prog),
            os.path.join(ns3_root, 'build', 'examples', prog, prog),
        ]

        binary = None
        for path in candidates:
            if os.path.exists(path):
                binary = path
                break

        if binary is None:
            raise FileNotFoundError(
                f"Cannot find ns-3 binary '{prog}' in any of:\n"
                + "\n".join(f"  - {c}" for c in candidates)
            )

        cmd = [binary]
        if setting:
            for k, v in setting.items():
                cmd.append(f'--{k}={v}')
        return cmd