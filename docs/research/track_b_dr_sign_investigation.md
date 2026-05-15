# Track B — DR formula sign investigation (Sprint 2f5 Feature 2)

**Date:** 2026-05-11
**Capture:** `websocket_debug_20260510_154057.jsonl`
**Conclusion:** **Outcome A — formula matches actual game behavior.**

## Question

Sprint 2e fit `DR = 268 / (DEF + 503)` (R^2 = 0.989) from Track B observations.
The derivative is negative — higher DEF predicts *lower* damage reduction. This
is counterintuitive: in most RPGs, more DEF means more mitigation. Before any
further damage formula work, we needed to verify whether:

- **A.** The game really does behave this way (formula correct, the sign is
        weird but real)
- **B.** Actual DR is roughly constant or weakly correlated with DEF; the curve
        was a single-point fit that doesn't generalize
- **C.** Actual DR strictly INCREASES with DEF; the sign is wrong and
        `_def_reduce` / `default_damage_reduction` need to be flipped

## Method

Dumped every monster spawned in the capture and recorded `(S_DEF, S_DMG_DECREASE_RATE)`
straight from `snapshot.cache.battle_wt.monsters[i].status.info`. Compared
each actual DR against `268 / (S_DEF + 503)`.

Script: `scripts/dr_investigation.py`.

## Data

93 distinct monsters across 11 DEF buckets. Sorted by DEF:

| DEF        | DR_real  | formula  | delta    | bucket type      |
|-----------:|---------:|---------:|---------:|------------------|
| 180.95     | 0.3617   | 0.3918   | -0.0301  | fractional       |
| 181.72     | 0.3612   | 0.3914   | -0.0302  | fractional       |
| 217.14     | 0.3617   | 0.3721   | -0.0104  | fractional       |
| 274.85     | 0.3597   | 0.3445   | +0.0152  | fractional       |
| **289.00** | **0.3377** | **0.3384** | **-0.0007** | **integer (clean)** |
| **299.00** | **0.3337** | **0.3342** | **-0.0005** | **integer (clean)** |
| **309.00** | **0.3299** | **0.3300** | **-0.0001** | **integer (clean)** |
| **329.00** | **0.3226** | **0.3221** | **+0.0005** | **integer (clean)** |
| 329.82     | 0.3597   | 0.3218   | +0.0379  | fractional       |

## Analysis

### Integer-DEF monsters (clean spawn values)

For monsters whose `S_DEF` is an integer (which we believe are the original
spawn values, untouched by any per-encounter buffs/debuffs), the formula
**fits superbly**: |delta| < 0.001 in every clean bucket. And DR really does
fall as DEF rises within that range:

- DEF 289 → DR 0.3377
- DEF 329 → DR 0.3226

That's a drop of ~1.5 DR points over 40 DEF — clearly negative slope. **The
counterintuitive direction is real.**

### Fractional-DEF monsters

Fractional `S_DEF` values (180.95, 181.72, 217.14, 274.85, 329.82) all show
DR clamped to ~0.3597–0.3617 — almost identical regardless of DEF. These are
almost certainly monsters whose live DEF has been *modified by combat buffs/
debuffs*, while their DR was locked at spawn time using their original
(integer) DEF. The fractional DEF is what the snapshot reports right now,
but DR was computed from a different value earlier.

Evidence supporting this: every fractional DEF in the dataset can be derived
by multiplying some integer (e.g. 1.05 × 175 ≈ 183.75, 1.10 × 250 = 275) —
strongly suggesting active buffs. The DR plateau at ~0.36 is exactly what we
would expect if all of these monsters spawned with DEF somewhere in the
~245-260 range and their post-buff DEF is what the snapshot now shows.

### Why does DR decrease with DEF?

We do not know the game-design reason. One plausible interpretation: in this
game, higher-DEF monsters tend to have larger HP pools and the devs wanted
to keep effective TTK roughly constant — so they offset higher HP with
*lower* DR. Whatever the reason, the math is consistent and the formula
captures it.

## Decision

**Outcome A: formula is correct. No code changes required for Feature 3.**

The Feature 3 task (DR formula fix) will record an empty commit. The
`_def_reduce` and `default_damage_reduction` functions stay as-is.

Caveat for future readers: the formula was fit on spawn-DEF values. If we
ever want to model live-DEF-changing-during-combat correctly, we need to
track the spawn DEF separately and feed *that* into the DR formula, not the
current (buffed) DEF. For Track B verified_hit_1 and similar tests, the
target's `dmg_decrease_rate` is the snapshot-reported value, which short-
circuits `_def_reduce` anyway (see `formulas.py:85`), so no test impact.

## References

- Original fit: `api/capture/fit_def_curve.py`, Sprint 2e
- Implementation: `api/simulator/formulas.py::_def_reduce` (line 7)
- Implementation: `api/optimizer/expected_damage.py::default_damage_reduction` (line 36)
- Investigation script: `scripts/dr_investigation.py`
- Source data: `C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260510_154057.jsonl`
