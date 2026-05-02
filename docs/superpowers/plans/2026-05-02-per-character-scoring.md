# Per-Character Scoring Weights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-character scoring weight overrides so each combatant's gear score reflects that character's stat priorities, with global weights as fallback.

**Architecture:** Two-level weight system — `optimizer.priorities` (global, existing) as fallback, new `optimizer.char_weights: dict[str, dict[str, int]]` as per-character overrides persisted to `char_weights.json`. Three new API endpoints (GET/POST/DELETE). Frontend ScoringPage gains a unified character selector; selecting a character switches the ScoringPanel to edit that character's weights.

**Tech Stack:** FastAPI + Pydantic (Python backend), React + TanStack Query + react-i18next (frontend)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `Vribbels/optimizer/optimizer.py` | Modify | Add `char_weights` field, load from disk, apply in `recalculate_scores` |
| `api/routes/scoring.py` | Modify | Add GET/POST/DELETE char-weights endpoints + persist helper |
| `api/routes/combatants.py` | Modify | Use `priority_score` for `avg_gear_score` when weights are configured |
| `tests/api/test_scoring.py` | Modify | Add tests for char-weights endpoints (TDD — write before endpoints) |
| `src/lib/api.ts` | Modify | Add `charWeights`, `saveCharWeights`, `deleteCharWeights` calls |
| `src/i18n/en.ts` | Modify | Add `systemRec`, `resetToGlobal`, `globalMode` keys |
| `src/i18n/pt-BR.ts` | Modify | Same keys in Portuguese |
| `src/pages/combatants/ScoringPanel.tsx` | Modify | Add `'system'` Preset, optional `onSystemPreset` / `hasCharOverride` / `onResetToGlobal` props |
| `src/pages/scoring/ScoringPage.tsx` | Modify | Full refactor: unified selector, per-char query/save/delete mutations |

---

## Task 1: Write failing tests for char-weights endpoints

**Files:**
- Modify: `tests/api/test_scoring.py`

- [ ] **Step 1: Append these tests to `tests/api/test_scoring.py`**

```python
# ── char-weights ──────────────────────────────────────────────────────────────

def test_get_char_weights_no_override_returns_404(client):
    response = client.get("/api/scoring/char-weights/Luke")
    assert response.status_code == 404


def test_save_char_weights_round_trips(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    response = client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    assert response.status_code == 200
    assert response.json()["weights"] == weights


def test_save_char_weights_unknown_stat_returns_422(client):
    response = client.post(
        "/api/scoring/char-weights/Luke",
        json={"weights": {"NONEXISTENT_STAT": 5}},
    )
    assert response.status_code == 422


def test_save_char_weights_value_above_10_returns_422(client):
    response = client.post(
        "/api/scoring/char-weights/Luke",
        json={"weights": {ALL_STAT_NAMES[0]: 11}},
    )
    assert response.status_code == 422


def test_get_char_weights_after_save_returns_weights(client):
    weights = {name: 3 for name in ALL_STAT_NAMES}
    client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    response = client.get("/api/scoring/char-weights/Luke")
    assert response.status_code == 200
    assert response.json()["weights"] == weights


def test_delete_char_weights_returns_ok(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    response = client.delete("/api/scoring/char-weights/Luke")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_delete_char_weights_then_get_returns_404(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    client.delete("/api/scoring/char-weights/Luke")
    response = client.get("/api/scoring/char-weights/Luke")
    assert response.status_code == 404


def test_delete_char_weights_nonexistent_returns_ok(client):
    response = client.delete("/api/scoring/char-weights/NonExistent")
    assert response.status_code == 200
    assert response.json()["ok"] is True
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd C:\Users\soste\Documents\Vribbels-CZN-Optimizer
python -m pytest tests/api/test_scoring.py -k "char_weights" -v
```

