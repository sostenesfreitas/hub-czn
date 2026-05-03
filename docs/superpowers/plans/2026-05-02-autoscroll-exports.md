# Auto-scroll Rescue Capture & JSON Exports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pyautogui-based auto-scroll for rescue record capture and JSON export buttons for rescue records and combatants.

**Architecture:** New `api/routes/autoscroll.py` runs a background thread that clicks via `pyautogui` and broadcasts progress over the existing `/ws` WebSocket; `AutoScrollPanel` in `CapturePage` consumes those messages; two export buttons use blob downloads (rescue from cache, combatants via new batch endpoint).

**Tech Stack:** Python `pyautogui`, `threading`, `asyncio`, FastAPI, React, WebSocket (`/ws` manager)

---

### Task 1: Backend — dependencies, state, autoscroll route, tests

**Files:**
- Modify: `requirements-api.txt`
- Modify: `api/hub_czn_api.spec`
- Modify: `api/state.py`
- Create: `api/routes/autoscroll.py`
- Modify: `api/main.py`
- Create: `tests/api/test_autoscroll.py`
- Modify: `tests/api/conftest.py`

- [ ] **Step 1: Add pyautogui to requirements**

In `requirements-api.txt`, append:
```
pyautogui
```

In `api/hub_czn_api.spec`, find the `hiddenimports` list and add after `'zstandard',`:
```python
        'pyautogui',
        'pynput',
        'pynput.mouse',
        'pynput.keyboard',
```

- [ ] **Step 2: Add `autoscroll_running` to state**

In `api/state.py`, inside `AppState.__init__`, after `self.cancel_flag: list[bool] = [False]`, add:
```python
        # Auto-scroll state
        self.autoscroll_running: bool = False
```

- [ ] **Step 3: Write failing tests**

Create `tests/api/test_autoscroll.py`:
```python
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_autoscroll_start_capture_not_running():
    r = client.post("/api/autoscroll/start")
    assert r.status_code == 422


def test_autoscroll_start_already_running():
    from api.state import state
    state.capture_running = True
    state.autoscroll_running = True
    try:
        r = client.post("/api/autoscroll/start")
        assert r.status_code == 409
    finally:
        state.capture_running = False
        state.autoscroll_running = False


def test_autoscroll_start_success():
    from api.state import state
    state.capture_running = True
    try:
        with patch("api.routes.autoscroll.threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            r = client.post("/api/autoscroll/start")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert state.autoscroll_running is True
    finally:
        state.capture_running = False
        state.autoscroll_running = False


def test_autoscroll_stop():
    from api.state import state
    state.autoscroll_running = True
    try:
        r = client.post("/api/autoscroll/stop")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert state.autoscroll_running is False
    finally:
        state.autoscroll_running = False
```

- [ ] **Step 4: Run tests to verify they fail**

