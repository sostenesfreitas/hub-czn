import socket
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Vribbels'))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import status, data, ws


def create_app() -> FastAPI:
    app = FastAPI(title="Hub CZN API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(status.router)
    app.include_router(data.router)
    app.include_router(ws.router)
    return app


app = create_app()


def _find_free_port(start: int = 7842) -> int:
    for port in range(start, start + 10):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("No free port available in range 7842-7851")


if __name__ == "__main__":
    port = _find_free_port()
    # Tauri reads this line from sidecar stdout to discover the port
    print(f"PORT:{port}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
