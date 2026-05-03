from __future__ import annotations

import asyncio
import json
import threading
import time

from fastapi import APIRouter, HTTPException

from api.state import state
from api.routes.ws import manager

router = APIRouter()
_start_lock = threading.Lock()


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


def _autoscroll_loop(loop: asyncio.AbstractEventLoop) -> None:
    import pyautogui

    for i in range(3, 0, -1):
        if not state.autoscroll_running:
            return
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "autoscroll.countdown", "seconds": i}),
            loop,
        )
        time.sleep(1)

    pos = pyautogui.position()
    consecutive_no_new = 0
    last_count = _read_rescue_count()
    pages = 0

    while state.autoscroll_running:
        pyautogui.click(pos.x, pos.y)
        pages += 1
        time.sleep(1.2)

        current_count = _read_rescue_count()
        if current_count == last_count:
            consecutive_no_new += 1
        else:
            consecutive_no_new = 0
            last_count = current_count

        asyncio.run_coroutine_threadsafe(
            manager.broadcast({
                "type": "autoscroll.progress",
                "pages": pages,
                "records": current_count,
            }),
            loop,
        )

        if consecutive_no_new >= 3:
            state.autoscroll_running = False
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({
                    "type": "autoscroll.done",
                    "pages": pages,
                    "records": current_count,
                }),
                loop,
            )
            return

    asyncio.run_coroutine_threadsafe(
        manager.broadcast({"type": "autoscroll.stopped", "pages": pages}),
        loop,
    )


@router.post("/autoscroll/start")
async def autoscroll_start():
    if not state.capture_running:
        raise HTTPException(status_code=422, detail="Capture must be running")
    with _start_lock:
        if state.autoscroll_running:
            raise HTTPException(status_code=409, detail="Auto-scroll already running")
        state.autoscroll_running = True
    loop = asyncio.get_running_loop()
    threading.Thread(target=_autoscroll_loop, args=(loop,), daemon=True).start()
    return {"ok": True}


@router.post("/autoscroll/stop")
async def autoscroll_stop():
    state.autoscroll_running = False
    return {"ok": True}