```
pytest tests/api/test_autoscroll.py -v
```
Expected: all 4 tests FAIL with 404 (route doesn't exist yet)

- [ ] **Step 5: Create `api/routes/autoscroll.py`**

```python
from __future__ import annotations

import asyncio
import json
import threading
import time

from fastapi import APIRouter, HTTPException

from api.state import state
from api.routes.ws import manager

router = APIRouter()


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
```

- [ ] **Step 6: Register router in `api/main.py`**

Change line 10:
```python
from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants, optimize, about
```
to:
```python
from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants, optimize, about, autoscroll
```

After `app.include_router(about.router, prefix="/api", tags=["about"])`, add:
```python
    app.include_router(autoscroll.router, prefix="/api", tags=["autoscroll"])
```

- [ ] **Step 7: Update conftest to reset autoscroll/capture state**

Replace the full `tests/api/conftest.py` with:
```python
import pytest
from fastapi.testclient import TestClient
from api.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_optimizer_state():
    from api.state import state
    from game_data.constants import ALL_STAT_NAMES
    from optimizer import GearOptimizer
    state.optimizer = GearOptimizer()
    state.data_loaded = False
    state.loaded_file = None
    state.autoscroll_running = False
    state.capture_running = False
    state.optimizer.char_weights = {}
    state.optimizer.priorities = {name: 0 for name in ALL_STAT_NAMES}
    yield
    state.optimizer = GearOptimizer()
    state.data_loaded = False
    state.loaded_file = None
    state.autoscroll_running = False
    state.capture_running = False
    state.optimizer.char_weights = {}
    state.optimizer.priorities = {name: 0 for name in ALL_STAT_NAMES}
```

- [ ] **Step 8: Run autoscroll tests**

```
pytest tests/api/test_autoscroll.py -v
```
Expected: all 4 tests PASS

- [ ] **Step 9: Run full test suite**

```
pytest tests/ -v
```
Expected: all tests PASS (no regressions from conftest change)

- [ ] **Step 10: Commit**

```bash
git add requirements-api.txt api/hub_czn_api.spec api/state.py api/routes/autoscroll.py api/main.py tests/api/test_autoscroll.py tests/api/conftest.py
git commit -m "feat: add autoscroll backend — pyautogui click loop with WS progress"
```

---

### Task 2: Frontend — AutoScrollPanel in CapturePage

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/pages/capture/CapturePage.tsx`

- [ ] **Step 1: Add autoscroll API methods to `src/lib/api.ts`**

In the `api` object, after `captureOpenSnapshots`, add:
```ts
  autoscrollStart: () => request<{ ok: boolean }>('/api/autoscroll/start', { method: 'POST' }),
  autoscrollStop:  () => request<{ ok: boolean }>('/api/autoscroll/stop',  { method: 'POST' }),
```

- [ ] **Step 2: Add `Loader2` to lucide imports in CapturePage.tsx**

Change line 9 from:
```tsx
import { CheckCircle, XCircle, Radio, Square, FolderOpen, Download } from 'lucide-react'
```
to:
```tsx
import { CheckCircle, XCircle, Radio, Square, FolderOpen, Download, Loader2 } from 'lucide-react'
```

- [ ] **Step 3: Add `AutoScrollPanel` component before `CapturePage`**

In `src/pages/capture/CapturePage.tsx`, insert the following component after the `MutationError` component and before `export function CapturePage()`:

```tsx
type AutoScrollPhase = 'idle' | 'countdown' | 'running' | 'done' | 'stopped'

function AutoScrollPanel({ port, captureRunning }: { port: number; captureRunning: boolean }) {
  const [phase, setPhase] = useState<AutoScrollPhase>('idle')
  const [countdown, setCountdown] = useState(3)
  const [pages, setPages] = useState(0)
  const [records, setRecords] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!captureRunning) setPhase('idle')
  }, [captureRunning])

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>
        switch (msg.type) {
          case 'autoscroll.countdown':
            setCountdown(msg.seconds as number)
            setPhase('countdown')
            break
          case 'autoscroll.progress':
            setPages(msg.pages as number)
            setRecords(msg.records as number)
            setPhase('running')
            break
          case 'autoscroll.done':
            setPages(msg.pages as number)
            setRecords(msg.records as number)
            setPhase('done')
            break
          case 'autoscroll.stopped':
            setPages(msg.pages as number)
            setPhase('stopped')
            break
        }
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [port])

  if (!captureRunning) return null

  async function start() {
    setError(null)
    try {
      await api.autoscrollStart()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar auto-scroll')
    }
  }

  async function stop() {
    await api.autoscrollStop().catch(() => {})
  }

  return (
    <div className="p-3 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-2">
      <p className="text-xs text-[#666666] uppercase tracking-wider">Auto-Scroll</p>

      {phase === 'idle' && (
        <button
          type="button"
          onClick={start}
          className="bg-[#c084fc] hover:bg-[#9333ea] text-white text-xs rounded px-3 py-1.5 text-left transition-colors"
        >
          Iniciar Auto-Scroll
        </button>
      )}

      {phase === 'countdown' && (
        <p className="text-xs text-[#b3b3b3]">
          Posicione o cursor sobre o '&gt;' no jogo...{' '}
          <span className="text-[#c084fc] font-bold">{countdown}</span>
        </p>
      )}

      {phase === 'running' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#b3b3b3] flex items-center gap-1.5">
            <Loader2 size={10} className="animate-spin shrink-0" />
            Página {pages} · {records} registros
          </span>
          <button
            type="button"
            onClick={stop}
            className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
          >
            Parar
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#4ade80] flex items-center gap-1">
            <CheckCircle size={10} className="shrink-0" />
            Concluído! {pages} páginas · {records} registros
          </span>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="text-xs text-[#b3b3b3] hover:text-[#ffffff] shrink-0"
          >
            Reiniciar
          </button>
        </div>
      )}

      {phase === 'stopped' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#b3b3b3]">
            Parado. {pages} páginas · {records} registros
          </span>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="text-xs text-[#b3b3b3] hover:text-[#ffffff] shrink-0"
          >
            Reiniciar
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[#f3727f]">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Use `AutoScrollPanel` inside `CapturePage`**

In `CapturePage`, in the left column (`<div className="w-60 shrink-0 flex flex-col gap-4">`), after the closing `</div>` of the "Secondary actions" section (the `div` containing `snapshotsMutation` and load buttons), add:

```tsx
        <AutoScrollPanel port={port} captureRunning={running} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/pages/capture/CapturePage.tsx
git commit -m "feat: add AutoScrollPanel to CapturePage with WS-driven state machine"
```

---

### Task 3: Backend — combatants export endpoint

**Files:**
- Modify: `api/routes/combatants.py`
- Modify: `tests/api/test_combatants.py`

- [ ] **Step 1: Write failing tests**

In `tests/api/test_combatants.py`, append:
```python
def test_combatants_export_no_data(client):
    response = client.get("/api/combatants/export")
    assert response.status_code == 422


def test_combatants_export_returns_list_when_no_data(client):
    # Verifies route exists and returns 422 (not 404) when no data loaded
    response = client.get("/api/combatants/export")
    assert response.status_code == 422
    assert "No data loaded" in response.json()["detail"]
```

- [ ] **Step 2: Run tests to verify they fail**

```
pytest tests/api/test_combatants.py::test_combatants_export_no_data -v
```
Expected: FAIL with 404 (route doesn't exist)

- [ ] **Step 3: Add export endpoint to `api/routes/combatants.py`**

Append after `get_combatant_stats`:
```python
@router.get("/combatants/export")
def get_combatants_export():
    if not state.data_loaded:
        raise HTTPException(status_code=422, detail="No data loaded")
    result = []
    for name, info in state.optimizer.character_info.items():
        gear = state.optimizer.characters.get(name, [])
        gear_by_slot = {f.slot_num: f for f in gear}
        slots = []
        for slot_num in range(1, 7):
            slot_name = EQUIPMENT_SLOTS.get(slot_num, f"Slot {slot_num}")
            f = gear_by_slot.get(slot_num)
            slots.append({
                "slot": slot_name,
                "slot_num": slot_num,
                "set_name": f.set_name if f else None,
                "level": f.level if f else 0,
                "main_stat": (
                    f"{f.main_stat.name} {f.main_stat.format_value()}"
                    if f and f.main_stat else None
                ),
                "substats": [
                    {
                        "name": s.name,
                        "value": s.format_value(),
                        "roll_count": s.roll_count,
                    }
                    for s in f.substats
                ] if f else [],
                "score": round(f.gear_score, 1) if f else None,
            })
        raw = state.optimizer.calculate_build_stats(gear, name)
        result.append({
            "char_id": name,
            "name": name,
            "res_id": info.res_id,
            "level": info.level,
            "gear_slots": slots,
            "final_stats": {
                "ATK": round(raw.get("ATK", 0)),
                "DEF": round(raw.get("DEF", 0)),
                "HP": round(raw.get("HP", 0)),
                "CRate": round(raw.get("CRate", 0), 1),
                "CDmg": round(raw.get("CDmg", 125), 1),
                "EHP": round(raw.get("EHP", 0)),
            },
        })
    return result
```

- [ ] **Step 4: Run tests**

```
pytest tests/api/test_combatants.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/routes/combatants.py tests/api/test_combatants.py
git commit -m "feat: add /combatants/export batch endpoint"
```

---

### Task 4: Frontend — export buttons for rescue and combatants

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/i18n/pt-BR.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/pages/rescue/RescuePage.tsx`
- Modify: `src/pages/combatants/CombatantsPage.tsx`

- [ ] **Step 1: Add `combatantsExport` to `src/lib/api.ts`**

In the `api` object, after `autoscrollStop`, add:
```ts
  combatantsExport: () => request<unknown[]>('/api/combatants/export'),
```

- [ ] **Step 2: Add translation keys**

In `src/i18n/pt-BR.ts`, in the `rescue:` section, add after `refresh: 'Atualizar',`:
```ts
    exportJson: 'Exportar JSON',
```

In the `combatants:` section, add after `emptyHint`:
```ts
    exportJson: 'Exportar JSON',
```

In `src/i18n/en.ts`, in the `rescue:` section (search for `rescue: {`), add after the `refresh:` key:
```ts
    exportJson: 'Export JSON',
```

In the `combatants:` section (search for `combatants: {`), add after the `emptyHint:` key:
```ts
    exportJson: 'Export JSON',
```

- [ ] **Step 3: Add export button and function to `src/pages/rescue/RescuePage.tsx`**

Add `Download` to the lucide imports:
```tsx
import { User, RefreshCw, Download } from 'lucide-react'
```

Add `exportRescue` function before `RescuePage`:
```tsx
function exportRescue(banners: RescueBanner[]) {
  const blob = new Blob([JSON.stringify(banners, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rescue_records.json'
  a.click()
  URL.revokeObjectURL(url)
}
```

Replace the header row in `RescuePage` (the `div` containing the `<h1>` and the conditional refresh button):
```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('rescue.title')}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff]"
            onClick={() => exportRescue(banners)}
          >
            <Download size={13} className="mr-1" />
            {t('rescue.exportJson')}
          </Button>
          {!capturing && (
            <Button
              size="sm"
              variant="outline"
              className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff]"
              onClick={() => qc.invalidateQueries({ queryKey: ['rescue-records'] })}
            >
              <RefreshCw size={13} className="mr-1" />
              {t('rescue.refresh')}
            </Button>
          )}
        </div>
      </div>
```

- [ ] **Step 4: Add export button to `src/pages/combatants/CombatantsPage.tsx`**

Add `Download` to the lucide imports:
```tsx
import { RefreshCw, User, Loader2, ChevronDown, ChevronRight, Download } from 'lucide-react'
```

In `CombatantsPage`, add `exporting` state and `exportCombatants` function after the `handleToggle` definition:
```tsx
  const [exporting, setExporting] = useState(false)

  async function exportCombatants() {
    setExporting(true)
    try {
      const data = await api.combatantsExport()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'combatants.json'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }
```

Replace the final `return` block (currently `return (<div className="flex-1 overflow-y-auto p-4 space-y-1.5">...`)` with:
```tsx
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-end px-4 pt-3 pb-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          disabled={exporting}
          onClick={exportCombatants}
          className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff] disabled:opacity-40"
        >
          {exporting
            ? <Loader2 size={13} className="mr-1 animate-spin" />
            : <Download size={13} className="mr-1" />
          }
          {t('combatants.exportJson')}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {combatants.map((c, i) => (
          <CombatantRow
            key={c.char_id}
            combatant={c}
            rank={i + 1}
            expanded={expandedId === c.char_id}
            onToggle={() => handleToggle(c.char_id)}
          />
        ))}
      </div>
    </div>
  )
```

Also add `Button` to the imports (it's already imported via `@/components/ui/button` in RescuePage — check if CombatantsPage already has it). Looking at CombatantsPage imports, `Button` is not imported. Add:
```tsx
import { Button } from '@/components/ui/button'
```

- [ ] **Step 5: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Run full test suite**

```
pytest tests/ -v
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts src/i18n/pt-BR.ts src/i18n/en.ts src/pages/rescue/RescuePage.tsx src/pages/combatants/CombatantsPage.tsx
git commit -m "feat: add JSON export buttons for rescue records and combatants"
```
