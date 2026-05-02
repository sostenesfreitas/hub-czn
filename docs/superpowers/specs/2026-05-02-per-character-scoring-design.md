# Per-Character Scoring Weights — Design Spec

**Goal:** Allow per-character scoring weight overrides so each combatant's gear score reflects that character's stat priorities, falling back to global weights when no override is set.

**Architecture:** Two-level weight system — global dict (existing) as fallback, per-character dicts as overrides. Backend stores overrides in `char_weights.json`. Optimizer applies the right weights during `recalculate_scores()`. Frontend ScoringPage uses a single character selector to switch between global editing and per-character editing.

**Tech Stack:** FastAPI (Python backend), React + TanStack Query (frontend), JSON file persistence

---

## Data Model

### Backend — `optimizer.char_weights`

```python
# optimizer.py
self.char_weights: dict[str, dict[str, int]] = {}
# key: char_id (display name, e.g. "Luke")
# value: same shape as self.priorities — {stat_name: weight (0-10)}
```

### Persistence — `char_weights.json`

Stored in the same output directory as snapshots (`capture/constants.OUTPUT_DIR`).

```json
{
  "Luke": { "ATK%": 8, "CRate": 8, "CDmg": 8, "Flat ATK": 8, "DEF%": 1, ... },
  "Yuki": { "HP%": 8, "DEF%": 8, "Ego": 8, "Flat HP": 8, ... }
}
```

---

## Backend Changes

### `Vribbels/optimizer/optimizer.py`

**`__init__`**: add `self.char_weights: dict[str, dict[str, int]] = {}`

**`load_data(filepath)`**: after loading fragments, load `char_weights.json` if it exists:
```python
cw_path = Path(filepath).parent / "char_weights.json"
if cw_path.exists():
    import json
    self.char_weights = json.loads(cw_path.read_text())
```

**`recalculate_scores()`**: apply per-character weights when available:
```python
def recalculate_scores(self):
    for f in self.fragments:
        w = self.char_weights.get(f.equipped_to) if f.equipped_to else None
        f.calculate_priority_score(w if w is not None else self.priorities)
```

**`get_combatants()` in `api/routes/combatants.py`**: use `priority_score` when any weights are configured:
```python
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
```

### `api/routes/scoring.py` — New endpoints

```python
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

**`_persist_char_weights()`** — helper that saves `char_weights.json`:
```python
def _persist_char_weights():
    from capture.constants import OUTPUT_DIR
    import json
    path = OUTPUT_DIR / "char_weights.json"
    path.write_text(json.dumps(state.optimizer.char_weights, indent=2))
```

---

## Frontend Changes

### `src/lib/api.ts`

Add three new calls:
```typescript
charWeights: (charId: string) => request<ScoringPriorities>(`/api/scoring/char-weights/${charId}`),
saveCharWeights: (charId: string, weights: Record<string, number>) =>
  request<ScoringPriorities>(`/api/scoring/char-weights/${charId}`, { method: 'POST', body: JSON.stringify({ weights }) }),
deleteCharWeights: (charId: string) =>
  request<{ ok: boolean }>(`/api/scoring/char-weights/${charId}`, { method: 'DELETE' }),
```

### `src/lib/types.ts`

No new types needed — `ScoringPriorities` already covers the shape.

### `src/pages/scoring/ScoringPage.tsx`

**Character selector** moves to top of page, unified — controls both the weight panel (left) and the preset info card (right).

**Two modes driven by `selectedCharId`:**

**Global mode** (`selectedCharId === ''`):
- `ScoringPanel` works as today (reads/saves global priorities)
- Preset buttons: DPS / Tank / Custom
- Right side: `GsExplanation`

**Per-character mode** (`selectedCharId !== ''`):
- On character select: try `GET /api/scoring/char-weights/{charId}`. If 404, seed panel with global weights as starting point (not auto-saved)
- `ScoringPanel` reads/saves via char-weights endpoints
- Preset buttons: DPS / Tank / Custom + **"Rec. do Sistema"** (shown only if `charPreset` exists for this character's `res_id`)
- "Rec. do Sistema" sets `localWeights` to `charPreset.weights` without saving
- **"Resetar para Global"** button — visible only when char has a saved override — calls `DELETE`, then reseeds panel with global weights
- Right side: `CharPresetCard` (read-only info: sets, main stats, substats)

### `src/pages/combatants/ScoringPanel.tsx`

Add `'system'` as a valid `Preset` value (alongside `'dps'`, `'tank'`, `'custom'`).

Add one optional prop:
```typescript
onSystemPreset?: () => void   // when defined, renders the "Rec. do Sistema" button
```

The button is shown only when `onSystemPreset` is defined (i.e., when a character with a game preset is selected). Clicking it calls `onSystemPreset` — the parent (`ScoringPage`) sets `localWeights` to `charPreset.weights` and `activePreset` to `'system'`.

### i18n keys to add (`en.ts` and `pt-BR.ts`)

```
scoring.systemRec        = "System Rec." / "Rec. do Sistema"
scoring.resetToGlobal    = "Reset to Global" / "Resetar para Global"
scoring.charMode         = "Character" / "Personagem"
scoring.globalMode       = "Global" / "Global"
```

---

## Behavior Details

### Weight initialization for a new character override

When user selects a character that has no saved override:
- Panel is seeded with the **current global weights** as initial state
- `isDirty = false` (nothing to save yet)
- User must change something or click a preset to trigger a save

### `avg_gear_score` on Combatants page

- Uses `priority_score` when at least one weight source (global or per-char) has any non-zero value
- Falls back to `gear_score` (unweighted base) when all priorities are 0 (default state)

### Unequipped fragments

Unequipped gear has `equipped_to = None`. `recalculate_scores()` uses global weights for these (no character context to look up).

---

## What Does NOT Change

- `calculate_priority_score(weights)` signature — unchanged
- `ScoringPanel` existing props — unchanged (only one optional `onSystemPreset` added)
- Global priorities endpoint (`GET/POST /api/scoring/priorities`) — unchanged
- `CharPresetCard` — read-only, no apply button (already removed)
