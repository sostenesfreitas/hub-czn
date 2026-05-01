# Optimizer Design

## Overview

Single page at `/optimizer` combining a configuration panel with a results area. Users select a character, configure set and stat constraints, run the optimizer, and browse ranked builds with inline gear detail. Optimization runs in a backend thread and streams progress via the existing WebSocket.

---

## Section 1 — Architecture

### Layout (two zones)

```
┌─────────────────────────────────────────────────────┐
│  /optimizer                                          │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │ OptimizerPanel│  │      ResultsArea              │ │
│  │              │  │  [progress bar during run]    │ │
│  │ CharSelector  │  │                               │ │
│  │ 4-piece set  │  │  # │ Score │ ATK │ CR │ CD    │ │
│  │ 2-piece sets │  │  1 │ 94.2  │ 19k │91%│215%   │ │
│  │ Main stats   │  │  ▼ gear slots expanded        │ │
│  │ Filters      │  │  2 │ 91.8  │ 18k │89%│208%   │ │
│  │              │  │                               │ │
│  │ [▶ Otimizar] │  │                               │ │
│  └──────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

- **Left panel** (`OptimizerPanel`): all config fields + Run/Cancel button + progress bar. Fixed width, scrollable if needed.
- **Right area** (`ResultsArea`): progress feedback during run; ranked results table with inline build detail after completion.

### Routes

- `GET /optimizer` — main page

### New API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/optimize/start` | Start optimization job |
| `POST` | `/api/optimize/cancel` | Cancel active job |
| `GET` | `/api/optimize/sets` | List available equipment sets |

### WebSocket events (server → client)

```json
{ "type": "optimize.progress", "checked": 12400, "total": 50000, "found": 8 }
{ "type": "optimize.done",     "results": [ ... ] }
{ "type": "optimize.cancelled" }
{ "type": "optimize.error",    "message": "..." }
```

---

## Section 2 — API Shapes

### `POST /api/optimize/start`

Request body:

```json
{
  "char_name": "Nine",
  "four_piece_sets": [12],
  "two_piece_sets": [8, 15],
  "main_stat_4": "ATK%",
  "main_stat_5": "ATK%",
  "main_stat_6": "ATK%",
  "top_percent": 100,
  "include_equipped": true,
  "excluded_heroes": [],
  "max_results": 10
}
```

- `four_piece_sets`: 0 or 1 set ID (empty list = any set)
- `two_piece_sets`: 0–2 set IDs (empty list = no 2-piece requirement)
- `main_stat_4/5/6`: string matching `SLOT_MAIN_STATS[4/5/6]`, or `null` for any
- `top_percent`: integer 1–100
- `max_results`: integer 1–50

Response: `{ "job_id": "string" }`

Error responses:
- `422` — invalid field values or unknown character
- `409` — a job is already running

### `POST /api/optimize/cancel`

No body. Response: `{ "cancelled": true }` or `{ "cancelled": false }` if no job active.

### `GET /api/optimize/sets`

Response array:

```json
[{ "id": 6, "name": "Beast's Yearning" }, { "id": 7, "name": "..." }]
```

26 entries, sorted alphabetically by name.

### `optimize.done` results shape

Each item in `results`:

```json
{
  "rank": 1,
  "score": 94.2,
  "gear_slots": [
    {
      "slot": "Weapon",
      "main_stat": "ATK 1200",
      "substats": ["CRate 8.1%", "CDmg 12.3%"],
      "score": 91.2
    }
  ],
  "final_stats": {
    "ATK": 19400, "DEF": 3200, "HP": 95000,
    "CRate": 91.0, "CDmg": 215.0, "EHP": 44000, "AvgDMG": 38500
  }
}
```

`gear_slots` has exactly 6 entries. Reuses the existing `GearSlot` and `FinalStats` TypeScript types.

---

## Section 3 — Component Tree