Expected: FAIL — `404 Not Found` for the POST/DELETE routes (endpoints don't exist yet).

---

## Task 2: Optimizer — add char_weights field and update recalculate_scores

**Files:**
- Modify: `Vribbels/optimizer/optimizer.py:35-44` (`__init__`)
- Modify: `Vribbels/optimizer/optimizer.py:88-93` (end of fragment loop in `load_data`)
- Modify: `Vribbels/optimizer/optimizer.py:191-194` (`recalculate_scores`)

- [ ] **Step 1: Add `char_weights` to `__init__` (line 42, after `self.priorities`)**

Current `__init__` (lines 35–43):
```python
def __init__(self):
    self.fragments: list[MemoryFragment] = []
    self.characters: dict[str, list[MemoryFragment]] = {}
    self.character_info: dict[str, CharacterInfo] = {}
    self.user_info: UserInfo = UserInfo()
    self.unequipped: list[MemoryFragment] = []
    self.capture_time = ""
    self.priorities: dict[str, int] = {name: 0 for name in ALL_STAT_NAMES}
    self.raw_data = {}
```

Replace with:
```python
def __init__(self):
    self.fragments: list[MemoryFragment] = []
    self.characters: dict[str, list[MemoryFragment]] = {}
    self.character_info: dict[str, CharacterInfo] = {}
    self.user_info: UserInfo = UserInfo()
    self.unequipped: list[MemoryFragment] = []
    self.capture_time = ""
    self.priorities: dict[str, int] = {name: 0 for name in ALL_STAT_NAMES}
    self.char_weights: dict[str, dict[str, int]] = {}
    self.raw_data = {}
```

- [ ] **Step 2: Load `char_weights.json` in `load_data` — add after the fragment loop sorts (after line 93)**

Locate the block at the end of `load_data` that sorts character gear:
```python
        for char_gear in self.characters.values():
            char_gear.sort(key=lambda f: f.slot_num)
```

Add the char_weights load immediately after it:
```python
        for char_gear in self.characters.values():
            char_gear.sort(key=lambda f: f.slot_num)

        cw_path = Path(filepath).parent / "char_weights.json"
        if cw_path.exists():
            with open(cw_path) as _f:
                self.char_weights = json.load(_f)
```

- [ ] **Step 3: Update `recalculate_scores` to use per-char weights**

Current (lines 191–194):
```python
    def recalculate_scores(self):
        """Recalculate priority scores for all fragments."""
        for f in self.fragments:
            f.calculate_priority_score(self.priorities)
```

Replace with:
```python
    def recalculate_scores(self):
        """Recalculate priority scores for all fragments."""
        for f in self.fragments:
            w = self.char_weights.get(f.equipped_to) if f.equipped_to else None
            f.calculate_priority_score(w if w is not None else self.priorities)
```

- [ ] **Step 4: Commit**

```bash
git add Vribbels/optimizer/optimizer.py
git commit -m "feat: add char_weights to optimizer — load from disk, apply in recalculate_scores"
```

---

## Task 3: Scoring API — char-weights endpoints + persist helper

**Files:**
- Modify: `api/routes/scoring.py`

- [ ] **Step 1: Replace the full content of `api/routes/scoring.py`**

```python
from __future__ import annotations

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Annotated

from api.state import state

try:
    from game_data.constants import ALL_STAT_NAMES
except ImportError:
    ALL_STAT_NAMES = []

try:
    from game_data.char_presets import get_char_preset
except ImportError:
    def get_char_preset(_id: int):
        return None

router = APIRouter()

WeightValue = Annotated[int, Field(ge=0, le=10)]


class ScoringPrioritiesRequest(BaseModel):
    weights: dict[str, WeightValue]


def _persist_char_weights() -> None:
    try:
        from capture.constants import OUTPUT_DIR
        path = Path(OUTPUT_DIR) / "char_weights.json"
        path.write_text(json.dumps(state.optimizer.char_weights, indent=2))
    except Exception:
        pass


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


@router.get("/scoring/char-preset/{char_id}")
def get_char_scoring_preset(char_id: int):
    preset = get_char_preset(char_id)
    if preset is None:
        raise HTTPException(status_code=404, detail=f"No preset for char_id {char_id}")
    return preset


@router.get("/scoring/char-weights/{char_id}")
def get_char_weights(char_id: str):
    weights = state.optimizer.char_weights.get(char_id)
    if weights is None:
        raise HTTPException(status_code=404, detail=f"No override for {char_id}")
    return {"weights": weights}


@router.post("/scoring/char-weights/{char_id}")
def save_char_weights(char_id: str, body: ScoringPrioritiesRequest):
    unknown = [k for k in body.weights if k not in ALL_STAT_NAMES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown stat names: {unknown}")
    state.optimizer.char_weights[char_id] = dict(body.weights)
    _persist_char_weights()
    if state.data_loaded:
        state.optimizer.recalculate_scores()
    return {"weights": state.optimizer.char_weights[char_id]}


@router.delete("/scoring/char-weights/{char_id}")
def delete_char_weights(char_id: str):
    state.optimizer.char_weights.pop(char_id, None)
    _persist_char_weights()
    if state.data_loaded:
        state.optimizer.recalculate_scores()
    return {"ok": True}
```

- [ ] **Step 2: Run the tests written in Task 1**

```bash
python -m pytest tests/api/test_scoring.py -k "char_weights" -v
```

Expected: all 8 tests PASS.

- [ ] **Step 3: Run full scoring test suite**

```bash
python -m pytest tests/api/test_scoring.py -v
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add api/routes/scoring.py
git commit -m "feat: add char-weights GET/POST/DELETE endpoints with JSON persistence"
```

---

## Task 4: Combatants — use priority_score for avg_gear_score

**Files:**
- Modify: `api/routes/combatants.py:36-39`

- [ ] **Step 1: Update the `avg_score` calculation in `get_combatants`**

Current (lines 36–38):
```python
        gear = state.optimizer.characters.get(name, [])
        avg_score = sum(f.gear_score for f in gear) / len(gear) if gear else 0.0
        extra = _char_extra(info.res_id)
```

Replace with:
```python
        gear = state.optimizer.characters.get(name, [])
        has_weights = (
            any(v != 0 for v in state.optimizer.priorities.values())
            or bool(state.optimizer.char_weights)
        )
        avg_score = (
            sum(f.priority_score for f in gear) / len(gear)
            if gear and has_weights
            else sum(f.gear_score for f in gear) / len(gear) if gear
            else 0.0
        )
        extra = _char_extra(info.res_id)
```

- [ ] **Step 2: Run combatants tests**

```bash
python -m pytest tests/api/test_combatants.py -v
```

Expected: all tests PASS (no data loaded → returns empty list, existing behavior unchanged).

- [ ] **Step 3: Commit**

```bash
git add api/routes/combatants.py
git commit -m "fix: combatants avg_gear_score uses priority_score when weights are configured"
```

---

## Task 5: Frontend — api.ts new calls

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add `charWeights`, `saveCharWeights`, `deleteCharWeights` to the `api` object**

After the existing `charPreset` entry (line 112–113):
```typescript
  charPreset: (charId: number) =>
    request<CharPreset>(`/api/scoring/char-preset/${charId}`),
```

Add:
```typescript
  charWeights: (charId: string) =>
    request<ScoringPriorities>(`/api/scoring/char-weights/${encodeURIComponent(charId)}`),

  saveCharWeights: (charId: string, weights: Record<string, number>) =>
    request<ScoringPriorities>(`/api/scoring/char-weights/${encodeURIComponent(charId)}`, {
      method: 'POST',
      body: JSON.stringify({ weights }),
    }),

  deleteCharWeights: (charId: string) =>
    request<{ ok: boolean }>(`/api/scoring/char-weights/${encodeURIComponent(charId)}`, {
      method: 'DELETE',
    }),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\soste\Documents\Vribbels-CZN-Optimizer
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add charWeights/saveCharWeights/deleteCharWeights API calls"
```

---

## Task 6: Frontend — i18n keys

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/pt-BR.ts`

- [ ] **Step 1: Add keys to `src/i18n/en.ts` inside the `scoring` object**

Find the existing `scoring` block. After `closePanel: 'Close panel',` add:
```typescript
    systemRec: 'System Rec.',
    resetToGlobal: 'Reset to Global',
    globalMode: 'Global',
```

The `scoring` object in `en.ts` should now start:
```typescript
  scoring: {
    title: 'Scoring',
    save: 'Save',
    saving: 'Saving...',
    reset: 'Reset',
    custom: 'Custom',
    openPanel: 'Open scoring panel',
    closePanel: 'Close panel',
    systemRec: 'System Rec.',
    resetToGlobal: 'Reset to Global',
    globalMode: 'Global',
    howGSWorks: 'How Gear Score Works',
    // ... rest unchanged
```

- [ ] **Step 2: Add same keys to `src/i18n/pt-BR.ts`**

Find the `scoring` block. After `closePanel: 'Fechar painel',` add:
```typescript
    systemRec: 'Rec. do Sistema',
    resetToGlobal: 'Resetar para Global',
    globalMode: 'Global',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/pt-BR.ts
git commit -m "feat: add systemRec, resetToGlobal, globalMode i18n keys"
```

---

## Task 7: ScoringPanel — system preset button + reset-to-global button

**Files:**
- Modify: `src/pages/combatants/ScoringPanel.tsx`

- [ ] **Step 1: Replace the full content of `src/pages/combatants/ScoringPanel.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

export type Preset = 'dps' | 'tank' | 'custom' | 'system'

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
  onSystemPreset?: () => void
  hasCharOverride?: boolean
  onResetToGlobal?: () => void
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
  const id = `weight-${stat.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs text-[#b3b3b3] truncate flex-1">{stat}</label>
      <input
        id={id}
        type="number"
        min={0}
        max={10}
        value={value}
        onChange={e => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(stat, n)
        }}
        onBlur={e => {
          const clamped = Math.max(0, Math.min(10, Number(e.target.value)))
          if (clamped !== value) onChange(stat, clamped)
        }}
        className="w-14 text-right text-sm bg-[#282828] border border-[#333333] rounded px-2 py-0.5 text-[#ffffff] focus:outline-none focus:border-[#c084fc]"
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
  onSystemPreset,
  hasCharOverride,
  onResetToGlobal,
}: ScoringPanelProps) {
  const { t } = useTranslation()

  const STAT_GROUPS = [
    { labelKey: 'scoring.group.offensive', stats: ['Flat ATK', 'ATK%', 'CRate', 'CDmg', 'Extra DMG%', 'DoT%'] },
    { labelKey: 'scoring.group.defensive', stats: ['Flat DEF', 'DEF%', 'Flat HP', 'HP%'] },
    {
      labelKey: 'scoring.group.elemental',
      stats: ['Passion DMG%', 'Order DMG%', 'Justice DMG%', 'Void DMG%', 'Instinct DMG%'],
    },
    { labelKey: 'scoring.group.other', stats: ['Ego'] },
  ] as const

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
                ? 'bg-[#c084fc] text-[#ffffff]'
                : 'bg-[#282828] text-[#b3b3b3] hover:text-[#ffffff]'
            }`}
          >
            {p === 'dps' ? 'DPS' : 'Tank'}
          </button>
        ))}
        {onSystemPreset && (
          <button
            type="button"
            onClick={onSystemPreset}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activePreset === 'system'
                ? 'bg-[#c084fc] text-[#ffffff]'
                : 'bg-[#282828] text-[#b3b3b3] hover:text-[#ffffff]'
            }`}
          >
            {t('scoring.systemRec')}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1 text-xs rounded font-medium bg-[#282828] text-[#b3b3b3] hover:text-[#ffffff] transition-colors"
        >
          {t('scoring.reset')}
        </button>
        {activePreset === 'custom' && (
          <span className="px-3 py-1 text-xs rounded font-medium bg-[#181818] text-[#c084fc] border border-[#c084fc]/30">
            {t('scoring.custom')}
          </span>
        )}
      </div>

      {/* Weight inputs */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {STAT_GROUPS.map(group => (
          <div key={group.labelKey}>
            <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
              {t(group.labelKey)}
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
        {saveError && <p role="alert" className="text-xs text-[#f3727f]">{saveError}</p>}
        <Button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="w-full bg-[#c084fc] hover:bg-[#9333ea] text-[#ffffff] disabled:opacity-40"
        >
          {isSaving ? t('scoring.saving') : t('scoring.save')}
        </Button>
        {hasCharOverride && onResetToGlobal && (
          <button
            type="button"
            onClick={onResetToGlobal}
            className="w-full text-xs text-[#b3b3b3] hover:text-[#ffffff] transition-colors py-1"
          >
            {t('scoring.resetToGlobal')}
          </button>
        )}
      </div>
    </div>
  )
}

export function ScoringPanel(props: ScoringPanelProps) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (drawerOpen) {
      dialogRef.current?.focus()
    }
  }, [drawerOpen])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-64 shrink-0 bg-[#181818] border border-[#282828] rounded-xl p-4 h-full overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#b3b3b3] mb-3">
          {t('scoring.title')}
        </p>
        <PanelContent {...props} />
      </aside>

      {/* Mobile: icon button */}
      <div className="sm:hidden shrink-0">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg bg-[#181818] border border-[#282828] text-[#b3b3b3]"
          aria-label={t('scoring.openPanel')}
        >
          <SlidersHorizontal size={20} />
        </button>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-0 bg-black/60 cursor-default"
              aria-label={t('scoring.closePanel')}
              onClick={() => setDrawerOpen(false)}
            />
            <div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={t('scoring.title')}
              className="relative ml-auto w-72 h-full bg-[#181818] border-l border-[#282828] p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#b3b3b3]">
                  {t('scoring.title')}
                </p>
                <button
                  type="button"
                  aria-label={t('scoring.closePanel')}
                  onClick={() => setDrawerOpen(false)}
                  className="text-[#b3b3b3]"
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

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/combatants/ScoringPanel.tsx
git commit -m "feat: ScoringPanel — add system preset button and reset-to-global action"
```

---

## Task 8: ScoringPage — per-character mode refactor

**Files:**
- Modify: `src/pages/scoring/ScoringPage.tsx`

- [ ] **Step 1: Replace the full content of `src/pages/scoring/ScoringPage.tsx`**

```tsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { Combatant, CharPreset, GameData } from '@/lib/types'
import { ScoringPanel, DPS_WEIGHTS, TANK_WEIGHTS } from '../combatants/ScoringPanel'
import type { Preset } from '../combatants/ScoringPanel'

const GS_SECTION_KEYS = ['calc', 'formula', 'example', 'maxRolls', 'weighted', 'potential'] as const

// ─── Gear Score Explanation ────────────────────────────────────────────────

function GsExplanation() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[#282828] bg-[#181818] overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#b3b3b3] hover:text-[#ffffff] transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-medium text-[#c084fc]">{t('scoring.howGSWorks')}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 font-mono text-xs text-[#b3b3b3] leading-relaxed space-y-4">
          {GS_SECTION_KEYS.map((key) => (
            <div key={key}>
              <p className="text-[#ffffff] font-semibold mb-1">{t(`scoring.gs.${key}.heading`)}</p>
              <pre className="whitespace-pre-wrap font-mono text-[#b3b3b3]">{t(`scoring.gs.${key}.body`)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Character Preset Info Card (read-only) ────────────────────────────────

interface SetInfo { name: string; icon_path?: string }

function CharPresetCard({
  preset,
  setMap,
}: {
  preset: CharPreset
  setMap: Record<number, SetInfo>
}) {
  const { t } = useTranslation()

  const slotRows = [
    { slot: 4, stats: preset.main_stat_4 },
    { slot: 5, stats: preset.main_stat_5 },
    { slot: 6, stats: preset.main_stat_6 },
  ]

  return (
    <div className="rounded-xl border border-[#282828] bg-[#181818] p-4 space-y-4">
      {/* Recommended sets */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
          {t('scoring.preset.recommendedSets')}
        </p>
        <div className="flex flex-wrap gap-2">
          {preset.recommended_sets.map((id) => {
            const s = setMap[id]
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#282828] text-xs text-[#ffffff]"
              >
                {s?.icon_path && (
                  <img src={assetUrl(s.icon_path)} alt="" className="w-4 h-4 object-contain" />
                )}
                <span>{s?.name ?? `Set ${id}`}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main stats per slot */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
          {t('scoring.preset.mainStats')}
        </p>
        <div className="space-y-1">
          {slotRows.map(({ slot, stats }) =>
            stats.length > 0 ? (
              <div key={slot} className="flex items-baseline gap-2 text-xs">
                <span className="text-[#b3b3b3] shrink-0">
                  {t('scoring.preset.slot', { slot })}
                </span>
                <span className="text-[#ffffff]">{stats.join(' / ')}</span>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Recommended substats */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
          {t('scoring.preset.substats')}
        </p>
        <div className="flex flex-wrap gap-1">
          {preset.substats.map((s, i) => (
            <span
              key={s}
              className={`text-xs px-2 py-0.5 rounded-full ${
                i === 0
                  ? 'bg-[#c084fc]/20 text-[#c084fc] border border-[#c084fc]/30'
                  : 'bg-[#282828] text-[#b3b3b3]'
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export function ScoringPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [localWeights, setLocalWeights] = useState<Record<string, number> | null>(null)
  const [activePreset, setActivePreset] = useState<Preset>('custom')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedCharId, setSelectedCharId] = useState<string>('')
  const [selectedResId, setSelectedResId] = useState<number | null>(null)

  // ── global weights ──────────────────────────────────────────────────────
  const { data: serverWeights = {}, isLoading: prioritiesLoading } = useQuery({
    queryKey: ['scoring/priorities'],
    queryFn: () => api.scoringPriorities(),
    staleTime: 60_000,
    select: (d) => d.weights,
  })

  // ── combatants list for selector ────────────────────────────────────────
  const { data: combatants = [] } = useQuery<Combatant[]>({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    staleTime: 30_000,
  })

  // ── game data for set icons ─────────────────────────────────────────────
  const { data: gameData } = useQuery<GameData>({
    queryKey: ['game-data'],
    queryFn: () => api.gameData(),
    staleTime: Infinity,
  })
  const setMap: Record<number, SetInfo> = {}
  if (gameData?.sets) {
    for (const [id, s] of Object.entries(gameData.sets)) {
      setMap[Number(id)] = s
    }
  }

  // ── game preset for selected character (sets/substats info + system rec) ─
  const { data: charPreset } = useQuery<CharPreset>({
    queryKey: ['scoring/char-preset', selectedResId],
    queryFn: () => api.charPreset(selectedResId!),
    enabled: selectedResId != null,
    retry: false,
  })

  // ── per-character weight override (404 → undefined, not an error for UX) ─
  const { data: charServerWeights, isSuccess: charWeightsLoaded } = useQuery({
    queryKey: ['scoring/char-weights', selectedCharId],
    queryFn: () => api.charWeights(selectedCharId),
    enabled: selectedCharId !== '',
    retry: false,
    select: (d) => d.weights,
  })

  const hasCharOverride = selectedCharId !== '' && charWeightsLoaded && charServerWeights !== undefined

  // Reset local edits when character changes
  useEffect(() => {
    setLocalWeights(null)
    setActivePreset('custom')
    setSaveError(null)
  }, [selectedCharId])

  // ── mutations ───────────────────────────────────────────────────────────
  const saveGlobalMutation = useMutation({
    mutationFn: (weights: Record<string, number>) => api.saveScoringPriorities(weights),
    onSuccess: () => {
      setSaveError(null)
      setLocalWeights(null)
      queryClient.invalidateQueries({ queryKey: ['scoring/priorities'] })
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const saveCharMutation = useMutation({
    mutationFn: (weights: Record<string, number>) => api.saveCharWeights(selectedCharId, weights),
    onSuccess: () => {
      setSaveError(null)
      setLocalWeights(null)
      queryClient.invalidateQueries({ queryKey: ['scoring/char-weights', selectedCharId] })
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const deleteCharMutation = useMutation({
    mutationFn: () => api.deleteCharWeights(selectedCharId),
    onSuccess: () => {
      setSaveError(null)
      setLocalWeights(null)
      queryClient.invalidateQueries({ queryKey: ['scoring/char-weights', selectedCharId] })
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  // base = char override if exists, else global
  const baseWeights = selectedCharId !== ''
    ? (charServerWeights ?? serverWeights)
    : serverWeights

  const displayWeights = localWeights ?? baseWeights

  const isDirty = useMemo(
    () =>
      Object.keys(displayWeights).some((k) => displayWeights[k] !== baseWeights[k]) ||
      Object.keys(baseWeights).some((k) => baseWeights[k] !== displayWeights[k]),
    [displayWeights, baseWeights]
  )

  const activeMutation = selectedCharId !== '' ? saveCharMutation : saveGlobalMutation

  const handleWeightChange = useCallback(
    (stat: string, value: number) => {
      setLocalWeights((prev) => ({ ...(prev ?? baseWeights), [stat]: value }))
      setActivePreset('custom')
    },
    [baseWeights]
  )

  const handlePresetApply = useCallback((preset: 'dps' | 'tank') => {
    setLocalWeights(preset === 'dps' ? { ...DPS_WEIGHTS } : { ...TANK_WEIGHTS })
    setActivePreset(preset)
  }, [])

  const handleSystemPreset = useCallback(() => {
    if (charPreset) {
      setLocalWeights({ ...charPreset.weights })
      setActivePreset('system')
    }
  }, [charPreset])

  const handleReset = useCallback(() => {
    setLocalWeights(Object.fromEntries(Object.keys(serverWeights).map((k) => [k, 1])))
    setActivePreset('custom')
  }, [serverWeights])

  const handleSave = useCallback(() => {
    if (prioritiesLoading) return
    activeMutation.mutate(displayWeights)
  }, [activeMutation, displayWeights, prioritiesLoading])

  const handleResetToGlobal = useCallback(() => {
    deleteCharMutation.mutate()
  }, [deleteCharMutation])

  return (
    <div className="flex gap-4 h-full p-4 overflow-hidden">
      {/* Weight panel */}
      {!prioritiesLoading && (
        <ScoringPanel
          weights={displayWeights}
          activePreset={activePreset}
          isDirty={isDirty}
          isSaving={activeMutation.isPending}
          saveError={saveError}
          onWeightChange={handleWeightChange}
          onPresetApply={handlePresetApply}
          onReset={handleReset}
          onSave={handleSave}
          onSystemPreset={charPreset ? handleSystemPreset : undefined}
          hasCharOverride={hasCharOverride}
          onResetToGlobal={handleResetToGlobal}
        />
      )}

      {/* Right: selector + preset info + GS explanation */}
      <div className="flex-1 overflow-y-auto space-y-4">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('scoring.title')}</h1>

        {/* Unified character selector */}
        <div className="rounded-xl border border-[#282828] bg-[#181818] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#b3b3b3]">
            {t('scoring.preset.title')}
          </p>
          <select
            value={selectedCharId}
            onChange={(e) => {
              const charId = e.target.value
              setSelectedCharId(charId)
              const found = combatants.find((c) => c.char_id === charId)
              setSelectedResId(found?.res_id ?? null)
            }}
            className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-sm text-[#ffffff] outline-none focus:border-[#c084fc]"
          >
            <option value="">{t('scoring.globalMode')} — {t('scoring.preset.selectChar')}</option>
            {combatants.map((c) => (
              <option key={c.char_id} value={c.char_id}>
                {c.name}
              </option>
            ))}
          </select>

          {selectedCharId && !charPreset && (
            <p className="text-xs text-[#b3b3b3]">{t('scoring.preset.noPreset')}</p>
          )}

          {charPreset && (
            <CharPresetCard preset={charPreset} setMap={setMap} />
          )}
        </div>

        {!selectedCharId && <GsExplanation />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/scoring/ScoringPage.tsx
git commit -m "feat: ScoringPage — per-character weight mode with system preset and reset-to-global"
```

---

## Final Verification

- [ ] **Run all backend tests**

```bash
python -m pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.
