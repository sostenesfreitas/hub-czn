# Capture & Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Capture, Setup, and Rescue pages to the Tauri/React frontend by extending the FastAPI sidecar with new endpoints that wrap the existing `CaptureManager` Python class.

**Architecture:** The FastAPI sidecar imports `CaptureManager` from `Vribbels/capture/manager.py` and exposes HTTP endpoints for setup checks, capture lifecycle, and rescue records reading. A thread-safe `queue.SimpleQueue` bridges synchronous mitmproxy log callbacks to an async WebSocket endpoint (`/ws/capture-log`). The frontend adds three pages (Setup, Capture, Rescue) using existing patterns: `useQuery` for polling, a `useCaptureLog` hook for the WebSocket, and `recharts` for the pie chart.

**Tech Stack:** FastAPI, Python stdlib `queue.SimpleQueue`, React 18, TanStack Query v5, recharts, shadcn/ui, Tailwind v4.

---

## File Map

**Create (backend):**
- `api/routes/setup.py` — GET /api/setup/status, POST /api/setup/install-mitmproxy, POST /api/setup/generate-cert, POST /api/setup/open-cert
- `api/routes/capture.py` — GET /api/capture/status, POST /api/capture/start, POST /api/capture/stop, POST /api/capture/set-region
- `api/routes/rescue.py` — GET /api/rescue/records
- `tests/api/test_setup.py`
- `tests/api/test_capture.py`
- `tests/api/test_rescue.py`

**Modify (backend):**
- `api/state.py` — add `capture_manager`, `capture_running`, `capture_region`, `rescue_file_path`, `log_queue` fields
- `api/routes/ws.py` — add `/ws/capture-log` endpoint
- `api/main.py` — register setup, capture, rescue routers

**Create (frontend):**
- `src/pages/setup/SetupPage.tsx`
- `src/pages/capture/CapturePage.tsx`
- `src/pages/rescue/RescuePage.tsx`
- `src/hooks/useCaptureLog.ts`

**Modify (frontend):**
- `src/lib/types.ts` — add SetupStatus, CaptureStatus, RescueBanner, RescuePull types
- `src/lib/api.ts` — add setup, capture, rescue API functions
- `src/App.tsx` — register /setup, /capture, /rescue routes

---

## Task 1: Extend AppState with capture fields

**Files:**
- Modify: `api/state.py`

- [ ] **Step 1: Replace state.py with extended version**

```python
import sys
import os
import queue

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

            def _log(msg: str):
                import time
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
```

- [ ] **Step 2: Verify imports still work**

Run: `python -c "from api.state import state; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add api/state.py
git commit -m "feat(api): extend AppState with capture fields and lazy CaptureManager"
```

---

## Task 2: Setup endpoints

**Files:**
- Create: `api/routes/setup.py`
- Create: `tests/api/test_setup.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/api/test_setup.py
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_setup_status_returns_expected_shape():
    mock_status = MagicMock(
        is_admin=False,
        has_mitmproxy=True,
        mitmproxy_version="10.1.1",
        has_certificate=False,
        certificate_path=None,
    )
    with patch("api.routes.setup.check_prerequisites", return_value=mock_status):
        r = client.get("/api/setup/status")
    assert r.status_code == 200
    body = r.json()
    assert body["admin"] is False
    assert body["mitmproxy"] is True
    assert body["mitmproxy_version"] == "10.1.1"
    assert body["certificate"] is False


def test_install_mitmproxy_success():
    with patch("api.routes.setup.install_mitmproxy", return_value=True):
        r = client.post("/api/setup/install-mitmproxy")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_install_mitmproxy_failure():
    with patch("api.routes.setup.install_mitmproxy", side_effect=Exception("pip failed")):
        r = client.post("/api/setup/install-mitmproxy")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert "pip failed" in body["error"]


def test_generate_cert_success():
    from pathlib import Path
    with patch("api.routes.setup.setup_certificate", return_value=Path("/fake/cert.cer")):
        r = client.post("/api/setup/generate-cert")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_open_cert_no_certificate():
    from unittest.mock import patch
    mock_status = MagicMock(has_certificate=False, certificate_path=None)
    with patch("api.routes.setup.check_prerequisites", return_value=mock_status):
        r = client.post("/api/setup/open-cert")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/api/test_setup.py -v`
Expected: FAIL (ImportError or 404 on routes not yet defined)

- [ ] **Step 3: Implement setup.py**

```python
# api/routes/setup.py
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

from fastapi import APIRouter, HTTPException
from capture.setup import check_prerequisites, install_mitmproxy, setup_certificate, open_certificate

router = APIRouter()


@router.get("/setup/status")
def get_setup_status():
    s = check_prerequisites()
    return {
        "admin": s.is_admin,
        "mitmproxy": s.has_mitmproxy,
        "mitmproxy_version": s.mitmproxy_version,
        "certificate": s.has_certificate,
    }


@router.post("/setup/install-mitmproxy")
def post_install_mitmproxy():
    try:
        install_mitmproxy()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@router.post("/setup/generate-cert")
def post_generate_cert():
    try:
        setup_certificate()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@router.post("/setup/open-cert")
def post_open_cert():
    s = check_prerequisites()
    if not s.has_certificate or s.certificate_path is None:
        raise HTTPException(status_code=404, detail="Certificate not found. Generate it first.")
    try:
        open_certificate(s.certificate_path)
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/api/test_setup.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add api/routes/setup.py tests/api/test_setup.py
git commit -m "feat(api): add /api/setup/* endpoints with prerequisite checks"
```

---

## Task 3: Capture control endpoints

**Files:**
- Create: `api/routes/capture.py`
- Create: `tests/api/test_capture.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/api/test_capture.py
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def _mock_manager(running=False):
    m = MagicMock()
    m.start_capture = MagicMock()
    m.stop_capture = MagicMock(return_value=("/path/capture.json", "global"))
    return m


def test_capture_status_not_running():
    r = client.get("/api/capture/status")
    assert r.status_code == 200
    body = r.json()
    assert body["running"] is False
    assert "region" in body
    assert "admin" in body


def test_capture_start_no_admin():
    import ctypes
    with patch("api.routes.capture.ctypes") as mock_ctypes:
        mock_ctypes.windll.shell32.IsUserAnAdmin.return_value = 0
        r = client.post("/api/capture/start", json={"region": "global", "debug": False})
    assert r.status_code == 403


def test_capture_start_already_running():
    from api.state import state
    state.capture_running = True
    r = client.post("/api/capture/start", json={"region": "global", "debug": False})
    assert r.status_code == 409
    state.capture_running = False


def test_capture_stop_not_running():
    r = client.post("/api/capture/stop")
    assert r.status_code == 409


def test_set_region_valid():
    r = client.post("/api/capture/set-region", json={"region": "asia"})
    assert r.status_code == 200
    assert r.json()["region"] == "asia"
    # reset
    client.post("/api/capture/set-region", json={"region": "global"})


def test_set_region_invalid():
    r = client.post("/api/capture/set-region", json={"region": "europe"})
    assert r.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/api/test_capture.py -v`
Expected: FAIL

- [ ] **Step 3: Implement capture.py**

```python
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
    if not _is_admin():
        raise HTTPException(status_code=403, detail="Administrator privileges required.")
    if state.capture_running:
        raise HTTPException(status_code=409, detail="Capture is already running.")

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
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))
    from capture.constants import OUTPUT_DIR
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(OUTPUT_DIR))
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/api/test_capture.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add api/routes/capture.py tests/api/test_capture.py
git commit -m "feat(api): add /api/capture/* endpoints for proxy lifecycle"
```

---

## Task 4: Rescue records endpoint

**Files:**
- Create: `api/routes/rescue.py`
- Create: `tests/api/test_rescue.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/api/test_rescue.py
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

FAKE_RESCUE = [
    {
        "gacha_id": "pickup_combatant_season1",
        "reward": json.dumps([1003, 1004, 1005]),
        "prism": json.dumps([False, True, False]),
        "createAt": "1714300000",
    }
]


def test_rescue_records_no_file():
    from api.state import state
    state.rescue_file_path = None
    r = client.get("/api/rescue/records")
    assert r.status_code == 200
    assert r.json() == []


def test_rescue_records_with_file():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(FAKE_RESCUE, f)
        path = f.name

    from api.state import state
    state.rescue_file_path = path

    r = client.get("/api/rescue/records")
    assert r.status_code == 200
    body = r.json()
    assert len(body) >= 1
    banner = body[0]
    assert "banner_name" in banner
    assert "pulls" in banner
    assert "stats" in banner
    assert banner["stats"]["total"] == 3

    state.rescue_file_path = None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/api/test_rescue.py -v`
Expected: FAIL

- [ ] **Step 3: Implement rescue.py**

```python
# api/routes/rescue.py
import json
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

from fastapi import APIRouter
from api.state import state

try:
    from game_data import CHARACTERS, PARTNERS
except ImportError:
    CHARACTERS = {}
    PARTNERS = {}

router = APIRouter()

CDN_BASE = "https://cdn.czndecksmeta.com/face/character/portrait_character_{res_id}.webp"


def _char_details(res_id: int) -> dict:
    char = CHARACTERS.get(res_id)
    if char:
        return {
            "name": char.get("name", f"#{res_id}"),
            "rarity": char.get("grade", 3),
            "kind": "Combatant",
            "image_url": CDN_BASE.format(res_id=res_id),
        }
    partner = PARTNERS.get(res_id)
    if partner and partner.get("name") != "Unknown":
        return {
            "name": partner.get("name", f"#{res_id}"),
            "rarity": partner.get("grade", 3),
            "kind": "Partner",
            "image_url": CDN_BASE.format(res_id=res_id),
        }
    return {
        "name": f"#{res_id}",
        "rarity": 3,
        "kind": "Unknown",
        "image_url": CDN_BASE.format(res_id=res_id),
    }


def _banner_name(gacha_id: str) -> str:
    if "pickup_combatant" in gacha_id:
        return "Seasonal Combatant Rescue Rate-Up"
    if "pickup_partner" in gacha_id:
        return "Seasonal Partner Rescue Rate-Up"
    if "free" in gacha_id:
        return "Free Rescue"
    if "standard" in gacha_id or "normal" in gacha_id:
        return "Standard Rescue"
    return gacha_id.replace("_", " ").title()


def _expand_batch(record: dict) -> list[dict]:
    try:
        rewards = json.loads(record.get("reward", "[]"))
    except (json.JSONDecodeError, TypeError):
        rewards = []
    try:
        prisms = json.loads(record.get("prism", "[]"))
    except (json.JSONDecodeError, TypeError):
        prisms = []

    gacha_id = record.get("gacha_id", "")
    try:
        ts = int(record.get("createAt", 0))
    except (ValueError, TypeError):
        ts = 0

    return [
        {
            "res_id": int(r),
            "gacha_id": gacha_id,
            "timestamp": ts,
            "is_featured": bool(prisms[i]) if i < len(prisms) else False,
        }
        for i, r in enumerate(rewards)
    ]


def _process_records(raw: list[dict]) -> list[dict]:
    """Group raw rescue records by banner, compute stats, return API shape."""
    # Expand all batches and sort oldest → newest for sequential pull numbering
    all_pulls = []
    for rec in raw:
        all_pulls.extend(_expand_batch(rec))
    all_pulls.sort(key=lambda p: p["timestamp"])

    # Group by banner
    banners: dict[str, list[dict]] = {}
    for pull in all_pulls:
        name = _banner_name(pull["gacha_id"])
        banners.setdefault(name, []).append(pull)

    result = []
    for banner_name, pulls in banners.items():
        # Compute pity per pull (reset after each 5★)
        processed_pulls = []
        pity = 0
        pull_number = 0
        five_stars = 0
        four_stars = 0
        wins_50_50 = 0
        five_star_opportunities = 0

        for p in pulls:
            pull_number += 1
            pity += 1
            details = _char_details(p["res_id"])
            if details["rarity"] >= 5:
                five_stars += 1
                five_star_opportunities += 1
                if p["is_featured"]:
                    wins_50_50 += 1
                processed_pulls.append({
                    "pull_number": pull_number,
                    "res_id": p["res_id"],
                    "name": details["name"],
                    "rarity": details["rarity"],
                    "kind": details["kind"],
                    "image_url": details["image_url"],
                    "pity": pity,
                    "is_featured": p["is_featured"],
                    "timestamp": p["timestamp"],
                })
                pity = 0
            elif details["rarity"] >= 4:
                four_stars += 1
                processed_pulls.append({
                    "pull_number": pull_number,
                    "res_id": p["res_id"],
                    "name": details["name"],
                    "rarity": details["rarity"],
                    "kind": details["kind"],
                    "image_url": details["image_url"],
                    "pity": pity,
                    "is_featured": False,
                    "timestamp": p["timestamp"],
                })
            else:
                processed_pulls.append({
                    "pull_number": pull_number,
                    "res_id": p["res_id"],
                    "name": details["name"],
                    "rarity": details["rarity"],
                    "kind": details["kind"],
                    "image_url": details["image_url"],
                    "pity": pity,
                    "is_featured": False,
                    "timestamp": p["timestamp"],
                })

        total = len(pulls)
        # Reverse so newest is first for display
        processed_pulls.reverse()

        result.append({
            "banner_name": banner_name,
            "pulls": processed_pulls,
            "stats": {
                "total": total,
                "five_star": five_stars,
                "four_star": four_stars,
                "avg_pity_5": round(total / five_stars, 1) if five_stars else 0,
                "avg_pity_4": round(total / four_stars, 1) if four_stars else 0,
                "win_rate_50_50": round(wins_50_50 / five_star_opportunities, 4) if five_star_opportunities else 0,
                "resources_spent": total * 160,
            },
        })

    return result


def _latest_rescue_file() -> Path | None:
    """Find the most recently modified rescue_records_*.json in the snapshots folder."""
    try:
        from capture.constants import OUTPUT_DIR
        files = sorted(OUTPUT_DIR.glob("rescue_records_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
        return files[0] if files else None
    except Exception:
        return None


@router.get("/rescue/records")
def get_rescue_records():
    path = _latest_rescue_file()
    if path is None:
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return _process_records(raw)
    except Exception:
        return []
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/api/test_rescue.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add api/routes/rescue.py tests/api/test_rescue.py
git commit -m "feat(api): add /api/rescue/records endpoint with banner grouping"
```

