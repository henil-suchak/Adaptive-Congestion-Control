"""
Telemetry Service — Queue + WebSocket sender.

Decouples the AI inference loop from network I/O:
  - The loop calls enqueue() which returns in microseconds.
  - A background thread drains the queue and streams data
    through a persistent WebSocket to the Java backend.
"""

import json
import queue
import threading
import time
import websocket

BACKEND_WS_URL = "ws://backend:8080/ws/telemetry-ingest"

# How many seconds to wait before retrying a broken connection
_RECONNECT_DELAY = 2.0


class TelemetrySender:
    """Manages a local queue and a persistent WebSocket connection."""

    def __init__(self):
        self._queue = queue.Queue(maxsize=500)
        self._ws = None
        self._thread = None
        self._running = False

    # ── Public API (called by the inference loop) ────────────────────────

    def start(self):
        """Spin up the background consumer thread."""
        self._running = True
        self._thread = threading.Thread(target=self._consumer_loop, daemon=True)
        self._thread.start()
        print("📡 [Telemetry] Consumer thread started.", flush=True)

    def enqueue(self, payload: dict):
        """Drop a metric into the queue. Non-blocking, near-instant."""
        try:
            self._queue.put_nowait(payload)
        except queue.Full:
            print("⚠️ [Telemetry] Queue full — dropping payload.", flush=True)

    def stop(self):
        """Gracefully shut down the consumer thread and close WebSocket."""
        self._running = False
        # Push a poison pill so the blocking .get() wakes up
        self._queue.put_nowait(None)
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
        print("📡 [Telemetry] Consumer stopped.", flush=True)

    # ── Internal: background thread ──────────────────────────────────────

    def _connect(self):
        """Open (or reopen) the WebSocket connection to Java backend."""
        while self._running:
            try:
                self._ws = websocket.create_connection(
                    BACKEND_WS_URL,
                    timeout=5
                )
                print(f"📡 [Telemetry] WebSocket connected to {BACKEND_WS_URL}", flush=True)
                return
            except Exception as e:
                print(
                    f"⚠️ [Telemetry] WebSocket connect failed: {e}. "
                    f"Retrying in {_RECONNECT_DELAY}s...",
                    flush=True
                )
                time.sleep(_RECONNECT_DELAY)

    def _consumer_loop(self):
        """
        Infinite loop: pull from queue → send via WebSocket.
        Reconnects automatically if the pipe breaks.
        """
        self._connect()

        while self._running:
            payload = self._queue.get()

            # Poison pill — time to exit
            if payload is None:
                break

            json_str = json.dumps(payload)

            try:
                self._ws.send(json_str)
            except Exception as e:
                print(f"⚠️ [Telemetry] WebSocket send failed: {e}. Reconnecting...", flush=True)
                self._connect()
                # Retry the failed message after reconnect
                try:
                    self._ws.send(json_str)
                except Exception:
                    print("❌ [Telemetry] Retry failed, dropping payload.", flush=True)

        # Cleanup
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass