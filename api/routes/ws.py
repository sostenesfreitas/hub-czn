from __future__ import annotations
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class _Manager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, payload: dict):
        for conn in self._connections[:]:
            try:
                await conn.send_json(payload)
            except Exception:
                if conn in self._connections:
                    self._connections.remove(conn)


# Module-level singleton imported by optimize + capture routes in later plans
manager = _Manager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive; server pushes only
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


import asyncio
import queue as _queue


@router.websocket("/ws/capture-log")
async def capture_log_endpoint(websocket: WebSocket):
    from api.state import state
    await websocket.accept()
    try:
        while True:
            try:
                msg = state.log_queue.get_nowait()
                await websocket.send_json(msg)
            except _queue.Empty:
                await asyncio.sleep(0.1)
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