---

## Task 5: Add /ws/capture-log WebSocket + register all new routers

**Files:**
- Modify: `api/routes/ws.py`
- Modify: `api/main.py`

- [ ] **Step 1: Add capture-log WebSocket to ws.py**

Append to the end of `api/routes/ws.py` (after the existing `websocket_endpoint`):

```python
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
    except WebSocketDisconnect:
        pass
```

- [ ] **Step 2: Register new routers in main.py**

Replace the `create_app` function in `api/main.py`:

```python
from api.routes import status, data, ws, setup, capture, rescue


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
    app.include_router(setup.router, prefix="/api", tags=["setup"])
    app.include_router(capture.router, prefix="/api", tags=["capture"])
    app.include_router(rescue.router, prefix="/api", tags=["rescue"])
    app.include_router(ws.router)
    return app
```

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `python -m pytest tests/ -v`
Expected: all tests passing (6 original + 5 setup + 6 capture + 2 rescue = 19 passed)

- [ ] **Step 4: Commit**

```bash
git add api/routes/ws.py api/main.py
git commit -m "feat(api): add /ws/capture-log and register setup/capture/rescue routers"
```

---

## Task 6: Add TypeScript types and API client functions

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Append new types to types.ts**

Add after the existing `GameData` interface:

```typescript
export interface SetupStatus {
  admin: boolean
  mitmproxy: boolean
  mitmproxy_version: string | null
  certificate: boolean
}

export interface SetupActionResponse {
  ok: boolean
  error?: string
}

export interface CaptureStatus {
  running: boolean
  region: 'global' | 'asia'
  admin: boolean
  rescue_file: string | null
}

export interface CaptureStartRequest {
  region: 'global' | 'asia'
  debug: boolean
}

export interface CaptureStopResponse {
  ok: boolean
  file_path: string | null
  region: string
}

export interface RescuePull {
  pull_number: number
  res_id: number
  name: string
  rarity: number
  kind: string
  image_url: string
  pity: number
  is_featured: boolean
  timestamp: number
}

export interface RescueStats {
  total: number
  five_star: number
  four_star: number
  avg_pity_5: number
  avg_pity_4: number
  win_rate_50_50: number
  resources_spent: number
}

export interface RescueBanner {
  banner_name: string
  pulls: RescuePull[]
  stats: RescueStats
}

export interface CaptureLogMessage {
  level: 'info' | 'success' | 'error' | 'warning'
  message: string
  timestamp: string
}
```

- [ ] **Step 2: Append new api functions to api.ts**

Add inside the `api` object after `gameData`:

```typescript
  setupStatus: () => request<SetupStatus>('/api/setup/status'),

  installMitmproxy: () =>
    request<SetupActionResponse>('/api/setup/install-mitmproxy', { method: 'POST' }),

  generateCert: () =>
    request<SetupActionResponse>('/api/setup/generate-cert', { method: 'POST' }),

  openCert: () =>
    request<SetupActionResponse>('/api/setup/open-cert', { method: 'POST' }),

  captureStatus: () => request<CaptureStatus>('/api/capture/status'),

  captureStart: (body: CaptureStartRequest) =>
    request('/api/capture/start', { method: 'POST', body: JSON.stringify(body) }),

  captureStop: () => request<CaptureStopResponse>('/api/capture/stop', { method: 'POST' }),

  captureSetRegion: (region: 'global' | 'asia') =>
    request('/api/capture/set-region', { method: 'POST', body: JSON.stringify({ region }) }),

  rescueRecords: () => request<RescueBanner[]>('/api/rescue/records'),
```

Also update the import at the top of `api.ts` to include the new types:

```typescript
import type {
  ApiStatus, GameData, LoadResponse, MemoryFragment,
  SetupStatus, SetupActionResponse, CaptureStatus,
  CaptureStartRequest, CaptureStopResponse, RescueBanner,
} from './types'
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build` (in worktree root)
Expected: Build succeeds with no type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts
git commit -m "feat(frontend): add Capture, Setup, Rescue types and API functions"
```

---

## Task 7: Build SetupPage

**Files:**
- Create: `src/pages/setup/SetupPage.tsx`

- [ ] **Step 1: Create SetupPage.tsx**

```tsx
// src/pages/setup/SetupPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle size={18} className="text-green-500 shrink-0" />
    : <XCircle size={18} className="text-red-500 shrink-0" />
}

