# Combatants + Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/combatants` page with character roster grid, expandable gear/stat detail, and an integrated scoring panel to configure stat weights and presets.

**Architecture:** Two new FastAPI route files (`api/routes/scoring.py`, `api/routes/combatants.py`) serve the data; four new React components (`ScoringPanel`, `CombatantCard`, `CombatantDetail`, `CombatantsPage`) render it. State lives in `CombatantsPage` with TanStack Query for server data and local `useState` for draft weights.

**Tech Stack:** FastAPI + Pydantic (backend), React 18 + TanStack Query v5 + Tailwind v4 + shadcn/ui (frontend). No new dependencies needed.

---

## File Map

**Create:**
- `api/routes/scoring.py` — GET/POST `/api/scoring/priorities`
- `api/routes/combatants.py` — GET `/api/combatants`, GET `/api/combatants/{char_id}/stats`
- `tests/api/test_scoring.py`
- `tests/api/test_combatants.py`
- `src/pages/combatants/ScoringPanel.tsx`
- `src/pages/combatants/CombatantCard.tsx`
- `src/pages/combatants/CombatantDetail.tsx`
- `src/pages/combatants/CombatantsPage.tsx`

**Modify:**
- `api/main.py` — include two new routers
- `src/lib/types.ts` — add 5 new interfaces
- `src/lib/api.ts` — add 4 new functions
- `src/App.tsx` — replace Placeholder routes for combatants and scoring

---

## Task 1: Backend — scoring priorities endpoint

**Files:**
- Create: `api/routes/scoring.py`
- Test: `tests/api/test_scoring.py`
- Modify: `api/main.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_scoring.py`:

```python
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))
from game_data.constants import ALL_STAT_NAMES


def test_get_scoring_priorities_returns_all_stat_names(client):
    response = client.get("/api/scoring/priorities")
    assert response.status_code == 200
    body = response.json()
    assert "weights" in body
    assert set(body["weights"].keys()) == set(ALL_STAT_NAMES)


def test_get_scoring_priorities_values_are_ints(client):
    body = client.get("/api/scoring/priorities").json()
    for v in body["weights"].values():
        assert isinstance(v, int)


def test_save_scoring_priorities_round_trips(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    response = client.post("/api/scoring/priorities", json={"weights": weights})
    assert response.status_code == 200
    assert response.json()["weights"] == weights


def test_save_scoring_priorities_value_above_10_returns_422(client):
    weights = {ALL_STAT_NAMES[0]: 11}
    response = client.post("/api/scoring/priorities", json={"weights": weights})
    assert response.status_code == 422


def test_save_scoring_priorities_negative_value_returns_422(client):
    weights = {ALL_STAT_NAMES[0]: -1}
    response = client.post("/api/scoring/priorities", json={"weights": weights})
    assert response.status_code == 422


def test_save_scoring_priorities_unknown_stat_returns_422(client):
    response = client.post("/api/scoring/priorities", json={"weights": {"NONEXISTENT_STAT": 5}})
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests — verify they all fail**

```
pytest tests/api/test_scoring.py -v
```

Expected: 6 errors (`ModuleNotFoundError` or `404` — route does not exist yet).

- [ ] **Step 3: Implement `api/routes/scoring.py`**

```python
from __future__ import annotations
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Annotated

from api.state import state

try:
    from game_data.constants import ALL_STAT_NAMES
except ImportError:
    ALL_STAT_NAMES = []

router = APIRouter()

WeightValue = Annotated[int, Field(ge=0, le=10)]


class ScoringPrioritiesRequest(BaseModel):
    weights: dict[str, WeightValue]


@router.get("/scoring/priorities")
def get_scoring_priorities():
    return {"weights": dict(state.optimizer.priorities)}


