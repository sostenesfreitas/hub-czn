import socket
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants, optimize


def create_app() -> FastAPI:
    app = FastAPI(title="Hub CZN API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(status.router, prefix="/api", tags=["status"])
    app.include_router(data.router, prefix="/api", tags=["data"])
    app.include_router(ws.router)
    app.include_router(setup.router, prefix="/api", tags=["setup"])
    app.include_router(capture.router, prefix="/api", tags=["capture"])
    app.include_router(rescue.router, prefix="/api", tags=["rescue"])
    app.include_router(scoring.router, prefix="/api", tags=["scoring"])
    app.include_router(combatants.router, prefix="/api", tags=["combatants"])
    app.include_router(optimize.router, prefix="/api", tags=["optimize"])
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
    try:
        port = _find_free_port()
        print(f"PORT:{port}", flush=True)
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    except Exception as exc:
        print(f"ERROR:{exc}", flush=True, file=sys.stderr)
        sys.exit(1)
