# Combatants + Scoring Design

## Overview

Single page at `/combatants` combining a character roster grid with an integrated scoring configuration panel. Users adjust stat weights, choose presets, and immediately see recalculated gear scores across all combatants. A redirect from `/scoring` points here.

---

## Section 1 — Architecture

### Layout (three zones)

```
┌─────────────────────────────────────────────────────┐
│  /combatants                                         │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │ ScoringPanel │  │      CombatantGrid            │ │
│  │              │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ │ │
│  │ Presets      │  │  │card│ │card│ │card│ │card│ │ │
│  │ Weights      │  │  └────┘ └────┘ └────┘ └────┘ │ │
│  │              │  │                               │ │
│  │ [Salvar]     │  │  ┌─────────────────────────┐ │ │
│  └──────────────┘  │  │    CombatantDetail       │ │ │
│                    │  │  GearSlotGrid             │ │ │
│                    │  │  FinalStatsPanel          │ │ │
│                    │  └─────────────────────────┘ │ │
│                    └──────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

- **Left panel** (`ScoringPanel`): stat weight inputs + presets. Collapsible to icon-button drawer on viewports < 768px.
- **Center/right** (`CombatantGrid`): card grid sorted by `avg_gear_score` descending.
- **Below grid** (`CombatantDetail`): expands when a card is clicked; collapses on second click.

### Routes

- `GET /combatants` — main page
- `GET /scoring` — redirects to `/combatants`

### New API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/combatants` | Character list with scores |
| GET | `/api/combatants/{char_id}/stats` | Gear slots + final stats for one character |
| GET | `/api/scoring/priorities` | Current stat weights |
| POST | `/api/scoring/priorities` | Save weights, trigger recalculation |

---

## Section 2 — API Shapes

### `GET /api/combatants`

Returns array:
```json
[
  {
    "char_id": "res_nine",
    "name": "Nine",
    "level": 100,
    "attribute": "Fire",
    "class": "Warrior",
    "avg_gear_score": 87.4,
    "portrait_url": "/portraits/res_nine.png"
  }
]
```

Sorted server-side by `avg_gear_score` descending.

### `GET /api/combatants/{char_id}/stats`

```json
{
  "char_id": "res_nine",
  "gear_slots": [
    {
      "slot": "Weapon",
      "main_stat": "ATK 1200",
      "substats": ["CRate 8.1%", "CDmg 12.3%", "ATK% 5.4%", "SPD 7"],
      "score": 91.2
    }
  ],
  "final_stats": {
    "ATK": 18450,
    "DEF": 3200,
    "HP": 95000,
    "CRate": 92.5,
    "CDmg": 210.0,
    "EHP": 42000,
    "AvgDMG": 38500
  }
}
```

`gear_slots` has exactly 6 entries. Empty slots have `main_stat: null`, `substats: []`, `score: null`.

### `GET /api/scoring/priorities`

```json
{ "weights": { "ATK": 10, "DEF": 3, "HP": 3, "CRate": 8, "CDmg": 6, ... } }
```

16 keys matching `Vribbels/game_data/constants.py` stat types.

### `POST /api/scoring/priorities`

Request body: `{ "weights": { ... } }` — same 16-key shape.
Response: same shape as GET, after recalculation.
Side effect: server recalculates `gear_score` on all fragments.

---

## Section 3 — Component Tree

```
CombatantsPage
├── ScoringPanel                ← left panel
│   ├── PresetBar               ← DPS / Tank / Reset / Custom buttons
│   └── WeightInputs            ← 16 numeric inputs grouped by stat category
├── CombatantGrid               ← right area
│   └── CombatantCard[]         ← portrait + name + level + score badge
└── CombatantDetail             ← below grid, conditional on selectedCharId
    ├── GearSlotGrid            ← 3×2 grid of 6 slots
    │   └── GearSlotCard[]      ← slot name + main stat + substats + score bar
    └── FinalStatsPanel         ← 7 final stats in 2-column grid
```

---

## Section 4 — State & Interactions

### Local state

| Variable | Type | Purpose |
|----------|------|---------|
| `selectedCharId` | `string \| null` | Expanded card; `null` = detail hidden |
| `localWeights` | `Record<string, number>` | Draft weights before save |
| `activePreset` | `'dps' \| 'tank' \| 'reset' \| 'custom'` | Highlighted preset button |

### Server state (TanStack Query)

```typescript
useQuery(['combatants'])
useQuery(['combatants', selectedCharId, 'stats'], { enabled: !!selectedCharId })
useQuery(['scoring/priorities'])
useMutation(POST /api/scoring/priorities, {
  onSuccess: () => queryClient.invalidateQueries(['combatants'])
})
```

### Interaction flows

1. **Open detail** — click card → `setSelectedCharId(id)`. Click same card → collapse.
2. **Edit weight** — typing updates `localWeights`, sets `activePreset = 'custom'`. "Salvar" button becomes enabled when `localWeights !== serverWeights`.
3. **Click preset** — fills `localWeights` with preset values, sets `activePreset`.
4. **Save** — POST fires with `localWeights`; on success combatants list refetches with recalculated scores; cards re-sort.
5. **Reset** — preset "Reset" sets all weights to `1`, same save flow.

### Preset definitions

| Preset | Key stats |
|--------|-----------|
| DPS | ATK: 10, CRate: 8, CDmg: 8, ATK%: 7, SPD: 4, others: 1 |
| Tank | HP: 10, DEF: 10, HP%: 8, DEF%: 8, EHP: 6, others: 1 |
| Reset | All weights: 1 |

---

## Section 5 — Error Handling & Edge Cases

### Empty states

- No combatants → centered "Nenhum combatente encontrado" with muted icon
- Gear slot empty → GearSlotCard shows "Vazio", no score bar
- Portrait missing → `<User />` fallback icon (same pattern as RescuePage)
- `avg_gear_score: 0.0` → displayed as `—` on card

### Loading states

- Grid loading → 8 skeleton cards matching real card dimensions
- Detail loading → spinner inside panel, slots as skeletons
- Weights loading → inputs disabled

### Errors

- `GET /api/combatants` fails → red message above grid + "Tentar novamente" button
- `GET /api/combatants/{id}/stats` fails → error inside detail panel only; grid stays visible
- `POST /api/scoring/priorities` fails → inline error below "Salvar" button; weights not reset

### Input constraints

- Weight inputs accept range `0`–`10`; values outside are clamped on blur
- `selectedCharId` is not persisted; detail collapses on page remount

### Responsive

- Viewport < 768px: `ScoringPanel` collapses to an icon button that opens as an overlay drawer