@router.post("/scoring/priorities")
def save_scoring_priorities(body: ScoringPrioritiesRequest):
    unknown = [k for k in body.weights if k not in ALL_STAT_NAMES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown stat names: {unknown}")
    state.optimizer.priorities.update(body.weights)
    if state.data_loaded:
        state.optimizer.recalculate_scores()
    return {"weights": dict(state.optimizer.priorities)}
```

- [ ] **Step 4: Register router in `api/main.py`**

Current import line (line 8):
```python
from api.routes import status, data, ws, setup, capture, rescue
```

Replace with:
```python
from api.routes import status, data, ws, setup, capture, rescue, scoring
```

Add after the last `app.include_router` call in `create_app()` (after line 24):
```python
    app.include_router(scoring.router, prefix="/api", tags=["scoring"])
```

- [ ] **Step 5: Run tests — verify all 6 pass**

```
pytest tests/api/test_scoring.py -v
```

Expected: 6 PASSED.

- [ ] **Step 6: Run full test suite — verify no regressions**

```
pytest tests/ -v
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add api/routes/scoring.py tests/api/test_scoring.py api/main.py
git commit -m "feat: add scoring priorities API endpoint"
```

---

## Task 2: Backend — combatants endpoints

**Files:**
- Create: `api/routes/combatants.py`
- Test: `tests/api/test_combatants.py`
- Modify: `api/main.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_combatants.py`:

```python
def test_combatants_no_data_returns_empty_list(client):
    response = client.get("/api/combatants")
    assert response.status_code == 200
    assert response.json() == []


def test_combatants_response_is_list(client):
    body = client.get("/api/combatants").json()
    assert isinstance(body, list)


def test_combatant_stats_no_data_returns_404(client):
    response = client.get("/api/combatants/Nine/stats")
    assert response.status_code == 404


def test_combatant_stats_unknown_char_returns_404(client):
    response = client.get("/api/combatants/NonexistentCharacter/stats")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

```
pytest tests/api/test_combatants.py -v
```

Expected: 4 errors (404 or route-not-found).

- [ ] **Step 3: Implement `api/routes/combatants.py`**

```python
from __future__ import annotations
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

from fastapi import APIRouter, HTTPException

from api.state import state

try:
    from game_data.characters import CHARACTERS
    from game_data.constants import EQUIPMENT_SLOTS
except ImportError:
    CHARACTERS = {}
    EQUIPMENT_SLOTS = {}

router = APIRouter()

CDN_BASE = "https://cdn.czndecksmeta.com/face/character/portrait_character_{res_id}.webp"


def _char_extra(res_id: int) -> dict:
    c = CHARACTERS.get(res_id) or {}
    return {
        "attribute": c.get("attribute", "Unknown"),
        "class": c.get("class", "Unknown"),
    }


@router.get("/combatants")
def get_combatants():
    if not state.data_loaded:
        return []
    result = []
    for name, info in state.optimizer.character_info.items():
        gear = state.optimizer.characters.get(name, [])
        avg_score = sum(f.gear_score for f in gear) / len(gear) if gear else 0.0
        extra = _char_extra(info.res_id)
        result.append({
            "char_id": name,
            "name": name,
            "level": info.level,
            "attribute": extra["attribute"],
            "class": extra["class"],
            "avg_gear_score": round(avg_score, 1),
            "portrait_url": CDN_BASE.format(res_id=info.res_id),
        })
    result.sort(key=lambda c: -c["avg_gear_score"])
    return result


@router.get("/combatants/{char_id}/stats")
def get_combatant_stats(char_id: str):
    if not state.data_loaded:
        raise HTTPException(status_code=404, detail="No data loaded")
    if char_id not in state.optimizer.character_info:
        raise HTTPException(status_code=404, detail=f"Character not found: {char_id}")
    gear = state.optimizer.characters.get(char_id, [])
    gear_by_slot = {f.slot_num: f for f in gear}

    slots = []
    for slot_num in range(1, 7):
        slot_name = EQUIPMENT_SLOTS.get(slot_num, f"Slot {slot_num}")
        f = gear_by_slot.get(slot_num)
        if f is None:
            slots.append({"slot": slot_name, "main_stat": None, "substats": [], "score": None})
        else:
            slots.append({
                "slot": slot_name,
                "main_stat": f"{f.main_stat.name} {f.main_stat.format_value()}" if f.main_stat else None,
                "substats": [f"{s.name} {s.format_value()}" for s in f.substats],
                "score": round(f.gear_score, 1),
            })

    raw = state.optimizer.calculate_build_stats(gear, char_id)
    final_stats = {
        "ATK": round(raw.get("ATK", 0)),
        "DEF": round(raw.get("DEF", 0)),
        "HP": round(raw.get("HP", 0)),
        "CRate": round(raw.get("CRate", 0), 1),
        "CDmg": round(raw.get("CDmg", 125), 1),
        "EHP": round(raw.get("EHP", 0)),
        "AvgDMG": round(raw.get("Avg DMG", 0)),
    }

    return {"char_id": char_id, "gear_slots": slots, "final_stats": final_stats}
```

- [ ] **Step 4: Register router in `api/main.py`**

Update the import line (already modified in Task 1 to include `scoring`) to also include `combatants`:

```python
from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants
```

Add after the scoring router line in `create_app()`:

```python
    app.include_router(combatants.router, prefix="/api", tags=["combatants"])
```

- [ ] **Step 5: Run tests — verify all 4 pass**

```
pytest tests/api/test_combatants.py -v
```

Expected: 4 PASSED.

- [ ] **Step 6: Run full suite**

```
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add api/routes/combatants.py tests/api/test_combatants.py api/main.py
git commit -m "feat: add combatants API endpoints"
```

---

## Task 3: Frontend — types and api client

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add new interfaces to `src/lib/types.ts`**

Append to the end of the file:

```typescript
export interface GearSlot {
  slot: string
  main_stat: string | null
  substats: string[]
  score: number | null
}

export interface FinalStats {
  ATK: number
  DEF: number
  HP: number
  CRate: number
  CDmg: number
  EHP: number
  AvgDMG: number
}

export interface CombatantStats {
  char_id: string
  gear_slots: GearSlot[]
  final_stats: FinalStats
}

export interface Combatant {
  char_id: string
  name: string
  level: number
  attribute: string
  class: string
  avg_gear_score: number
  portrait_url: string
}

export interface ScoringPriorities {
  weights: Record<string, number>
}
```

- [ ] **Step 2: Update the import in `src/lib/api.ts`**

Current import (lines 1-6):
```typescript
import type {
  ApiStatus, GameData, LoadResponse, MemoryFragment,
  SetupStatus, SetupActionResponse, CaptureStatus,
  CaptureStartRequest, CaptureStopResponse, RescueBanner,
} from './types'
```

Replace with:
```typescript
import type {
  ApiStatus, GameData, LoadResponse, MemoryFragment,
  SetupStatus, SetupActionResponse, CaptureStatus,
  CaptureStartRequest, CaptureStopResponse, RescueBanner,
  Combatant, CombatantStats, ScoringPriorities,
} from './types'
```

- [ ] **Step 3: Add four new functions to the `api` object in `src/lib/api.ts`**

Append inside the `api` object, after the `rescueRecords` line (before the closing `}`):

```typescript
  combatants: () => request<Combatant[]>('/api/combatants'),

  combatantStats: (charId: string) =>
    request<CombatantStats>(`/api/combatants/${encodeURIComponent(charId)}/stats`),

  scoringPriorities: () => request<ScoringPriorities>('/api/scoring/priorities'),

  saveScoringPriorities: (weights: Record<string, number>) =>
    request<ScoringPriorities>('/api/scoring/priorities', {
      method: 'POST',
      body: JSON.stringify({ weights }),
    }),
```

- [ ] **Step 4: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts
git commit -m "feat: add combatants and scoring types and api client"
```

---

## Task 4: ScoringPanel component

**Files:**
- Create: `src/pages/combatants/ScoringPanel.tsx`

- [ ] **Step 1: Create `src/pages/combatants/ScoringPanel.tsx`**

```typescript
import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STAT_GROUPS = [
  { label: 'Ofensivo', stats: ['Flat ATK', 'ATK%', 'CRate', 'CDmg', 'Extra DMG%', 'DoT%'] },
  { label: 'Defensivo', stats: ['Flat DEF', 'DEF%', 'Flat HP', 'HP%'] },
  {
    label: 'Elemental',
    stats: ['Passion DMG%', 'Order DMG%', 'Justice DMG%', 'Void DMG%', 'Instinct DMG%'],
  },
  { label: 'Outros', stats: ['Ego'] },
] as const

export const DPS_WEIGHTS: Record<string, number> = {
  'Flat ATK': 7, 'ATK%': 10, 'Extra DMG%': 6,
  'Flat DEF': 1, 'DEF%': 1, 'Flat HP': 1, 'HP%': 1,
  'CRate': 8, 'CDmg': 8, 'Ego': 1, 'DoT%': 3,
  'Passion DMG%': 1, 'Order DMG%': 1, 'Justice DMG%': 1, 'Void DMG%': 1, 'Instinct DMG%': 1,
}

export const TANK_WEIGHTS: Record<string, number> = {
  'Flat ATK': 1, 'ATK%': 1, 'Extra DMG%': 1,
  'Flat DEF': 8, 'DEF%': 10, 'Flat HP': 8, 'HP%': 10,
  'CRate': 1, 'CDmg': 1, 'Ego': 1, 'DoT%': 1,
  'Passion DMG%': 1, 'Order DMG%': 1, 'Justice DMG%': 1, 'Void DMG%': 1, 'Instinct DMG%': 1,
}

type Preset = 'dps' | 'tank' | 'custom'

interface ScoringPanelProps {
  weights: Record<string, number>
  activePreset: Preset
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  onWeightChange: (stat: string, value: number) => void
  onPresetApply: (preset: 'dps' | 'tank') => void
  onReset: () => void
  onSave: () => void
}

function WeightInput({
  stat,
  value,
  onChange,
}: {
  stat: string
  value: number
  onChange: (stat: string, v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-[#a09d96] truncate flex-1">{stat}</span>
      <input
        type="number"
        min={0}
        max={10}
        value={value}
        onChange={e => onChange(stat, Number(e.target.value))}
        onBlur={e => {
          const clamped = Math.max(0, Math.min(10, Number(e.target.value)))
          if (clamped !== value) onChange(stat, clamped)
        }}
        className="w-14 text-right text-sm bg-[#2e2c28] border border-[#3a3835] rounded px-2 py-0.5 text-[#faf9f5] focus:outline-none focus:border-[#cc785c]"
      />
    </div>
  )
}

function PanelContent({
  weights,
  activePreset,
  isDirty,
  isSaving,
  saveError,
  onWeightChange,
  onPresetApply,
  onReset,
  onSave,
}: ScoringPanelProps) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Presets */}
      <div className="flex gap-1 flex-wrap shrink-0">
        {(['dps', 'tank'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onPresetApply(p)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activePreset === p
                ? 'bg-[#cc785c] text-[#faf9f5]'
                : 'bg-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5]'
            }`}
          >
            {p === 'dps' ? 'DPS' : 'Tank'}
          </button>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1 text-xs rounded font-medium bg-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5] transition-colors"
        >
          Reset
        </button>
        {activePreset === 'custom' && (
          <span className="px-3 py-1 text-xs rounded font-medium bg-[#252320] text-[#cc785c] border border-[#cc785c]/30">
            Custom
          </span>
        )}
      </div>

      {/* Weight inputs */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {STAT_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-wider text-[#a09d96] mb-2">
              {group.label}
            </p>
            <div className="space-y-2">
              {group.stats.map(stat =>
                stat in weights ? (
                  <WeightInput
                    key={stat}
                    stat={stat}
                    value={weights[stat] ?? 0}
                    onChange={onWeightChange}
                  />
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="space-y-2 shrink-0">
        {saveError && <p className="text-xs text-[#c64545]">{saveError}</p>}
        <Button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="w-full bg-[#cc785c] hover:bg-[#b8674d] text-[#faf9f5] disabled:opacity-40"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

export function ScoringPanel(props: ScoringPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-64 shrink-0 bg-[#252320] border border-[#2e2c28] rounded-xl p-4 h-full overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a09d96] mb-3">
          Pontuação
        </p>
        <PanelContent {...props} />
      </aside>

      {/* Mobile: icon button */}
      <div className="sm:hidden shrink-0">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg bg-[#252320] border border-[#2e2c28] text-[#a09d96]"
          aria-label="Abrir painel de pontuação"
        >
          <SlidersHorizontal size={20} />
        </button>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <div className="relative ml-auto w-72 h-full bg-[#252320] border-l border-[#2e2c28] p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#a09d96]">
                  Pontuação
                </p>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="text-[#a09d96]"
                >
                  <X size={16} />
                </button>
              </div>
              <PanelContent {...props} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/combatants/ScoringPanel.tsx
git commit -m "feat: add ScoringPanel component"
```

---

## Task 5: CombatantCard component

**Files:**
- Create: `src/pages/combatants/CombatantCard.tsx`

- [ ] **Step 1: Create `src/pages/combatants/CombatantCard.tsx`**

```typescript
import { useState } from 'react'
import { User } from 'lucide-react'
import type { Combatant } from '@/lib/types'

interface CombatantCardProps {
  combatant: Combatant
  selected: boolean
  onClick: () => void
}

export function CombatantCard({ combatant, selected, onClick }: CombatantCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all w-full ${
        selected
          ? 'bg-[#2e2c28] border-[#cc785c]'
          : 'bg-[#252320] border-[#2e2c28] hover:border-[#3a3835]'
      }`}
    >
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#181715] border border-[#2e2c28] shrink-0">
        {imgError ? (
          <div className="w-full h-full flex items-center justify-center text-[#a09d96]">
            <User size={24} />
          </div>
        ) : (
          <img
            src={combatant.portrait_url}
            alt={combatant.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <p className="text-xs font-medium text-[#faf9f5] text-center leading-tight truncate w-full">
        {combatant.name}
      </p>
      <p className="text-[10px] text-[#a09d96]">Nv. {combatant.level}</p>
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          combatant.avg_gear_score > 0
            ? 'bg-[#cc785c]/20 text-[#cc785c]'
            : 'text-[#a09d96]'
        }`}
      >
        {combatant.avg_gear_score > 0 ? combatant.avg_gear_score.toFixed(1) : '—'}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/combatants/CombatantCard.tsx
git commit -m "feat: add CombatantCard component"
```

---

## Task 6: CombatantDetail component

**Files:**
- Create: `src/pages/combatants/CombatantDetail.tsx`

- [ ] **Step 1: Create `src/pages/combatants/CombatantDetail.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { GearSlot, FinalStats } from '@/lib/types'

function GearSlotCard({ slot }: { slot: GearSlot }) {
  return (
    <div className="bg-[#181715] border border-[#2e2c28] rounded-lg p-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-[#a09d96]">{slot.slot}</p>
      {slot.main_stat === null ? (
        <p className="text-xs text-[#3a3835] italic">Vazio</p>
      ) : (
        <>
          <p className="text-xs font-semibold text-[#faf9f5]">{slot.main_stat}</p>
          <div className="space-y-0.5">
            {slot.substats.map((s, i) => (
              <p key={i} className="text-[11px] text-[#a09d96]">
                {s}
              </p>
            ))}
          </div>
          {slot.score !== null && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-[#a09d96]">Score</span>
                <span className="text-[#cc785c] font-semibold">{slot.score.toFixed(1)}</span>
              </div>
              <div className="h-1 bg-[#2e2c28] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#cc785c] rounded-full"
                  style={{ width: `${Math.min(100, slot.score)}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FinalStatsPanel({ stats }: { stats: FinalStats }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'ATK', value: stats.ATK.toLocaleString() },
    { label: 'DEF', value: stats.DEF.toLocaleString() },
    { label: 'HP', value: stats.HP.toLocaleString() },
    { label: 'CRate', value: `${stats.CRate.toFixed(1)}%` },
    { label: 'CDmg', value: `${stats.CDmg.toFixed(1)}%` },
    { label: 'EHP', value: stats.EHP.toLocaleString() },
    { label: 'Avg DMG', value: stats.AvgDMG.toLocaleString() },
  ]
  return (
    <div className="bg-[#252320] border border-[#2e2c28] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-[#a09d96] mb-3">Stats Finais</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-[#a09d96]">{r.label}</span>
            <span className="text-[#cc785c] font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface CombatantDetailProps {
  charId: string
}

export function CombatantDetail({ charId }: CombatantDetailProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['combatants', charId, 'stats'],
    queryFn: () => api.combatantStats(charId),
    enabled: !!charId,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center p-6 text-[#a09d96]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-sm">Carregando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-[#c64545]">
        Erro ao carregar dados do combatente.
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {data.gear_slots.map((slot) => (
          <GearSlotCard key={slot.slot} slot={slot} />
        ))}
      </div>
      <FinalStatsPanel stats={data.final_stats} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/combatants/CombatantDetail.tsx
git commit -m "feat: add CombatantDetail component"
```

---

## Task 7: CombatantsPage and App.tsx wiring

**Files:**
- Create: `src/pages/combatants/CombatantsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/pages/combatants/CombatantsPage.tsx`**

```typescript
import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, User } from 'lucide-react'
import { api } from '@/lib/api'
import { ScoringPanel, DPS_WEIGHTS, TANK_WEIGHTS } from './ScoringPanel'
import { CombatantCard } from './CombatantCard'
import { CombatantDetail } from './CombatantDetail'

type Preset = 'dps' | 'tank' | 'custom'

export function CombatantsPage() {
  const queryClient = useQueryClient()
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [localWeights, setLocalWeights] = useState<Record<string, number> | null>(null)
  const [activePreset, setActivePreset] = useState<Preset>('custom')
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    data: combatants = [],
    isLoading: combatantsLoading,
    error: combatantsError,
  } = useQuery({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    staleTime: 30_000,
  })

  const { data: serverWeights = {}, isLoading: prioritiesLoading } = useQuery({
    queryKey: ['scoring/priorities'],
    queryFn: () => api.scoringPriorities(),
    staleTime: 60_000,
    select: (d) => d.weights,
  })

  const saveMutation = useMutation({
    mutationFn: (weights: Record<string, number>) => api.saveScoringPriorities(weights),
    onSuccess: () => {
      setSaveError(null)
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const displayWeights = localWeights ?? serverWeights

  const isDirty = useMemo(
    () => JSON.stringify(displayWeights) !== JSON.stringify(serverWeights),
    [displayWeights, serverWeights]
  )

  const handleWeightChange = useCallback(
    (stat: string, value: number) => {
      setLocalWeights((prev) => ({ ...(prev ?? serverWeights), [stat]: value }))
      setActivePreset('custom')
    },
    [serverWeights]
  )

  const handlePresetApply = useCallback((preset: 'dps' | 'tank') => {
    setLocalWeights(preset === 'dps' ? { ...DPS_WEIGHTS } : { ...TANK_WEIGHTS })
    setActivePreset(preset)
  }, [])

  const handleReset = useCallback(() => {
    setLocalWeights(Object.fromEntries(Object.keys(serverWeights).map((k) => [k, 1])))
    setActivePreset('custom')
  }, [serverWeights])

  const handleSave = useCallback(() => {
    saveMutation.mutate(displayWeights)
  }, [saveMutation, displayWeights])

  const handleCardClick = useCallback((charId: string) => {
    setSelectedCharId((prev) => (prev === charId ? null : charId))
  }, [])

  return (
    <div className="flex gap-4 h-full p-4 overflow-hidden">
      {/* Scoring panel — hidden while priorities are loading */}
      {!prioritiesLoading && (
        <ScoringPanel
          weights={displayWeights}
          activePreset={activePreset}
          isDirty={isDirty}
          isSaving={saveMutation.isPending}
          saveError={saveError}
          onWeightChange={handleWeightChange}
          onPresetApply={handlePresetApply}
          onReset={handleReset}
          onSave={handleSave}
        />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {combatantsError ? (
          <div className="p-4">
            <p className="text-[#c64545] text-sm mb-2">Erro ao carregar combatentes.</p>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['combatants'] })}
              className="flex items-center gap-1 text-xs text-[#a09d96] hover:text-[#faf9f5]"
            >
              <RefreshCw size={12} />
              Tentar novamente
            </button>
          </div>
        ) : combatantsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-xl bg-[#252320] border border-[#2e2c28] animate-pulse"
              />
            ))}
          </div>
        ) : combatants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#a09d96]">
            <User size={40} className="mb-3 opacity-40" />
            <p className="text-sm">Nenhum combatente encontrado.</p>
            <p className="text-xs mt-1 text-center">
              Carregue um arquivo de captura na tela Fragmentos.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {combatants.map((c) => (
                <CombatantCard
                  key={c.char_id}
                  combatant={c}
                  selected={selectedCharId === c.char_id}
                  onClick={() => handleCardClick(c.char_id)}
                />
              ))}
            </div>
            {selectedCharId && <CombatantDetail charId={selectedCharId} />}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx`**

Add import after the `RescuePage` import line:

```typescript
import { CombatantsPage } from './pages/combatants/CombatantsPage'
```

Replace both Placeholder routes for combatants and scoring (currently lines 42-43):

```typescript
          <Route path="combatants" element={<CombatantsPage />} />
          <Route path="scoring"    element={<Navigate to="/combatants" replace />} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full backend tests**

```
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/combatants/CombatantsPage.tsx src/App.tsx
git commit -m "feat: wire up CombatantsPage with scoring panel and card grid"
```
