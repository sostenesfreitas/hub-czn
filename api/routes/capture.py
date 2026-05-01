# api/routes/capture.py
import ctypes
import threading
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.state import state

router = APIRouter()


def _is_admin() -> bool:
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
    if state.capture_running:
        raise HTTPException(status_code=409, detail="Capture is already running.")
    if not _is_admin():
        raise HTTPException(status_code=403, detail="Administrator privileges required.")

    state.capture_region = body.region
    mgr = state.get_capture_manager()

    def _run():
        try:
            mgr.start_capture(debug_mode=body.debug)
        except Exception as exc:
            state.log_queue.put({
                "level": "error",
                "message": f"Capture error: {exc}",
                "timestamp": __import__("time").strftime("%H:%M:%S"),
            })
            state.capture_running = False

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

    return {"ok": True, "file_path": str(file_path) if file_path else None, "region": region}


@router.post("/capture/set-region")
def post_set_region(body: SetRegionRequest):
    state.capture_region = body.region
    return {"ok": True, "region": body.region}


@router.post("/capture/open-snapshots")
def post_open_snapshots():
    import os
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))
    from capture.constants import OUTPUT_DIR
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(OUTPUT_DIR))
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