function Row({
  ok,
  label,
  detail,
  action,
}: {
  ok: boolean
  label: string
  detail: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-[#252320] border border-[#2e2c28]">
      <StatusIcon ok={ok} />
      <div className="flex-1 min-w-0">
        <p className="text-[#faf9f5] font-medium text-sm">{label}</p>
        <p className="text-[#a09d96] text-xs mt-0.5">{detail}</p>
      </div>
      {action}
    </div>
  )
}

export function SetupPage() {
  const qc = useQueryClient()
  const [howOpen, setHowOpen] = useState(false)
  const [certImported, setCertImported] = useState(
    () => localStorage.getItem('setup.cert_imported') === 'true'
  )

  const { data: status, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.setupStatus(),
    refetchInterval: 5000,
  })

  const installMutation = useMutation({
    mutationFn: () => api.installMitmproxy(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-status'] }),
  })

  const certMutation = useMutation({
    mutationFn: () => api.generateCert(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-status'] }),
  })

  const openCertMutation = useMutation({
    mutationFn: () => api.openCert(),
  })

  if (isLoading || !status) {
    return <div className="p-8 text-[#a09d96]">Checking prerequisites…</div>
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-xl">
      <h1 className="text-xl font-bold text-[#faf9f5]">Setup</h1>

      <Row
        ok={status.admin}
        label="Administrator"
        detail={
          status.admin
            ? 'Running with administrator privileges'
            : 'Close the app and reopen with "Run as administrator"'
        }
      />

      <Row
        ok={status.mitmproxy}
        label="mitmproxy"
        detail={
          status.mitmproxy
            ? `mitmproxy ${status.mitmproxy_version} installed`
            : 'Required to intercept game traffic'
        }
        action={
          !status.mitmproxy && (
            <Button
              size="sm"
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="bg-[#cc785c] hover:bg-[#b8674d] text-white shrink-0"
            >
              {installMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Instalar'}
            </Button>
          )
        }
      />

      <Row
        ok={status.certificate}
        label="Certificado CA"
        detail={
          status.certificate
            ? 'Certificate generated in ~/.mitmproxy/'
            : 'Required for HTTPS interception'
        }
        action={
          !status.certificate && (
            <Button
              size="sm"
              onClick={() => certMutation.mutate()}
              disabled={certMutation.isPending}
              className="bg-[#cc785c] hover:bg-[#b8674d] text-white shrink-0"
            >
              {certMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Gerar'}
            </Button>
          )
        }
      />

      {status.certificate && (
        <div className="p-4 rounded-lg bg-[#252320] border border-[#2e2c28] flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <StatusIcon ok={certImported} />
            <div className="flex-1">
              <p className="text-[#faf9f5] font-medium text-sm">Importar certificado no Windows</p>
              <p className="text-[#a09d96] text-xs mt-0.5">
                Abra o certificado → "Instalar Certificado" → "Máquina Local" →
                "Autoridades de Certificação Raiz Confiáveis"
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-8">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCertMutation.mutate()}
              className="border-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5]"
            >
              Abrir certificado
            </Button>
            <label className="flex items-center gap-2 text-xs text-[#a09d96] cursor-pointer">
              <input
                type="checkbox"
                checked={certImported}
                onChange={e => {
                  setCertImported(e.target.checked)
                  localStorage.setItem('setup.cert_imported', String(e.target.checked))
                }}
                className="accent-[#cc785c]"
              />
              Já importei o certificado
            </label>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-[#252320] border border-[#2e2c28] overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#a09d96] hover:text-[#faf9f5]"
          onClick={() => setHowOpen(v => !v)}
        >
          {howOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Como funciona?
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-xs text-[#a09d96] leading-relaxed">
            O app usa mitmproxy como proxy reverso local. Ao iniciar o capture, ele redireciona o
            tráfego do jogo para o proxy via arquivo hosts do Windows. O proxy intercepta as
            mensagens WebSocket do servidor e extrai os dados de inventário e rescue em tempo real.
            Nenhum dado é enviado para fora — tudo fica local.
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Register the page in App.tsx (temporarily import to check it compiles)**

No change to App.tsx yet — that happens in Task 10. Just verify the file compiles:

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/pages/setup/SetupPage.tsx
git commit -m "feat(frontend): add SetupPage with prerequisite checklist"
```

---

## Task 8: Build useCaptureLog hook and CapturePage

**Files:**
- Create: `src/hooks/useCaptureLog.ts`
- Create: `src/pages/capture/CapturePage.tsx`

- [ ] **Step 1: Create useCaptureLog.ts**

```typescript
// src/hooks/useCaptureLog.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { CaptureLogMessage } from '@/lib/types'

export function useCaptureLog(port: number) {
  const [messages, setMessages] = useState<CaptureLogMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/capture-log`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (e) => {
        try {
          const msg: CaptureLogMessage = JSON.parse(e.data)
          setMessages(prev => [...prev.slice(-499), msg])
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [port])

  const clear = useCallback(() => setMessages([]), [])

  return { messages, connected, clear }
}
```

- [ ] **Step 2: Create CapturePage.tsx**

```tsx
// src/pages/capture/CapturePage.tsx
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { api } from '@/lib/api'
import { useApiPort } from '@/hooks/useApiPort'
import { useCaptureLog } from '@/hooks/useCaptureLog'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Radio, Square, FolderOpen, Download } from 'lucide-react'
import type { CaptureLogMessage } from '@/lib/types'

const LEVEL_COLOR: Record<CaptureLogMessage['level'], string> = {
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#a09d96',
}

function PrereqBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  )
}

export function CapturePage() {
  const port = useApiPort()
  const qc = useQueryClient()
  const { messages, clear } = useCaptureLog(port)
  const [autoScroll, setAutoScroll] = useState(true)
  const [debug, setDebug] = useState(false)
  const [region, setRegion] = useState<'global' | 'asia'>('global')
  const logRef = useRef<HTMLDivElement>(null)

  const { data: captureStatus } = useQuery({
    queryKey: ['capture-status'],
    queryFn: () => api.captureStatus(),
    refetchInterval: 3000,
  })

  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.setupStatus(),
    refetchInterval: 10000,
  })

  // Auto-scroll log panel
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  // Auto-refetch fragments when capture saves data
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.message.toLowerCase().includes('saved:') && last.message.toLowerCase().includes('memory fragments')) {
      qc.invalidateQueries({ queryKey: ['fragments'] })
    }
  }, [messages, qc])

  // Sync region from server
  useEffect(() => {
    if (captureStatus?.region) setRegion(captureStatus.region)
  }, [captureStatus?.region])

  const startMutation = useMutation({
    mutationFn: () => api.captureStart({ region, debug }),
    onSuccess: () => {
      clear()
      qc.invalidateQueries({ queryKey: ['capture-status'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => api.captureStop(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capture-status'] }),
  })

  const regionMutation = useMutation({
    mutationFn: (r: 'global' | 'asia') => api.captureSetRegion(r),
  })

  const running = captureStatus?.running ?? false
  const isAdmin = captureStatus?.admin ?? false
  const prereqsOk = isAdmin && (setupStatus?.mitmproxy ?? false) && (setupStatus?.certificate ?? false)

  return (
    <div className="p-6 flex gap-6 h-full">
      {/* Left: controls */}
      <div className="w-60 shrink-0 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-[#faf9f5]">Capture</h1>

        {/* Prerequisites bar */}
        <div className="p-3 rounded-lg bg-[#252320] border border-[#2e2c28] flex flex-col gap-2">
          <PrereqBadge ok={isAdmin} label="Admin" />
          <PrereqBadge ok={setupStatus?.mitmproxy ?? false} label="mitmproxy" />
          <PrereqBadge ok={setupStatus?.certificate ?? false} label="Certificado" />
          {!prereqsOk && (
            <NavLink to="/setup" className="text-xs text-[#cc785c] hover:underline mt-1">
              → Ir para Setup
            </NavLink>
          )}
        </div>

        {/* Region selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#a09d96]">Servidor</label>
          <select
            value={region}
            disabled={running}
            onChange={e => {
              const r = e.target.value as 'global' | 'asia'
              setRegion(r)
              regionMutation.mutate(r)
            }}
            className="bg-[#252320] border border-[#2e2c28] rounded px-2 py-1.5 text-sm text-[#faf9f5] disabled:opacity-50"
          >
            <option value="global">Global</option>
            <option value="asia">Asia</option>
          </select>
        </div>

        {/* Debug mode */}
        <label className="flex items-center gap-2 text-sm text-[#a09d96] cursor-pointer">
          <input
            type="checkbox"
            checked={debug}
            disabled={running}
            onChange={e => setDebug(e.target.checked)}
            className="accent-[#cc785c]"
          />
          Debug mode
        </label>

        {/* Start / Stop */}
        {!running ? (
          <Button
            onClick={() => startMutation.mutate()}
            disabled={!prereqsOk || startMutation.isPending}
            className="bg-[#cc785c] hover:bg-[#b8674d] text-white w-full"
          >
            <Radio size={14} className="mr-2" />
            Start Capture
          </Button>
        ) : (
          <Button
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white w-full"
          >
            <Square size={14} className="mr-2" />
            Stop Capture
          </Button>
        )}

        {/* Secondary actions */}
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5] w-full justify-start"
            onClick={() => fetch(`http://127.0.0.1:${port}/api/capture/open-snapshots`, { method: 'POST' })}
          >
            <FolderOpen size={13} className="mr-2" />
            Abrir Snapshots
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!captureStatus?.rescue_file}
            className="border-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5] w-full justify-start disabled:opacity-40"
            onClick={() => {
              if (captureStatus?.rescue_file) {
                api.load(captureStatus.rescue_file)
                  .then(() => qc.invalidateQueries({ queryKey: ['fragments'] }))
              }
            }}
          >
            <Download size={13} className="mr-2" />
            Carregar Último
          </Button>
        </div>
      </div>

      {/* Right: log panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#a09d96]">Log em tempo real</span>
          <div className="flex gap-2">
            <button
              className="text-xs text-[#a09d96] hover:text-[#faf9f5]"
              onClick={() => setAutoScroll(v => !v)}
            >
              {autoScroll ? 'Pausar scroll' : 'Retomar scroll'}
            </button>
            <button className="text-xs text-[#a09d96] hover:text-[#faf9f5]" onClick={clear}>
              Limpar
            </button>
          </div>
        </div>

        <div
          ref={logRef}
          className="flex-1 overflow-y-auto rounded-lg bg-[#0f0e0c] border border-[#2e2c28] p-3 font-mono text-xs leading-relaxed"
        >
          {messages.length === 0 && !running && (
            <div className="text-[#3d3d3a] space-y-1">
              <p>1. Clique em Start Capture</p>
              <p>2. Abra o jogo</p>
              <p>3. Navegue até o inventário de Memory Fragments</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ color: LEVEL_COLOR[m.level] }}>
              <span className="text-[#3d3d3a]">{m.timestamp} </span>
              {m.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCaptureLog.ts src/pages/capture/CapturePage.tsx
git commit -m "feat(frontend): add CapturePage with real-time log panel and controls"
```

---

## Task 9: Install recharts and build RescuePage

**Files:**
- Create: `src/pages/rescue/RescuePage.tsx`

- [ ] **Step 1: Install recharts**

Run: `npm install recharts`
Expected: recharts added to package.json

- [ ] **Step 2: Create RescuePage.tsx**

```tsx
// src/pages/rescue/RescuePage.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import type { RescueBanner, RescuePull } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'

const PIE_COLORS = ['#cc785c', '#8b5cf6', '#a09d96']
const RARITY_FILTER = [0, 5, 4] as const

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#a09d96]">{label}</span>
      <span className="text-[#cc785c] font-medium">{value}</span>
    </div>
  )
}

function PortraitGrid({ pulls }: { pulls: RescuePull[] }) {
  const fiveStars = pulls.filter(p => p.rarity >= 5)
  if (fiveStars.length === 0) return null
  return (
    <div>
      <p className="text-sm font-medium text-[#faf9f5] mb-3">Saltos 5★ Recentes</p>
      <div className="flex flex-wrap gap-2">
        {fiveStars.map((p, i) => (
          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#252320] border border-[#2e2c28]">
            <img
              src={p.image_url}
              alt={p.name}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="absolute bottom-0 left-0 bg-black/70 text-[10px] text-[#faf9f5] px-1 py-0.5 font-mono">
              {p.pity}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BannerView({ banner }: { banner: RescueBanner }) {
  const [rarityFilter, setRarityFilter] = useState<0 | 5 | 4>(0)
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  const { stats, pulls } = banner

  const pieData = [
    { name: '5★', value: stats.five_star },
    { name: '4★', value: stats.four_star },
    { name: '3★', value: stats.total - stats.five_star - stats.four_star },
  ]

  const filtered = rarityFilter === 0 ? pulls : pulls.filter(p => p.rarity === rarityFilter)
  const pages = Math.ceil(filtered.length / PER_PAGE)
  const pageSlice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div className="flex flex-col gap-6">
      {/* Stats + Pie */}
      <div className="flex gap-6 p-4 rounded-lg bg-[#252320] border border-[#2e2c28]">
        <div className="flex-1 flex flex-col gap-2 justify-center">
          <StatRow label="Total de Saltos" value={stats.total.toLocaleString()} />
          <StatRow label="Recursos Gastos (Jades)" value={stats.resources_spent.toLocaleString()} />
          <StatRow label="Saltos 5★" value={stats.five_star} />
          <StatRow label="Saltos 4★" value={stats.four_star} />
          <StatRow label="Pity 5★ Médio" value={stats.avg_pity_5} />
          <StatRow label="Pity 4★ Médio" value={stats.avg_pity_4} />
          <StatRow label="50/50 Win Rate" value={`${(stats.win_rate_50_50 * 100).toFixed(2)}%`} />
        </div>
        <div className="w-40 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#252320', border: '1px solid #2e2c28', borderRadius: 6 }}
                labelStyle={{ color: '#faf9f5' }}
                itemStyle={{ color: '#a09d96' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5★ Portrait Grid */}
      <PortraitGrid pulls={pulls} />

      {/* Pull History Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[#faf9f5]">Histórico Completo</p>
          <div className="flex gap-1">
            {RARITY_FILTER.map(r => (
              <button
                key={r}
                onClick={() => { setRarityFilter(r); setPage(0) }}
                className={`px-2 py-1 text-xs rounded ${
                  rarityFilter === r
                    ? 'bg-[#cc785c] text-white'
                    : 'bg-[#252320] text-[#a09d96] hover:text-[#faf9f5]'
                }`}
              >
                {r === 0 ? 'Todos' : `${r}★`}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#2e2c28] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#252320] hover:bg-[#252320] border-[#2e2c28]">
                {['Nº Roll', 'Personagem', 'Pity', 'Banner', 'Hora'].map(h => (
                  <TableHead key={h} className="text-[#a09d96] text-xs h-9">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageSlice.map((pull, i) => (
                <TableRow key={i} className="border-[#2e2c28] hover:bg-[#252320]">
                  <TableCell className="text-[#a09d96] font-mono text-xs">{pull.pull_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <img
                        src={pull.image_url}
                        alt={pull.name}
                        className="w-6 h-6 rounded object-cover bg-[#252320]"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className={`text-sm ${pull.rarity >= 5 ? 'text-[#cc785c]' : pull.rarity >= 4 ? 'text-purple-400' : 'text-[#faf9f5]'}`}>
                        {pull.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-[#2e2c28] text-[#a09d96]">
                        {pull.kind}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-[#faf9f5]">{pull.pity}</TableCell>
                  <TableCell className="text-xs text-[#a09d96]">{banner.banner_name}</TableCell>
                  <TableCell className="text-xs text-[#a09d96]">
                    {pull.timestamp ? new Date(pull.timestamp * 1000).toLocaleString('pt-BR') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pages > 1 && (
          <div className="flex gap-2 mt-3 justify-end">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="text-xs text-[#a09d96] hover:text-[#faf9f5] disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="text-xs text-[#a09d96]">{page + 1} / {pages}</span>
            <button
              disabled={page === pages - 1}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-[#a09d96] hover:text-[#faf9f5] disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function RescuePage() {
  const [activeTab, setActiveTab] = useState(0)

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['rescue-records'],
    queryFn: () => api.rescueRecords(),
    refetchInterval: 10000,
  })

  if (isLoading) return <div className="p-8 text-[#a09d96]">Carregando…</div>

  if (banners.length === 0) {
    return (
      <div className="p-8 text-[#a09d96]">
        <p className="text-lg text-[#faf9f5] mb-2">Rescue Records</p>
        <p className="text-sm">Nenhum registro capturado ainda.</p>
        <p className="text-sm mt-1">Inicie o capture e navegue até Rescue Records no jogo.</p>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4 overflow-y-auto h-full">
      <h1 className="text-xl font-bold text-[#faf9f5]">Rescue Records</h1>

      {/* Banner tabs */}
      <div className="flex gap-1 border-b border-[#2e2c28] pb-0">
        {banners.map((b, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              activeTab === i
                ? 'border-[#cc785c] text-[#cc785c]'
                : 'border-transparent text-[#a09d96] hover:text-[#faf9f5]'
            }`}
          >
            {b.banner_name}
          </button>
        ))}
      </div>

      <BannerView banner={banners[activeTab]} />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/rescue/RescuePage.tsx package.json package-lock.json
git commit -m "feat(frontend): add RescuePage with banner tabs, stats, portrait grid, history table"
```

---

## Task 10: Register all new routes in App.tsx and final commit

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx imports and routes**

Replace the full `App.tsx` content:

```tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './components/layout/AppShell'
import { useApiPort } from './hooks/useApiPort'
import { setApiPort } from './lib/api'
import { FragmentsPage } from './pages/fragments/FragmentsPage'
import { SetupPage } from './pages/setup/SetupPage'
import { CapturePage } from './pages/capture/CapturePage'
import { RescuePage } from './pages/rescue/RescuePage'

function Placeholder({ name }: { name: string }) {
  return (
    <div className="p-8 text-[#a09d96]">
      <p className="text-lg">{name}</p>
      <p className="text-sm mt-1">Coming in a future plan.</p>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const port = useApiPort()
  useEffect(() => { setApiPort(port) }, [port])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/fragments" replace />} />
          <Route path="optimizer"  element={<Placeholder name="Optimizer" />} />
          <Route path="fragments"  element={<FragmentsPage />} />
          <Route path="combatants" element={<Placeholder name="Combatants" />} />
          <Route path="scoring"    element={<Placeholder name="Scoring" />} />
          <Route path="capture"    element={<CapturePage />} />
          <Route path="setup"      element={<SetupPage />} />
          <Route path="rescue"     element={<RescuePage />} />
          <Route path="about"      element={<Placeholder name="About" />} />
          <Route path="*"          element={<Navigate to="/fragments" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Run full test suite**

Run: `python -m pytest tests/ -v`
Expected: All 19 tests passing

- [ ] **Step 3: Build frontend**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Push to remote**

Run:
```bash
git add src/App.tsx
git commit -m "feat: Plan 4 complete — Capture, Setup, Rescue pages wired end-to-end"
git push
```
