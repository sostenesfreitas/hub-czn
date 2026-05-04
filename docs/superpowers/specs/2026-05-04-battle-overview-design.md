# Battle Overview — Design Spec
**Date:** 2026-05-04  
**Status:** Approved

## Problem

The Battle History page has low perceived relevance. It shows raw data (DEF, ATK, DPT numbers, result badges) but offers no synthesis that helps the user decide what to do next. The user wants three outcomes from this page:

- **A)** Know exactly which substat to prioritize on the next gear upgrade
- **B)** See if characters are underperforming relative to their potential
- **C)** Track stat and damage evolution across battles over time

## Solution

Add an **Overview tab** as the new default landing page for Battle History. The tab presents pre-computed insights, cross-battle character trends, and a compact result timeline — all derived by a new backend endpoint `/api/battle/overview`.

The two existing tabs (Analytics, History) are preserved and become sub-nav items alongside Overview.

---

## Architecture

### Data flow

```
snapshot dir (battle_*.json)
        │
        ▼
GET /api/battle/overview   ← reads ALL files, not just last 30
        │
        ▼
BattleOverview (JSON)
        │
        ▼
OverviewTab (React)
  ├── SummaryStrip
  ├── InsightCards
  ├── CharTrendGrid
  └── RecentResultsTimeline
```

All aggregation and insight logic lives in the backend. The frontend is pure display. No new state management — single `useQuery` call with `staleTime: 30_000`.

### Why backend (not frontend)

- Accesses full history, not just the 30 battles fetched by the history tab
- Math (breakeven, crit factor, trend %) stays in one place alongside existing `_analyze_char()` logic
- Testable via existing pytest infrastructure
- Frontend stays simple: render what the endpoint returns

---

## Backend

### New file: `api/routes/battle.py` (additions)

#### Response models

```python
class OverviewSummary(BaseModel):
    total: int
    win_rate: float           # 0–100
    avg_enemy_def: float
    avg_team_dmg: float
    last_battle_time: str | None

class InsightCard(BaseModel):
    level: str                # "urgent" | "warning" | "positive"
    title: str
    description: str
    action: str
    char_res_id: str | None   # for avatar lookup on frontend

class CharTrend(BaseModel):
    res_id: str
    battle_count: int
    avg_dpt: float
    dpt_trend_pct: float      # % change: first-half avg vs second-half avg
    dpt_sparkline: list[float] # normalized 0–1, last 8 appearances (oldest→newest)
    latest_atk: float
    latest_crate: float
    latest_cdmg: float
    priority: str             # "crate" | "cdmg" | "atk" | "balanced"
    breakeven_delta: float    # actual_cdmg − (2×crate + 100); negative = CDmg priority

class RecentResult(BaseModel):
    capture_time: str
    battle_result: str | None
    enemy_def: float
    total_team_dmg: float
    mvp_res_id: str | None

class BattleOverview(BaseModel):
    summary: OverviewSummary
    insights: list[InsightCard]   # max 4
    chars: list[CharTrend]        # only chars with ≥ 2 battles; sorted by avg_dpt desc
    recent: list[RecentResult]    # last 10 battles, newest first
```

#### Endpoint

```
GET /api/battle/overview → BattleOverview
```

