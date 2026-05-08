# api/routes/capture.py
import ctypes
import threading
import time
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.state import state

router = APIRouter()


def _is_admin() -> bool:
    try:
        import ctypes.wintypes as wintypes
        hToken = wintypes.HANDLE()
        TOKEN_QUERY = 0x0008
        TokenElevation = 20
        if ctypes.windll.advapi32.OpenProcessToken(
            ctypes.windll.kernel32.GetCurrentProcess(),
            TOKEN_QUERY,
            ctypes.byref(hToken),
        ):
            try:
                elevated = wintypes.DWORD(0)
                size = wintypes.DWORD(0)
                if ctypes.windll.advapi32.GetTokenInformation(
                    hToken, TokenElevation,
                    ctypes.byref(elevated),
                    ctypes.sizeof(elevated),
                    ctypes.byref(size),
                ):
                    return bool(elevated.value)
            finally:
                ctypes.windll.kernel32.CloseHandle(hToken)
    except Exception:
        pass
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


class StartRequest(BaseModel):
    region: Literal["global", "asia"]
    debug: bool = False


class SetRegionRequest(BaseModel):
    region: Literal["global", "asia"]


@router.get("/capture/status")
def get_capture_status():
    return {
        "running": state.capture_running,
        "region": state.capture_region,
        "admin": _is_admin(),
        "rescue_file": state.rescue_file_path,
    }


@router.post("/capture/start")
def post_capture_start(body: StartRequest):
    if not _is_admin():
        raise HTTPException(status_code=403, detail="Administrator privileges required.")
    if state.capture_running:
        raise HTTPException(status_code=409, detail="Capture is already running.")

    state.capture_region = body.region
    mgr = state.get_capture_manager()
    mgr.set_region(body.region)

    def _run():
        try:
            mgr.start_capture(debug_mode=body.debug)
            # Block until the proxy process exits (stop_capture terminates it).
            # Capture the reference now so stop_capture() setting proxy_process=None
            # doesn't cause a race condition.
            proc = mgr.proxy_process
            if proc:
                proc.wait()
        except Exception as exc:
            state.log_queue.put({
                "level": "error",
                "message": f"Capture error: {exc}",
                "timestamp": time.strftime("%H:%M:%S"),
            })
        finally:
            state.capture_running = False
            state.reset_capture_manager()

    state.capture_running = True
    threading.Thread(target=_run, daemon=True).start()
    return {"ok": True, "region": body.region}


@router.post("/capture/stop")
def post_capture_stop():
    if not state.capture_running:
        raise HTTPException(status_code=409, detail="No capture is running.")

    mgr = state.get_capture_manager()
    try:
        result = mgr.stop_capture()
        file_path, region = result if isinstance(result, tuple) else (result, state.capture_region)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        state.capture_running = False
        state.reset_capture_manager()

    if file_path:
        state.rescue_file_path = str(file_path)
        try:
            state.optimizer.load_data(str(file_path))
            state.data_loaded = True
            state.loaded_file = str(file_path)
        except Exception:
            pass

    return {"ok": True, "file_path": str(file_path) if file_path else None, "region": region}


@router.post("/capture/set-region")
def post_set_region(body: SetRegionRequest):
    state.capture_region = body.region
    return {"ok": True, "region": body.region}


@router.post("/capture/open-snapshots")
def post_open_snapshots():
    import os
    from capture.constants import OUTPUT_DIR
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(OUTPUT_DIR))
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
