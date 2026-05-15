# Stat Calibration — Track A Results

**Client data version**: 2026-05-01
**Validated against**: 9 unique (char, gear) samples across 4 capture sessions (2026-05-04 to 2026-05-09)

---

## Before Track A bug fixes (scaling tables wired but bugs unpatched)

Batch run across 4 captures, 9 samples — scaling tables wired but before Bug A/B/D fixes:

| Stat   | N | mean_pct | median_pct | max_abs_pct | within_1% |
|--------|---|----------|------------|-------------|-----------|
| ATK    | 9 | -40.98%  |  -36.67%   |    73.34%   |     0%    |
| DEF    | 9 | -41.46%  |  -37.52%   |    75.72%   |     0%    |
| HP     | 9 | -40.39%  |  -34.66%   |    84.99%   |     0%    |
| CRate  | 9 |  -2.65%  |   +0.00%   |    23.87%   |    89%    |
| CDmg   | 9 |  +0.00%  |   +0.00%   |     0.00%   |   100%    |

---

## After Track A bug fixes (Bug A + Bug B + Bug D)

Same 9 samples after applying cumulative ascend, level/ascend alignment, and partner default_add:

| Stat   | N | mean_pct | median_pct | max_abs_pct | within_1% |
|--------|---|----------|------------|-------------|-----------|
| ATK    | 9 | -25.87%  |  -26.53%   |    29.21%   |     0%    |
| DEF    | 9 | -28.32%  |  -28.79%   |    33.18%   |     0%    |
| HP     | 9 | -33.67%  |  -30.63%   |    52.02%   |     0%    |
| CRate  | 9 |  -2.65%  |   +0.00%   |    23.87%   |    89%    |
| CDmg   | 9 |  +0.00%  |   +0.00%   |     0.00%   |   100%    |

**Improvement**: ATK median gap -36.7% → -26.5%. CRate/CDmg remain exact.
**Status: DONE_WITH_CONCERNS** — median ATK/DEF/HP gap still exceeds ±5% target.

---

## Bugs found and fixed in Track A

### Bug B — Ascend bonuses non-cumulative (FIXED)

`build_ascend_scaling()` in `scripts/build_scaling_tables.py` stored per-tier deltas.
The loader picks `ascend_table[N]` expecting the **total** bonus for ascend N, not just tier N.

For Yuki L60 A5 (dev_ascend group, delta=16 ATK per tier × 5 tiers):
- Before: ascend bonus ATK = 16 (row 5 value only)
- After:  ascend bonus ATK = 80 (cumulative 0+16+16+16+16+16)

**Fixed in**: `scripts/build_scaling_tables.py` `build_ascend_scaling()`.
**Test**: `tests/api/test_scaling.py::test_ascend_5_is_cumulative_sum_of_rows_1_to_5`.

### Bug A — `validate_stats.py` level/ascend alignment (FIXED)

`_compare()` used `char_info.level` / `char_info.ascend` from the loaded
`memory_fragments` file. When memory_fragments is stale (e.g., Cassius with `exp=0`
because recently acquired), prediction used level=1/ascend=0 instead of battle-time
level=58/ascend=5. This caused the -73% ATK outlier for Cassius.

**Fix**: before calling `calculate_build_stats`, override `info.level` and `info.ascend`
with battle-frame values (`char["level"]`, `char["ascend"]`); restore in `finally`.
**Fixed in**: `api/capture/validate_stats.py` `_compare()`.

### Bug D — Partner `default_atk_add` / `default_def_add` / `default_hp_add` not applied (FIXED)

`partner_base@char_partner.json` has fixed per-partner flat additions (e.g.,
Westmacott `default_atk_add=27`). These were never included in partner stat totals.

**Fix**: Added `PARTNER_DEFAULT_ADD` dict (45 entries, fully populated from the DB table)
and applied unconditionally in `get_partner_stats()`.
**Fixed in**: `api/game_data/partners.py`.

### Bug C — `equip_stat_define` per-piece flat stats (NOT IMPLEMENTED)

**Investigation finding**: After the Bug B fix, all 9 samples show a constant residual
in the game's `BASE_S_ATK` vs optimizer prediction:

```
BASE_S_ATK = char_scaled_cumulative + 120  (ATK, constant for all chars)
BASE_S_DEF = char_scaled_cumulative + 60   (DEF)
BASE_S_HP  = char_scaled_cumulative + 180  (HP)
```