```
OptimizerPage
├── OptimizerPanel                ← left panel
│   ├── CharSelector              ← dropdown, options from state.optimizer.character_info
│   ├── SetCombobox               ← reusable: search input + selected tags with ×
│   │                               maxSelect=1 for 4-piece, maxSelect=2 for 2-piece
│   ├── MainStatSelect × 3        ← dropdowns for slots 4, 5, 6
│   │                               options from GET /api/game-data SLOT_MAIN_STATS
│   ├── FilterInputs              ← top_percent (1–100), max_results (1–50),
│   │                               include_equipped toggle
│   ├── ExcludedHeroesCombobox    ← same SetCombobox pattern, options = character list
│   └── RunButton / CancelButton
│       └── ProgressBar           ← visible only during jobState === 'running'
└── ResultsArea                   ← right panel
    ├── ProgressFeedback          ← "Verificando X / Y combinações · Z builds encontradas"
    │                               visible only during jobState === 'running'
    ├── ResultsTable              ← visible when jobState === 'done'
    │   └── ResultRow[]           ← rank · score · ATK · CRate · CDmg · EHP
    └── BuildDetail               ← inline expansion on selected row
        ├── GearSlotGrid          ← reuses GearSlotCard from CombatantDetail
        └── FinalStatsPanel       ← reuses FinalStatsPanel from CombatantDetail
```

---

## Section 4 — State & Interactions

### Local state in `OptimizerPage`

| Variable | Type | Purpose |
|----------|------|---------|
| `config` | `OptimizerConfig` | All form fields |
| `jobState` | `'idle' \| 'running' \| 'done' \| 'cancelled' \| 'error'` | Job lifecycle |
| `progress` | `{ checked: number, total: number, found: number }` | Live progress from WS |
| `results` | `OptimizeResult[]` | Populated on `optimize.done` |
| `selectedRank` | `number \| null` | Expanded row; null = detail hidden |
| `jobError` | `string \| null` | Error message if jobState === 'error' |

### TypeScript types to add to `src/lib/types.ts`

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

### Interaction flows

1. **Start** — click Run → `POST /api/optimize/start` → `jobState = 'running'`, panel disabled
2. **Progress** — WS `optimize.progress` → update `progress` state
3. **Done** — WS `optimize.done` → `results = event.results`, `jobState = 'done'`, panel re-enabled
4. **Expand row** — click row → `setSelectedRank(rank)`. Click same row → collapse.
5. **Cancel** — click Cancel → `POST /api/optimize/cancel` → wait for `optimize.cancelled` → `jobState = 'cancelled'`, results cleared
6. **New run** — any form change while `jobState === 'done'` clears results and resets to `'idle'`

---

## Section 5 — Error Handling & Edge Cases

### Empty states

- No data loaded → panel shows "Carregue um arquivo na tela Fragmentos" + Run button disabled
- No characters available → `CharSelector` disabled
- `optimize.done` with empty results → "Nenhuma build encontrada. Tente relaxar os filtros."

### Loading states

- Sets list loading → `SetCombobox` inputs disabled with spinner
- Job running → entire `OptimizerPanel` inputs readonly, Run button replaced by Cancel button

### Errors

- `POST /api/optimize/start` 422 → inline error below Run button
- `POST /api/optimize/start` 409 → "Já existe uma otimização em andamento"
- `optimize.error` WS event → error message above results area, `jobState = 'error'`
- WS disconnect during run → `jobState = 'error'` with reconnect suggestion

### Input constraints

- `top_percent`: range 1–100, clamped on blur
- `max_results`: range 1–50, clamped on blur
- `four_piece_sets`: maximum 1 selection (combobox clears previous when new is selected)
- `two_piece_sets`: maximum 2 selections (combobox disables after 2 selected)
- Main stats: options derived from `SLOT_MAIN_STATS` in game-data; includes "Qualquer" (null) as first option

### Cancellation

Click Cancel → `POST /api/optimize/cancel` → backend sets `cancel_flag[0] = True` → WS emits `optimize.cancelled` → `jobState = 'cancelled'`, partial results discarded, panel re-enabled.
