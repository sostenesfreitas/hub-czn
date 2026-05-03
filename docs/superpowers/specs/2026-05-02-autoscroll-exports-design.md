# Auto-scroll Rescue Capture & JSON Exports — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automate pagination through the game's rescue records screen and add JSON export buttons for rescue records and combatants.

**Architecture:** Three independent features added to existing pages. Auto-scroll uses `pyautogui` to click the game's `>` button at regular intervals while capture is running; exports use blob downloads on the frontend (rescue) and a new batch backend endpoint (combatants).

**Tech Stack:** Python `pyautogui`, FastAPI, React, @tanstack/react-query, WebSocket (existing `ws` manager)

**New dependency:** `pyautogui` — add to `requirements-api.txt` and to `hiddenimports` in `api/hub_czn_api.spec`

---

## Feature 1 — Auto-scroll Rescue Capture

### Overview

While capture is running, the user can trigger automatic pagination through the game's rescue records history. The game shows one page at a time; the user must click `>` to advance. With 650+ pages, this takes ~11 minutes manually. Auto-scroll automates it.

### Flow

1. Capture is already running (pre-condition — button is hidden otherwise)
2. User opens rescue records screen in the game
3. User clicks **"Iniciar Auto-Scroll"** in the app
4. App shows a 3-second countdown — user moves cursor to the `>` button in the game
5. App captures cursor position via `pyautogui.position()`
6. App clicks that position every **1.2 seconds** in a background thread
7. After each click, reads the latest `rescue_records_*.json` file and counts total records
8. If 3 consecutive clicks produce no new records → auto-stop (end of history)
9. User can click **"Parar"** to stop manually at any time
10. On stop or auto-stop: WebSocket broadcast with final page/record counts

### Backend

**New file: `api/routes/autoscroll.py`**

State (added to `api/state.py`):
```python
autoscroll_running: bool = False
```

Endpoints:
- `POST /api/autoscroll/start` — validates capture is running, starts background thread, returns `{"ok": True}`
- `POST /api/autoscroll/stop` — sets `state.autoscroll_running = False`, returns `{"ok": True}`

The endpoint captures the running asyncio event loop before spawning the thread (same pattern as `api/routes/optimize.py`):

```python
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
```

Background thread logic:
```python
def _autoscroll_loop(loop):
    import pyautogui, time, json

    # 3-second countdown (broadcast each tick)
    for i in range(3, 0, -1):
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "autoscroll.countdown", "seconds": i}), loop
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
        manager.broadcast({"type": "autoscroll.stopped", "pages": pages}), loop
    )
```

Helper `_read_rescue_count()`:
```python
def _read_rescue_count() -> int:
    try:
        from capture.constants import OUTPUT_DIR
        files = sorted(OUTPUT_DIR.glob("rescue_records_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
        if not files:
            return 0
        data = json.loads(files[0].read_text(encoding="utf-8"))
        return len(data.get("records", []))
    except Exception:
        return 0
```

**Modified: `api/state.py`** — add `autoscroll_running: bool = False`

**Modified: `api/main.py`** (or wherever routers are registered) — include `autoscroll.router`

### Frontend

**Modified: `src/pages/capture/CapturePage.tsx`**

Add an `AutoScrollPanel` component, visible only when `captureStatus.running === true`.

States: `idle | countdown | running | done | stopped`

UI per state:
- `idle`: "Auto-Scroll" section with **"Iniciar Auto-Scroll"** button
- `countdown`: "Posicione o cursor sobre o '>' no jogo... 3" (counts down)
- `running`: spinner + "Página X · Y registros" + **"Parar"** button
- `done`: green checkmark + "Concluído! X páginas · Y registros capturados"
- `stopped`: "Auto-scroll parado. X páginas · Y registros"

WebSocket messages handled:
- `autoscroll.countdown` → update countdown number
- `autoscroll.progress` → update page/record counters
- `autoscroll.done` → transition to `done` state
- `autoscroll.stopped` → transition to `stopped` state

API calls:
- `POST /api/autoscroll/start` on button click
- `POST /api/autoscroll/stop` on "Parar" click

**New types in `src/lib/types.ts`**:
```ts
export interface AutoScrollStatus {
  running: boolean
}
```

**New api methods in `src/lib/api.ts`**:
```ts
autoscrollStart: () => request<{ ok: boolean }>('/api/autoscroll/start', { method: 'POST' }),
autoscrollStop:  () => request<{ ok: boolean }>('/api/autoscroll/stop',  { method: 'POST' }),
```

---

## Feature 2 — Export Rescue Records to JSON

### Overview

Button on the RescuePage header to download the currently loaded rescue banners as a JSON file. No new backend endpoint — uses data already in React Query cache.

### Frontend

**Modified: `src/pages/rescue/RescuePage.tsx`**

Add **"Exportar JSON"** button next to the existing Refresh button. Visible only when `banners.length > 0`.

Click handler:
```ts
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

Output format: the same `RescueBanner[]` structure already rendered on screen (banners with pulls and stats arrays).

---

## Feature 3 — Export Combatants to JSON

### Overview

Button on the CombatantsPage header to download all combatants with their gear and computed stats as a JSON file. Requires a new backend batch endpoint since per-character stats require computation.

### Backend

**Modified: `api/routes/combatants.py`**

New endpoint `GET /api/combatants/export`:
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
                "main_stat": f"{f.main_stat.name} {f.main_stat.format_value()}" if f and f.main_stat else None,
                "substats": [
                    {"name": s.name, "value": s.format_value(), "roll_count": s.roll_count}
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

### Frontend

**Modified: `src/pages/combatants/CombatantsPage.tsx`**

Add **"Exportar JSON"** button in the page header. Visible only when data is loaded (`combatants.length > 0`).

Click handler fetches `/api/combatants/export`, then triggers blob download as `combatants.json`:
```ts
async function exportCombatants() {
  const data = await api.combatantsExport()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'combatants.json'
  a.click()
  URL.revokeObjectURL(url)
}
```

**New api method in `src/lib/api.ts`**:
```ts
combatantsExport: () => request<unknown[]>('/api/combatants/export'),
```

---

## Files Summary

| File | Change |
|------|--------|
| `api/routes/autoscroll.py` | New — auto-scroll endpoints + loop |
| `api/state.py` | Add `autoscroll_running: bool` |
| `api/main.py` | Register autoscroll router |
| `requirements-api.txt` | Add `pyautogui` |
| `api/hub_czn_api.spec` | Add `pyautogui` to `hiddenimports` |
| `api/routes/combatants.py` | Add `GET /combatants/export` |
| `src/pages/capture/CapturePage.tsx` | Add `AutoScrollPanel` component |
| `src/pages/rescue/RescuePage.tsx` | Add export button |
| `src/pages/combatants/CombatantsPage.tsx` | Add export button |
| `src/lib/api.ts` | Add `autoscrollStart`, `autoscrollStop`, `combatantsExport` |
| `src/lib/types.ts` | Add `AutoScrollStatus` |

## Out of Scope

- Automatic game window focus (user keeps game focused during auto-scroll)
- Export of Memory Fragments inventory
- Custom filename for exports
- Auto-scroll for inventory capture (only rescue records)