This constant (120/60/180 = 20/10/30 per piece × 6 pieces) is **independent of
piece reinforce level** (confirmed with both all-L4 and all-L5 piece samples, same diff=120).

The `equip_stat_define` table (ids 1..5, 9999) values do NOT match:
- id=5 (reinforce level 5): ATK=82 → 6×82=492 ≠ 120
- id=4 (reinforce level 4): ATK=74 → 6×74=444 ≠ 120
- id=9999: ATK=4 → 6×4=24 ≠ 120

Table id does NOT map to piece reinforce level. The formula is unknown.
**Implementing the wrong formula would make predictions worse.** Bug C left unimplemented.

---

## Open questions / residual gap

After all three implemented fixes, median under-prediction is still ~-26% to -31% for
ATK/DEF/HP. The remaining gap has these components:

### 1. equip_stat_define constant ~120/60/180 not applied (confirmed, source unknown)

Every char has exactly `BASE_S_ATK = char_scaled_cumulative + 120`. The 120 is a
constant flat bonus equal to 20 ATK per equipped piece (for 6 pieces). Source is
unclear — the `equip_stat_define` table uses a different mapping than piece reinforce level.

- [ ] Try mapping equip_stat_define id to SLOT number, CHAR level bracket, or RARITY tier
- [ ] Look for any additional extracted tables (e.g., `account_buff`, `piece_valid_setting`)

### 2. Game formula places partner + friendship inside the % multiplier

Verified for Cassius (no partner in mf, S_PARTNER_BASE_ATK=5 in battle):
```
S_ATK = (BASE_S_ATK + S_PARTNER_BASE_ATK) * (1 + rate_out/100) + flat_add
```

The optimizer applies partner and friendship **after** the percent multiplier:
```python
total_atk = base_atk * (1 + atk_pct/100) + flat + friendship + partner
```

Fixing this requires also verifying that BASE_S_ATK in the game includes friendship
(currently unclear), and correctly mapping S_ATK_INC_RATE_IN vs rate_out.

- [ ] Verify formula: does `BASE_S_ATK` include friendship flat bonus?
- [ ] Does `S_ATK_INC_RATE_IN` = partner passive %, `S_ATK_INC_RATE_OUT` = gear/set %?
- [ ] Update `optimizer.py` to use `(base + partner) * pct` instead of `base*pct + partner`

### 3. validate_stats cannot recover battle-time partner assignment

The `chars[]` battle frame does NOT carry `partner_id`/`partner_res_id` per character.
So validate_stats will under-predict for chars whose memory_fragments partner differs
from the battle-time partner (e.g., Cassius with partner_id=None in mf but has partner in battle).

### 4. CRate outlier: Magna -23.87%

Magna's CRate is under-predicted by ~24%. Likely a `potential_node_ids` parsing issue
or a psychosis/character-specific bonus not captured in memory_fragments.

---

## Sources of stat scaling (final state after Track A)

| Source | Status | Notes |
|---|---|---|
| L1 base stats | WIRED | from `char_base_l1.json` |
| Per-level cumsum | WIRED | `level_scaling.json` |
| Ascend cumsum | WIRED (FIXED) | `ascend_scaling.json` — was per-tier delta, now cumulative |
| Friendship bonus | WIRED | hardcoded table in `constants.py` — additive flat |
| Limit break | NOT WIRED | confirmed: no stat values in `limit_<id>` groups, only unlocks |
| Partner card stats (scaled) | WIRED | `PARTNER_BASE_STATS` + level scaling |
| Partner default_add | WIRED (FIXED) | `PARTNER_DEFAULT_ADD` from `partner_base@char_partner.json` |
| Partner ascend bonus | WIRED | `get_partner_ascend_bonus()` |
| Partner passive % (e.g., ATK%) | WIRED | `get_partner_passive_stats()` |
| Potential nodes (50/60) | WIRED | existing logic |
| equip_stat_define per-piece | NOT WIRED | constant 120/60/180 observed, formula unresolved |
| Partner/friendship before % mult | NOT FIXED | game multiplies (base+partner+friend)×pct |

---

## Snapshot version

- Client data extracted: 2026-05-01
- Captures: 4 sessions between 2026-05-04 and 2026-05-09
- Memory fragments: `memory_fragments_20260509_232009.json` (latest by mtime)
- Report: `api/snapshots/stat_validation_report.json`