- Reads all `battle_*.json` files from snapshot dir (sorted by mtime)
- Returns **HTTP 404** if no files found
- `battle_latest.json` excluded from the list (it's a duplicate pointer)

#### Insight engine

Evaluated in priority order; at most **4 cards** are returned (highest priority first).

| Priority | Level | Rule | Trigger |
|---|---|---|---|
| 1 | urgent | CRate extremamente baixa | any char with CRate < 30% (most recent appearance) |
| 2 | urgent | CRate abaixo do breakeven | CDmg > 2×CRate+100 with gap > 30pp |
| 3 | warning | Dependência de carry | 1 char responsible for > 55% of avg team DMG |
| 4 | warning | Inimigos mais difíceis | avg DEF of last 3 battles > avg DEF of prior battles by > 20% |
| 5 | positive | Personagem evoluindo | any char with `dpt_trend_pct` > +10% |

Insight texts are generated in Portuguese with inline numbers (e.g., "+12% dano estimado"), consistent with existing `battle.py` tip generation.

#### CharTrend computation

For each `res_id` that appears in `player_chars` across ≥ 2 battles:

- **`latest_*`**: stats from the most recent battle's `player_chars` entry
- **`avg_dpt`**: mean of all DPT values where `char_dpt[res_id]` exists (battles with DPT data only)
- **`dpt_trend_pct`**: `(avg_dpt_second_half / avg_dpt_first_half − 1) × 100`; requires ≥ 4 DPT data points, else `0.0`
- **`dpt_sparkline`**: last `min(8, N)` DPT values normalized to [0, 1] relative to the char's own max DPT (for display scaling); may be empty if char has no DPT data at all
- **`priority`** and **`breakeven_delta`**: reuse `_analyze_char()` logic from existing code, called with the latest stats and the most recent `enemy_def`

---

## Frontend

### Tab structure

The left sidebar entry "Battle History" navigates to `/battle`. Inside the page, a horizontal sub-nav replaces the current two-button tab strip:

```
[ Overview ]  [ Analytics ]  [ History ]
```

Overview is selected by default (`useState('overview')`).

### New component: `OverviewTab`

Single `useQuery` for `api.battleOverview()`. On 404: shows empty state (Sword icon + "Nenhuma batalha capturada"). On other errors: error banner.

Layout (vertical stack, `max-w-3xl`, `p-4`, `gap-4`):

1. **`SummaryStrip`** — 5 stat pills: Batalhas · Win Rate · Avg DEF Inimigo · Avg Team DMG · Última Batalha
2. **`InsightList`** — renders up to 4 `InsightCard` components. Each card: colored left border (red/yellow/lime), icon, title, description, action pill
3. **`CharTrendGrid`** — `grid-cols-auto-fill minmax(220px)`. Each `CharTrendCard`: avatar (via `assetUrl`), name (from `combatants`), battle count, priority badge, ATK/CRate/CDmg mini-bars, SVG sparkline, avg DPT
4. **`RecentResultsList`** — 10 compact rows: result badge · enemy DEF · total team DMG · MVP avatar+name · relative time

### `api.ts` addition

```typescript
battleOverview: () => request<BattleOverview>('/api/battle/overview'),
```

### `types.ts` additions

`OverviewSummary`, `InsightCard`, `CharTrend`, `RecentResult`, `BattleOverview` — matching the backend models above.

### i18n

Static UI labels (column headers, empty states, tab names) added to `en.ts` and `pt-BR.ts`. Dynamic insight text (titles, descriptions, actions) is generated by the backend in Portuguese.

---

## Testing

- New `tests/api/test_battle_overview.py`:
  - `test_overview_404_when_no_data`: endpoint returns 404 with empty snapshot dir
  - `test_insight_crate_below_breakeven`: given a char with CRate=38, CDmg=245, insight level="urgent" appears
  - `test_insight_carry_dependency`: given one char with >55% avg DPT share, warning appears
  - `test_char_trend_requires_two_battles`: chars with only 1 battle excluded from `chars` list
  - `test_dpt_trend_pct_calculation`: given known DPT sequence, trend % is correct
  - `test_sparkline_normalized`: sparkline values are all in [0, 1]

---

## Known Limitations

- Insight text is always in Portuguese (consistent with existing `battle.py`). Full i18n of dynamic strings is out of scope.
- `player_chars` reflects stats at battle time, not current gear — a character that upgraded gear recently will show old stats until the next captured battle.
- Sparklines require ≥ 2 DPT data points per character; chars with no DPT data (wave-mode battles) show a flat line.
