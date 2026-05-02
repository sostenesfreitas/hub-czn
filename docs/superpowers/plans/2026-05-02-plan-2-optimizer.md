# Optimizer Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/optimizer` page: a left config panel (character, sets, stats, filters) + right results area (progress feed, ranked results table with inline gear detail), powered by a new backend route that runs `GearOptimizer.optimize()` in a background thread and streams progress via the existing WebSocket.

**Architecture:** New `api/routes/optimize.py` exposes 3 endpoints; the `POST /start` handler runs the optimizer in a thread executor and uses `asyncio.run_coroutine_threadsafe` to push progress/done/error events through `manager.broadcast()` on `/ws`. The frontend `OptimizerPage` opens a WebSocket on mount, maintains job state locally, and renders `OptimizerPanel` (left) + `ResultsArea` (right). `GearSlotCard` and `FinalStatsPanel` from `CombatantDetail.tsx` are exported and reused in the build detail view.

**Tech Stack:** FastAPI + Pydantic v2, Python asyncio + ThreadPoolExecutor, existing `_Manager` singleton in `api/routes/ws.py`, React 18 + TanStack Query v5, Tailwind CSS (dark theme tokens: `#181715`, `#252320`, `#2e2c28`, `#cc785c`, `#faf9f5`, `#a09d96`, `#c64545`), `useApiPort` hook for dynamic port.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add 4 new interfaces |
| Modify | `src/lib/api.ts` | Add 3 new API methods |
| Modify | `api/state.py` | Add `job_id` and `cancel_flag` fields |
| Create | `api/routes/optimize.py` | 3 endpoints + background job |
| Modify | `api/main.py` | Register optimize router |
| Create | `tests/api/test_optimize.py` | Backend tests |
| Modify | `src/pages/combatants/CombatantDetail.tsx` | Export `GearSlotCard` + `FinalStatsPanel` |
| Create | `src/pages/optimizer/SetCombobox.tsx` | Reusable search combobox with tags |
| Create | `src/pages/optimizer/OptimizerPanel.tsx` | Left config panel |
| Create | `src/pages/optimizer/ResultsArea.tsx` | Right results + build detail |
| Create | `src/pages/optimizer/OptimizerPage.tsx` | Page with state + WS |
| Modify | `src/App.tsx` | Replace Placeholder with OptimizerPage |

---

## Task 1: TypeScript types + API client

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add 4 new interfaces to `src/lib/types.ts`**

Append after the last interface in the file (after `ScoringPriorities`):

```typescript
export interface OptimizerConfig {
  char_name: string
  four_piece_sets: number[]
  two_piece_sets: number[]
  main_stat_4: string | null
  main_stat_5: string | null
  main_stat_6: string | null
  top_percent: number
  include_equipped: boolean
  excluded_heroes: string[]
  max_results: number
}

export interface OptimizeProgress {
  checked: number
  total: number
  found: number
}

export interface OptimizeResult {
  rank: number
  score: number
  gear_slots: GearSlot[]
  final_stats: FinalStats
}

export interface EquipmentSet {
  id: number
  name: string
}
```

- [ ] **Step 2: Add import of new types and 3 API methods to `src/lib/api.ts`**

In the import block at the top of `api.ts`, add `OptimizerConfig` and `EquipmentSet` to the imported types:

```typescript
import type {
  ApiStatus, GameData, LoadResponse, MemoryFragment,
  SetupStatus, SetupActionResponse, CaptureStatus,
  CaptureStartRequest, CaptureStopResponse, RescueBanner,
  Combatant, CombatantStats, ScoringPriorities,
  OptimizerConfig, EquipmentSet,
} from './types'
```

At the bottom of the `api` object (after `saveScoringPriorities`), add:

