from __future__ import annotations

import asyncio
import json
import threading
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.state import state
from api.routes.ws import manager

router = APIRouter()
_start_lock = threading.Lock()


class _StartBody(BaseModel):
    pages_count: int = 10


def _read_rescue_count() -> int:
    try:
        from capture.constants import OUTPUT_DIR
        files = sorted(
            OUTPUT_DIR.glob("rescue_records_*.json"),
            key=lambda f: f.stat().st_mtime,
            reverse=True,
        )
        if not files:
            return 0
        data = json.loads(files[0].read_text(encoding="utf-8"))
        return len(data.get("records", []))
    except Exception:
        return 0


def _autoscroll_loop(loop: asyncio.AbstractEventLoop, pages_target: int) -> None:
    import pyautogui

    for i in range(5, 0, -1):
        if not state.autoscroll_running:
            return
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "autoscroll.countdown", "seconds": i}),
            loop,
        )
        time.sleep(1)

    pos = pyautogui.position()
    pages = 0

    while state.autoscroll_running and pages < pages_target:
        pyautogui.click(pos.x, pos.y)
        pages += 1

        current_count = _read_rescue_count()
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({
                "type": "autoscroll.progress",
                "pages": pages,
                "target": pages_target,
                "records": current_count,
            }),
            loop,
        )

        if pages < pages_target:
            time.sleep(2.0)

    if state.autoscroll_running:
        state.autoscroll_running = False
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({
                "type": "autoscroll.done",
                "pages": pages,
                "records": _read_rescue_count(),
            }),
            loop,
        )
    else:
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "autoscroll.stopped", "pages": pages, "records": _read_rescue_count()}),
            loop,
        )


@router.post("/autoscroll/start")
async def autoscroll_start(body: _StartBody = _StartBody()):
    if not state.capture_running:
        raise HTTPException(status_code=422, detail="Capture must be running")
    with _start_lock:
        if state.autoscroll_running:
            raise HTTPException(status_code=409, detail="Auto-scroll already running")
        state.autoscroll_running = True
    loop = asyncio.get_running_loop()
    threading.Thread(target=_autoscroll_loop, args=(loop, max(1, body.pages_count)), daemon=True).start()
    return {"ok": True}


@router.post("/autoscroll/stop")
async def autoscroll_stop():
    state.autoscroll_running = False
    return {"ok": True}
