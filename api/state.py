import sys
import os
import queue
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Vribbels'))

from optimizer import GearOptimizer


class AppState:
    def __init__(self):
        self.optimizer = GearOptimizer()
        self.data_loaded: bool = False
        self.loaded_file: str | None = None

        # Capture state
        self.capture_running: bool = False
        self.capture_region: str = "global"
        self.rescue_file_path: str | None = None
        self.log_queue: queue.SimpleQueue = queue.SimpleQueue()

        # CaptureManager is created lazily on first start
        self._capture_manager = None

    def get_capture_manager(self):
        """Return existing manager or create a new one for this session."""
        if self._capture_manager is None:
            from capture.manager import CaptureManager
            from capture.constants import OUTPUT_DIR

            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

            def _log(msg: str, tag: str | None = None):
                if tag in ("error", "success", "warning", "info"):
                    level = tag
                else:
                    level = "info"
                    msg_lower = msg.lower()
                    if msg_lower.startswith("error") or "failed" in msg_lower:
                        level = "error"
                    elif "saved:" in msg_lower or msg_lower.startswith("[live]"):
                        level = "success"
                    elif "warning" in msg_lower:
                        level = "warning"
                self.log_queue.put({
                    "level": level,
                    "message": msg,
                    "timestamp": time.strftime("%H:%M:%S"),
                })

            self._capture_manager = CaptureManager(
                output_folder=OUTPUT_DIR,
                log_callback=_log,
            )

        return self._capture_manager

    def reset_capture_manager(self):
        """Discard manager after stop so next start is fresh."""
        self._capture_manager = None


state = AppState()
