import socket
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants, optimize, about, autoscroll, simulate, cards, battle


def _assets_dir() -> Path:
    if hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS) / 'assets'
    return Path(__file__).parent / 'assets'


def create_app() -> FastAPI:
    app = FastAPI(title="Hub CZN API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    assets_dir = _assets_dir()
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    app.include_router(status.router, prefix="/api", tags=["status"])
    app.include_router(data.router, prefix="/api", tags=["data"])
    app.include_router(ws.router)
    app.include_router(setup.router, prefix="/api", tags=["setup"])
    app.include_router(capture.router, prefix="/api", tags=["capture"])
    app.include_router(rescue.router, prefix="/api", tags=["rescue"])
    app.include_router(scoring.router, prefix="/api", tags=["scoring"])
    app.include_router(combatants.router, prefix="/api", tags=["combatants"])
    app.include_router(optimize.router, prefix="/api", tags=["optimize"])
    app.include_router(about.router, prefix="/api", tags=["about"])
    app.include_router(autoscroll.router, prefix="/api", tags=["autoscroll"])
    app.include_router(simulate.router, prefix="/api", tags=["simulate"])
    app.include_router(cards.router, prefix="/api", tags=["cards"])
    app.include_router(battle.router, prefix="/api", tags=["battle"])
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
    if len(sys.argv) > 1 and sys.argv[1] == "--version":
        from hub_czn_version import __version__
        print(__version__, flush=True)
        sys.exit(0)
    try:
        port = _find_free_port()
        print(f"PORT:{port}", flush=True)
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    except Exception as exc:
        print(f"ERROR:{exc}", flush=True, file=sys.stderr)
        sys.exit(1)