```typescript
  optimizeSets: () => request<EquipmentSet[]>('/api/optimize/sets'),

  optimizeStart: (config: OptimizerConfig) =>
    request<{ job_id: string }>('/api/optimize/start', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  optimizeCancel: () =>
    request<{ cancelled: boolean }>('/api/optimize/cancel', { method: 'POST' }),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts
git commit -m "feat: add optimizer TypeScript types and API client methods"
```

---

## Task 2: Backend optimize route + tests

**Files:**
- Modify: `api/state.py`
- Create: `api/routes/optimize.py`
- Modify: `api/main.py`
- Create: `tests/api/test_optimize.py`

- [ ] **Step 1: Write failing tests in `tests/api/test_optimize.py`**

```python
def test_optimize_sets_returns_sorted_list(client):
    response = client.get("/api/optimize/sets")
    assert response.status_code == 200
    sets = response.json()
    assert isinstance(sets, list)
    assert len(sets) > 0
    names = [s["name"] for s in sets]
    assert names == sorted(names)


def test_optimize_sets_each_item_has_id_and_name(client):
    sets = client.get("/api/optimize/sets").json()
    assert all("id" in s and "name" in s for s in sets)


def test_optimize_start_no_data_returns_422(client):
    response = client.post("/api/optimize/start", json={
        "char_name": "Nine",
        "four_piece_sets": [],
        "two_piece_sets": [],
        "top_percent": 100,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 10,
    })
    assert response.status_code == 422


def test_optimize_start_invalid_top_percent_returns_422(client):
    response = client.post("/api/optimize/start", json={
        "char_name": "Nine",
        "four_piece_sets": [],
        "two_piece_sets": [],
        "top_percent": 0,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 10,
    })
    assert response.status_code == 422


def test_optimize_cancel_no_job_returns_not_cancelled(client):
    response = client.post("/api/optimize/cancel")
    assert response.status_code == 200
    assert response.json() == {"cancelled": False}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/api/test_optimize.py -v
```
Expected: `FAILED` with `404 Not Found` (endpoints don't exist yet)

- [ ] **Step 3: Add job tracking fields to `api/state.py`**

In `AppState.__init__`, add after the `log_queue` line:

```python
        # Optimizer job state
        self.job_id: str | None = None
        self.cancel_flag: list[bool] = [False]
```

- [ ] **Step 4: Create `api/routes/optimize.py`**

```python
from __future__ import annotations
import asyncio
import sys
import os
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

try:
    from game_data.sets import SETS
    from game_data.constants import EQUIPMENT_SLOTS
except ImportError:
    SETS = {}
    EQUIPMENT_SLOTS = {}

from api.state import state
from api.routes.ws import manager

router = APIRouter()


class OptimizeStartRequest(BaseModel):
    char_name: str
    four_piece_sets: list[int] = Field(default_factory=list)
    two_piece_sets: list[int] = Field(default_factory=list)
    main_stat_4: str | None = None
    main_stat_5: str | None = None
    main_stat_6: str | None = None
    top_percent: int = Field(default=100, ge=1, le=100)
    include_equipped: bool = True
    excluded_heroes: list[str] = Field(default_factory=list)
    max_results: int = Field(default=10, ge=1, le=50)


def _format_results(results: list) -> list[dict]:
    formatted = []
    for rank, (gear_list, score, raw_stats) in enumerate(results, 1):
        gear_sorted = sorted(gear_list, key=lambda f: f.slot_num)
        gear_slots = [
            {
                "slot": EQUIPMENT_SLOTS.get(p.slot_num, f"Slot {p.slot_num}"),
                "main_stat": f"{p.main_stat.name} {p.main_stat.format_value()}" if p.main_stat else None,
                "substats": [f"{s.name} {s.format_value()}" for s in p.substats],
                "score": round(p.gear_score, 1),
            }
            for p in gear_sorted
        ]
        final_stats = {
            "ATK": round(raw_stats.get("ATK", 0)),
            "DEF": round(raw_stats.get("DEF", 0)),
            "HP": round(raw_stats.get("HP", 0)),
            "CRate": round(raw_stats.get("CRate", 0), 1),
            "CDmg": round(raw_stats.get("CDmg", 125), 1),
            "EHP": round(raw_stats.get("EHP", 0)),
            "AvgDMG": round(raw_stats.get("Avg DMG", 0)),
        }
        formatted.append({
            "rank": rank,
            "score": round(score, 1),
            "gear_slots": gear_slots,
            "final_stats": final_stats,
        })
    return formatted


@router.get("/optimize/sets")
def optimize_sets():
    return sorted(
        [{"id": sid, "name": s["name"]} for sid, s in SETS.items()],
        key=lambda x: x["name"],
    )


@router.post("/optimize/start")
async def optimize_start(body: OptimizeStartRequest):
    if not state.data_loaded:
        raise HTTPException(status_code=422, detail="No data loaded")
    if body.char_name not in state.optimizer.character_info:
        raise HTTPException(status_code=422, detail=f"Unknown character: {body.char_name}")
    if state.job_id is not None:
        raise HTTPException(status_code=409, detail="A job is already running")

    job_id = str(uuid4())
    state.job_id = job_id
    state.cancel_flag = [False]

    settings = {
        "four_piece_sets": body.four_piece_sets,
        "two_piece_sets": body.two_piece_sets,
        "main_stat_4": [body.main_stat_4] if body.main_stat_4 else [],
        "main_stat_5": [body.main_stat_5] if body.main_stat_5 else [],
        "main_stat_6": [body.main_stat_6] if body.main_stat_6 else [],
        "top_percent": body.top_percent,
        "include_equipped": body.include_equipped,
        "excluded_heroes": body.excluded_heroes,
        "max_results": body.max_results,
    }

    loop = asyncio.get_running_loop()

    async def _run() -> None:
        try:
            def progress_cb(checked: int, total: int, found: int) -> None:
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({
                        "type": "optimize.progress",
                        "checked": checked,
                        "total": total,
                        "found": found,
                    }),
                    loop,
                )

            results = await loop.run_in_executor(
                None,
                lambda: state.optimizer.optimize(
                    body.char_name, settings, progress_cb, state.cancel_flag
                ),
            )

            if state.cancel_flag[0]:
                await manager.broadcast({"type": "optimize.cancelled"})
            else:
                await manager.broadcast({
                    "type": "optimize.done",
                    "results": _format_results(results),
                })
        except Exception as exc:
            await manager.broadcast({"type": "optimize.error", "message": str(exc)})
        finally:
            state.job_id = None

    asyncio.create_task(_run())
    return {"job_id": job_id}


@router.post("/optimize/cancel")
async def optimize_cancel():
    if state.job_id is None:
        return {"cancelled": False}
    state.cancel_flag[0] = True
    return {"cancelled": True}
```

- [ ] **Step 5: Register the router in `api/main.py`**

Change the import line at line 8 from:
```python
from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants
```
to:
```python
from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants, optimize
```

After `app.include_router(combatants.router, ...)`, add:
```python
    app.include_router(optimize.router, prefix="/api", tags=["optimize"])
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pytest tests/api/test_optimize.py -v
```
Expected:
```
PASSED tests/api/test_optimize.py::test_optimize_sets_returns_sorted_list
PASSED tests/api/test_optimize.py::test_optimize_sets_each_item_has_id_and_name
PASSED tests/api/test_optimize.py::test_optimize_start_no_data_returns_422
PASSED tests/api/test_optimize.py::test_optimize_start_invalid_top_percent_returns_422
PASSED tests/api/test_optimize.py::test_optimize_cancel_no_job_returns_not_cancelled
```

- [ ] **Step 7: Run full test suite to confirm no regressions**

```bash
pytest tests/ -v
```
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add api/state.py api/routes/optimize.py api/main.py tests/api/test_optimize.py
git commit -m "feat: add optimize backend route with WS streaming and job cancellation"
```

---

## Task 3: Export GearSlotCard + FinalStatsPanel

**Files:**
- Modify: `src/pages/combatants/CombatantDetail.tsx:6,42`

The two subcomponents are currently private functions. Add `export` so `ResultsArea` can import them.

- [ ] **Step 1: Export both functions**

In `src/pages/combatants/CombatantDetail.tsx`, change line 6 from:
```typescript
function GearSlotCard({ slot }: { slot: GearSlot }) {
```
to:
```typescript
export function GearSlotCard({ slot }: { slot: GearSlot }) {
```

Change line 42 from:
```typescript
function FinalStatsPanel({ stats }: { stats: FinalStats }) {
```
to:
```typescript
export function FinalStatsPanel({ stats }: { stats: FinalStats }) {
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors (no callers broken — they're new exports, not renames)

- [ ] **Step 3: Commit**

```bash
git add src/pages/combatants/CombatantDetail.tsx
git commit -m "feat: export GearSlotCard and FinalStatsPanel for reuse in optimizer"
```

---

## Task 4: SetCombobox component

**Files:**
- Create: `src/pages/optimizer/SetCombobox.tsx`

Reusable combobox: type to filter options, selected items appear as removable tags. Used for both set selection and hero exclusion.

- [ ] **Step 1: Create `src/pages/optimizer/SetCombobox.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Loader2 } from 'lucide-react'

export interface ComboboxOption {
  id: string
  label: string
}

interface SetComboboxProps {
  options: ComboboxOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  maxSelect: number
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
}

export function SetCombobox({
  options,
  selected,
  onChange,
  maxSelect,
  placeholder = 'Buscar...',
  disabled = false,
  isLoading = false,
}: SetComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) &&
      !selected.includes(o.id)
  )

  function add(id: string) {
    if (maxSelect === 1) {
      onChange([id])
    } else if (selected.length < maxSelect) {
      onChange([...selected, id])
    }
    setQuery('')
    setOpen(false)
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id))
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const atMax = selected.length >= maxSelect && maxSelect !== 99
  const inputDisabled = disabled || isLoading || (atMax && maxSelect > 1)

  return (
    <div ref={containerRef} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((id) => {
            const opt = options.find((o) => o.id === id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-[#cc785c]/20 border border-[#cc785c]/40 text-[#cc785c] text-xs rounded px-2 py-0.5"
              >
                {opt?.label ?? id}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    aria-label={`Remover ${opt?.label ?? id}`}
                    className="hover:text-[#faf9f5] transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="relative">
        {isLoading ? (
          <Loader2
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a09d96] animate-spin"
          />
        ) : (
          <ChevronDown
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a09d96] pointer-events-none"
          />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          disabled={inputDisabled}
          placeholder={
            atMax && maxSelect === 1
              ? (options.find((o) => o.id === selected[0])?.label ?? placeholder)
              : placeholder
          }
          className={[
            'w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs',
            'text-[#faf9f5] placeholder-[#3a3835] outline-none focus:border-[#cc785c]',
            isLoading ? 'pl-7' : '',
            inputDisabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
      </div>

      {open && !inputDisabled && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#252320] border border-[#2e2c28] rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => add(opt.id)}
              className="w-full text-left px-3 py-1.5 text-xs text-[#faf9f5] hover:bg-[#2e2c28] transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/optimizer/SetCombobox.tsx
git commit -m "feat: add SetCombobox reusable component for set and hero selection"
```

---

## Task 5: OptimizerPanel component

**Files:**
- Create: `src/pages/optimizer/OptimizerPanel.tsx`

Left fixed panel containing all config fields, progress bar, and Run/Cancel button. Queries `api.status()` to detect if data is loaded.

- [ ] **Step 1: Create `src/pages/optimizer/OptimizerPanel.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Play, Square } from 'lucide-react'
import { api } from '@/lib/api'
import type { OptimizerConfig, EquipmentSet } from '@/lib/types'
import type { Combatant } from '@/lib/types'
import { SetCombobox } from './SetCombobox'
import type { ComboboxOption } from './SetCombobox'
import type { OptimizeProgress } from '@/lib/types'

const SLOT_4_STATS = ['ATK%', 'DEF%', 'HP%', 'CRate', 'CDmg']
const SLOT_5_STATS = [
  'ATK%', 'DEF%', 'HP%',
  'Passion DMG%', 'Order DMG%', 'Justice DMG%', 'Void DMG%', 'Instinct DMG%',
]
const SLOT_6_STATS = ['ATK%', 'DEF%', 'HP%', 'Ego']

const MAIN_STAT_SLOTS = [
  { label: 'Main stat slot 4', key: 'main_stat_4' as const, opts: SLOT_4_STATS },
  { label: 'Main stat slot 5', key: 'main_stat_5' as const, opts: SLOT_5_STATS },
  { label: 'Main stat slot 6', key: 'main_stat_6' as const, opts: SLOT_6_STATS },
]

interface OptimizerPanelProps {
  config: OptimizerConfig
  onChange: (config: OptimizerConfig) => void
  onRun: () => void
  onCancel: () => void
  isRunning: boolean
  progress: OptimizeProgress | null
  runError: string | null
}

export function OptimizerPanel({
  config,
  onChange,
  onRun,
  onCancel,
  isRunning,
  progress,
  runError,
}: OptimizerPanelProps) {
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.status(),
    refetchInterval: 5_000,
  })

  const { data: combatants = [] } = useQuery<Combatant[]>({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    enabled: status?.data_loaded ?? false,
    staleTime: 30_000,
  })

  const { data: sets = [], isLoading: setsLoading } = useQuery<EquipmentSet[]>({
    queryKey: ['optimize/sets'],
    queryFn: () => api.optimizeSets(),
  })

  const dataLoaded = status?.data_loaded ?? false
  const disabled = isRunning

  const setOptions: ComboboxOption[] = sets.map((s) => ({
    id: String(s.id),
    label: s.name,
  }))

  const heroOptions: ComboboxOption[] = combatants.map((c) => ({
    id: c.char_id,
    label: c.name,
  }))

  function patch(partial: Partial<OptimizerConfig>) {
    onChange({ ...config, ...partial })
  }

  const canRun = dataLoaded && config.char_name !== '' && !isRunning

  const panelBase = 'w-64 shrink-0 bg-[#252320] border-r border-[#2e2c28] p-4'

  if (!dataLoaded) {
    return (
      <aside className={`${panelBase} flex items-start`}>
        <p className="text-sm text-[#a09d96] mt-2">
          Carregue um arquivo na tela Fragmentos para usar o otimizador.
        </p>
      </aside>
    )
  }

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.checked / progress.total) * 100)
      : 0

  return (
    <aside className={`${panelBase} overflow-y-auto space-y-4`}>
      {/* Character */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Personagem
        </label>
        <select
          value={config.char_name}
          onChange={(e) => patch({ char_name: e.target.value })}
          disabled={disabled || combatants.length === 0}
          className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Selecione...</option>
          {combatants.map((c) => (
            <option key={c.char_id} value={c.char_id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* 4-piece set */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Set 4 peças
        </label>
        <SetCombobox
          options={setOptions}
          selected={config.four_piece_sets.map(String)}
          onChange={(ids) => patch({ four_piece_sets: ids.map(Number) })}
          maxSelect={1}
          placeholder="Qualquer"
          disabled={disabled}
          isLoading={setsLoading}
        />
      </div>

      {/* 2-piece sets */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Sets 2 peças
        </label>
        <SetCombobox
          options={setOptions}
          selected={config.two_piece_sets.map(String)}
          onChange={(ids) => patch({ two_piece_sets: ids.map(Number) })}
          maxSelect={2}
          placeholder="Nenhum"
          disabled={disabled}
          isLoading={setsLoading}
        />
      </div>

      {/* Main stats */}
      {MAIN_STAT_SLOTS.map(({ label, key, opts }) => (
        <div key={key} className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
            {label}
          </label>
          <select
            value={config[key] ?? ''}
            onChange={(e) => patch({ [key]: e.target.value || null })}
            disabled={disabled}
            className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Qualquer</option>
            {opts.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Filters */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
            Top % do gear
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={config.top_percent}
            onChange={(e) => patch({ top_percent: Number(e.target.value) })}
            onBlur={(e) =>
              patch({ top_percent: Math.min(100, Math.max(1, Number(e.target.value))) })
            }
            disabled={disabled}
            className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
            Máx. resultados
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={config.max_results}
            onChange={(e) => patch({ max_results: Number(e.target.value) })}
            onBlur={(e) =>
              patch({ max_results: Math.min(50, Math.max(1, Number(e.target.value))) })
            }
            disabled={disabled}
            className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.include_equipped}
            onChange={(e) => patch({ include_equipped: e.target.checked })}
            disabled={disabled}
            className="accent-[#cc785c]"
          />
          <span className="text-xs text-[#faf9f5]">Incluir gear equipado</span>
        </label>
      </div>

      {/* Excluded heroes */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Excluir personagens
        </label>
        <SetCombobox
          options={heroOptions}
          selected={config.excluded_heroes}
          onChange={(ids) => patch({ excluded_heroes: ids })}
          maxSelect={99}
          placeholder="Nenhum"
          disabled={disabled}
        />
      </div>

      {/* Progress bar (running only) */}
      {isRunning && (
        <div className="space-y-1">
          <div className="h-1.5 bg-[#2e2c28] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#cc785c] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-[#a09d96] tabular-nums">
            {progressPct}%
          </p>
        </div>
      )}

      {/* Run error */}
      {runError && (
        <p role="alert" className="text-xs text-[#c64545]">
          {runError}
        </p>
      )}

      {/* Run / Cancel */}
      {isRunning ? (
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2 bg-[#2e2c28] hover:bg-[#3a3835] border border-[#3a3835] rounded py-2 text-xs text-[#faf9f5] transition-colors"
        >
          <Square size={12} />
          Cancelar
        </button>
      ) : (
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="w-full flex items-center justify-center gap-2 bg-[#cc785c] hover:bg-[#d4895e] rounded py-2 text-xs text-[#181715] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={12} />
          Otimizar
        </button>
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/optimizer/OptimizerPanel.tsx
git commit -m "feat: add OptimizerPanel config component"
```

---

## Task 6: ResultsArea component

**Files:**
- Create: `src/pages/optimizer/ResultsArea.tsx`

Right panel showing idle prompt, live progress feed, ranked results table with inline build detail expansion.

- [ ] **Step 1: Create `src/pages/optimizer/ResultsArea.tsx`**

```tsx
import { Loader2 } from 'lucide-react'
import type { OptimizeResult, OptimizeProgress } from '@/lib/types'
import { GearSlotCard, FinalStatsPanel } from '@/pages/combatants/CombatantDetail'

type JobState = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

interface ResultsAreaProps {
  jobState: JobState
  progress: OptimizeProgress | null
  results: OptimizeResult[]
  selectedRank: number | null
  onSelectRank: (rank: number) => void
  jobError: string | null
}

export function ResultsArea({
  jobState,
  progress,
  results,
  selectedRank,
  onSelectRank,
  jobError,
}: ResultsAreaProps) {
  if (jobState === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center text-[#3a3835] text-sm">
        Configure os parâmetros e clique em Otimizar.
      </div>
    )
  }

  if (jobState === 'running') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 size={20} className="animate-spin text-[#cc785c]" />
        <p role="status" className="text-sm text-[#a09d96] text-center">
          {progress
            ? `Verificando ${progress.checked.toLocaleString()} / ${progress.total.toLocaleString()} combinações · ${progress.found} builds encontradas`
            : 'Iniciando otimização...'}
        </p>
      </div>
    )
  }

  if (jobState === 'cancelled') {
    return (
      <div className="flex-1 flex items-center justify-center text-[#a09d96] text-sm">
        Otimização cancelada.
      </div>
    )
  }

  if (jobState === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p role="alert" className="text-sm text-[#c64545] text-center">
          {jobError ?? 'Erro durante a otimização.'}
        </p>
      </div>
    )
  }

  // jobState === 'done'
  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#a09d96] text-sm">
        Nenhuma build encontrada. Tente relaxar os filtros.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div
        className="grid gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-[#a09d96] mb-1"
        style={{ gridTemplateColumns: '2rem 1fr 1fr 1fr 1fr 1fr' }}
      >
        <span>#</span>
        <span>Score</span>
        <span>ATK</span>
        <span>CRate</span>
        <span>CDmg</span>
        <span>EHP</span>
      </div>

      <div className="space-y-1">
        {results.map((r) => {
          const expanded = selectedRank === r.rank
          return (
            <div
              key={r.rank}
              className="bg-[#252320] border border-[#2e2c28] rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => onSelectRank(r.rank)}
                aria-pressed={expanded}
                className={[
                  'w-full grid gap-2 px-3 py-2.5 text-xs text-left transition-colors',
                  expanded
                    ? 'bg-[#cc785c]/10 border-b border-[#2e2c28]'
                    : 'hover:bg-[#2e2c28]',
                ].join(' ')}
                style={{ gridTemplateColumns: '2rem 1fr 1fr 1fr 1fr 1fr' }}
              >
                <span
                  className={`font-semibold ${expanded ? 'text-[#cc785c]' : 'text-[#a09d96]'}`}
                >
                  {r.rank}
                </span>
                <span className="text-[#faf9f5] font-semibold">
                  {r.score.toFixed(1)}
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.ATK.toLocaleString()}
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.CRate.toFixed(1)}%
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.CDmg.toFixed(1)}%
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.EHP.toLocaleString()}
                </span>
              </button>

              {expanded && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {r.gear_slots.map((slot) => (
                      <GearSlotCard key={slot.slot} slot={slot} />
                    ))}
                  </div>
                  <FinalStatsPanel stats={r.final_stats} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/optimizer/ResultsArea.tsx
git commit -m "feat: add ResultsArea component with inline build detail expansion"
```

---

## Task 7: OptimizerPage + App.tsx wire-up

**Files:**
- Create: `src/pages/optimizer/OptimizerPage.tsx`
- Modify: `src/App.tsx`

The page owns all state, opens the WebSocket, and glues panel + results together.

- [ ] **Step 1: Create `src/pages/optimizer/OptimizerPage.tsx`**

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useApiPort } from '@/hooks/useApiPort'
import { api } from '@/lib/api'
import type { OptimizerConfig, OptimizeProgress, OptimizeResult } from '@/lib/types'
import { OptimizerPanel } from './OptimizerPanel'
import { ResultsArea } from './ResultsArea'

type JobState = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

const DEFAULT_CONFIG: OptimizerConfig = {
  char_name: '',
  four_piece_sets: [],
  two_piece_sets: [],
  main_stat_4: null,
  main_stat_5: null,
  main_stat_6: null,
  top_percent: 100,
  include_equipped: true,
  excluded_heroes: [],
  max_results: 10,
}

export function OptimizerPage() {
  const port = useApiPort()
  const [config, setConfig] = useState<OptimizerConfig>(DEFAULT_CONFIG)
  const [jobState, setJobState] = useState<JobState>('idle')
  const [progress, setProgress] = useState<OptimizeProgress | null>(null)
  const [results, setResults] = useState<OptimizeResult[]>([])
  const [selectedRank, setSelectedRank] = useState<number | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  // Ref so WS onclose callback can read current jobState without stale closure
  const jobStateRef = useRef<JobState>('idle')
  jobStateRef.current = jobState

  // WebSocket: open on mount, reopen if port changes
  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)

    ws.onmessage = (e: MessageEvent) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(e.data as string) as Record<string, unknown>
      } catch {
        return
      }

      switch (msg.type) {
        case 'optimize.progress':
          setProgress({
            checked: msg.checked as number,
            total: msg.total as number,
            found: msg.found as number,
          })
          break
        case 'optimize.done':
          setResults(msg.results as OptimizeResult[])
          setJobState('done')
          setProgress(null)
          break
        case 'optimize.cancelled':
          setJobState('cancelled')
          setResults([])
          setProgress(null)
          break
        case 'optimize.error':
          setJobState('error')
          setJobError((msg.message as string) ?? 'Erro desconhecido')
          setProgress(null)
          break
      }
    }

    ws.onclose = () => {
      if (jobStateRef.current === 'running') {
        setJobState('error')
        setJobError('Conexão perdida. Recarregue a página e tente novamente.')
        setProgress(null)
      }
    }

    return () => ws.close()
  }, [port])

  const handleConfigChange = useCallback((newConfig: OptimizerConfig) => {
    setConfig(newConfig)
    // Any config change while done resets the results
    if (jobStateRef.current === 'done') {
      setJobState('idle')
      setResults([])
      setSelectedRank(null)
    }
  }, [])

  const handleRun = useCallback(async () => {
    setRunError(null)
    setJobState('running')
    setProgress(null)
    setResults([])
    setSelectedRank(null)
    setJobError(null)
    try {
      await api.optimizeStart(config)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar otimização'
      setRunError(
        msg.includes('andamento') ? 'Já existe uma otimização em andamento' : msg
      )
      setJobState('idle')
    }
  }, [config])

  const handleCancel = useCallback(async () => {
    await api.optimizeCancel().catch(() => {})
  }, [])

  const handleSelectRank = useCallback((rank: number) => {
    setSelectedRank((prev) => (prev === rank ? null : rank))
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <OptimizerPanel
        config={config}
        onChange={handleConfigChange}
        onRun={handleRun}
        onCancel={handleCancel}
        isRunning={jobState === 'running'}
        progress={progress}
        runError={runError}
      />
      <ResultsArea
        jobState={jobState}
        progress={progress}
        results={results}
        selectedRank={selectedRank}
        onSelectRank={handleSelectRank}
        jobError={jobError}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx` to import and use OptimizerPage**

Add the import at line 12 (after the CombatantsPage import):
```typescript
import { OptimizerPage } from './pages/optimizer/OptimizerPage'
```

Change line 41 from:
```tsx
          <Route path="optimizer"  element={<Placeholder name="Optimizer" />} />
```
to:
```tsx
          <Route path="optimizer"  element={<OptimizerPage />} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Start the dev server and verify the page loads**

```bash
npm run dev
```

Open `http://localhost:5173/optimizer` in the browser.

Expected:
- Left panel shows "Carregue um arquivo na tela Fragmentos" (no data loaded state)
- Right area shows "Configure os parâmetros e clique em Otimizar."
- No console errors

If data is loaded:
- Left panel shows character dropdown, set comboboxes, main stat dropdowns, filter inputs, and Otimizar button
- Selecting "Qualquer" (empty) for sets and clicking Otimizar sends a POST to `/api/optimize/start`
- Results table appears after optimization completes
- Clicking a row expands gear detail inline

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -v
```
Expected: all tests pass (33 existing + 5 new = 38 total)

- [ ] **Step 6: Commit**

```bash
git add src/pages/optimizer/OptimizerPage.tsx src/App.tsx
git commit -m "feat: add OptimizerPage and wire up /optimizer route"
```
