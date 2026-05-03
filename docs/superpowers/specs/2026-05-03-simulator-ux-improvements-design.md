# Simulator UX Improvements — Design Spec

**Date:** 2026-05-03
**Status:** Approved

## Summary

Five improvements to the damage simulator screen:

1. **Reformulated damage columns** — replace Raw/Effective with Normal / Crit / Avg per card, plus per-hit sublinha for multi-hit cards.
2. **Card images** — 32px thumbnail from extracted game assets next to each card name.
3. **Expanded monster presets** — grouped by World Level, Spirit Tower floors, and Special Bosses.
4. **State persistence** — restore last config and results when returning to the page.
5. **Formula validation** — investigate `dmg_revise_rate: 0.36` from extracted game data.

---

## Background

The current simulator shows two damage columns per card (Raw DMG before DEF, and vs Monster after DEF). The monster selector is a flat row of 6 preset buttons. Navigating away discards all state. Card images are absent — only names are shown. The Spark indicator label uses the internal term "Spark" instead of the in-game term "Epifania".

---

## Design

### 1 — Reformulated damage columns

**New columns (replace old Raw DMG + vs Monster):**

| Column | Formula |
|--------|---------|
| **Normal** | `atk × coef × hits × morale_mult × buff_mult × def_reduction × 1.0` (no crit) |
| **Crit** | `atk × coef × hits × morale_mult × buff_mult × def_reduction × (cdmg / 100)` (all hits crit) |
| **Avg** | `Normal × (1 − crate/100) + Crit × (crate/100)` (expected value) |

The **Avg** column is the primary comparison metric and is highlighted in green (`#a3e635`).

**Per-hit sublinha:** Cards with `hits > 1` show a secondary row immediately below with `Normal/hits`, `Crit/hits`, `Avg/hits`. Cards with `hits === 1` show no sublinha (redundant).

**Totals block:** The two total cards at the top show Total Normal, Total Crit, Total Avg (replacing the current Total Raw / Total Effective).

**Backend changes:** `api/routes/simulate.py` must compute and return `normal_damage`, `crit_damage`, `avg_damage` per card. The existing `final_damage` and `effective_damage` fields are removed from the response. The `SimCardResult` type in `src/lib/types.ts` is updated accordingly.

**Epifania:** The spark indicator tooltip and legend note are renamed from "Spark" to "Epifania".

---

### 2 — Card images

**Asset pipeline:**

1. Read `sct_name` from `C:\Users\soste\Downloads\output\db\card(*)@card.json` files (each card entry has a `sct_name` field mapping to the illustration filename).
2. A one-off Python script (`scripts/update_card_sct_names.py`) reads all card files from the extracted DB and writes `sct_name` into each card entry in `api/data/game_db.json`.
3. Copy all PNG files from `C:\Users\soste\Downloads\output\card_illustration\` to `api/assets/cards/`.
4. The `/assets/cards/` directory is served by the existing FastAPI static files mount.

**API change:** `api/routes/simulate.py` includes `icon_path: str | None` in each `SimCardResult`. Value: `/assets/cards/{card.sct_name}.png` if `sct_name` is present, else `None`.

**UI rendering:** In `SimulatorPage.tsx`, the `CardRow` component renders a 32px × 32px rounded (`rounded`) `<img>` with `src={assetUrl(card.icon_path)}` before the card name. On image load error, falls back to a neutral placeholder `<div>` (same size, `bg-[#282828]`). No alt text (decorative — name is adjacent).

---

### 3 — Expanded monster presets

The current flat row of preset buttons is replaced with three labeled groups inside the existing left panel section.

**Groups and values:**

```
Nível do Mundo
  WL1 (DEF 10) · WL2 (DEF 17) · WL3 (DEF 23) · WL4 (DEF 27) · WL5 (DEF 31)

Torre Espiral
  F30 · F60 · F90 · F120 · F150

Bosses Especiais
  Soul Collector (F150) (DEF 59)
```

**Tower floor DEF values:** Derived from `C:\Users\soste\Downloads\output\db\` using the tier→monster level→base DEF progression. The same formula used for ST F150 (equip_stat_define scaling) is applied to each milestone floor. Values are hardcoded in `DEF_PRESETS` in `SimulatorPage.tsx`.

The DEF derivation process:
- `tower_stage_list@tower_stage_list.json` maps floor → tier_id → monster level
- `tier_monster_stat@tier_monster_stat.json` maps tier → stat modifiers
- `equip_stat_define@equip_stat_define.json` provides base DEF per equip_id
- Apply the same powerstep scaling used for F150 to compute F30/F60/F90/F120

**Free numeric input** for custom DEF values is preserved below the groups.

**Visual change:** Group labels are small uppercase muted text (`text-[9px] text-[#555] uppercase tracking-wider`). Selected preset highlighted in orange (`bg-[#fb923c]`). Unselected in `bg-[#2a2a2a] text-[#888]`.

---

### 4 — State persistence

**Storage key:** `czn_simulator_state`

**Stored shape:**
```ts
{
  charName: string
  deckId: number | null
  morale: number
  useSparks: boolean
  monsterDef: number
  weaken: boolean
  vulnerableStacks: number
  dmgReduction: boolean
  result: SimulateDamageResponse | null
}
```

**Save:** On every parameter change (immediate, no debounce — values are small). Also saved/overwritten on successful simulate. If result is present in state, saved result is the last successful simulation.

**Restore:** On `SimulatorPage` mount, read `czn_simulator_state`. Restore all fields. If `result` is non-null, display the results area immediately without re-simulating. `try/catch` on parse errors — falls back to defaults silently.

---

### 5 — Formula validation task

The extracted game data (`constant_meta(stat_formula)@constant_meta.json`) contains `dmg_revise_rate: 0.36` which is not used in the current simulator. During implementation, verify whether this parameter affects the damage formula (e.g., a global damage scaling factor applied before or after the DEF reduction step). If it is load-bearing, update `simulate.py` accordingly and document the finding.

All other formulas are confirmed correct:
- DEF reduction: `300 / (300 + DEF)` ✅
- Morale: `+20% per stack` ✅
- Weaken (Frightened): `×0.75` ✅
- Vulnerable (Exposed): `+50% per stack` ✅
- Fortitude: `×0.85` ✅
- Card coefficient: `ATK × (eff_value / 100)` ✅

---

## Files changed

| File | Change |
|------|--------|
| `api/routes/simulate.py` | Return `normal_damage`, `crit_damage`, `avg_damage`, `icon_path` per card; remove `final_damage`/`effective_damage` |
| `api/data/game_db.json` | Add `sct_name` field to each card entry |
| `api/assets/cards/` | New directory — copy all PNGs from extracted `card_illustration/` |
| `src/lib/types.ts` | Update `SimCardResult`: add `normal_damage`, `crit_damage`, `avg_damage`, `icon_path`; remove old fields |
| `src/pages/simulator/SimulatorPage.tsx` | New card table (image + new columns + per-hit sublinha), grouped monster presets, state persistence |
| `src/i18n/en.ts` | New keys for column headers, group labels, per-hit label, Epifania legend |
| `src/i18n/pt-BR.ts` | Same keys in Portuguese |
| `scripts/update_card_sct_names.py` | One-off script to populate `sct_name` in `game_db.json` from extracted DB |

---

## Out of scope

- Auto-recalculate on parameter change (Simulate button is kept).
- Side-by-side character comparison.
- Sorting the card table by column (sorted by Avg descending, fixed).
- Per-element or per-card-type damage breakdowns beyond Normal/Crit/Avg.
