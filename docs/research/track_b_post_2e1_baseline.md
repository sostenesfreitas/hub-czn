# Sprint 2f1 — Post-2e1 measurement findings

**Date**: 2026-05-11
**Branch**: feat/combat-rev-eng
**Last commit before measurement**: `07326f8` (Sprint 2e2 close)
**Commits during sprint**: `33cfa85` (CaptureReader fix), `1ec9ac2` (rich dashboard report), `d4b548f` (xfail oracles)

## Sprint conclusion

**Sprint 2f1 ships measurement infrastructure + research findings, NO v2 cs_multiplier feature**. The measurement-first approach revealed that the three v2 features originally scoped (per-stack count scaling / MATHSIGN_ADD composition / link_cs_id gate evaluation) do not explain the documented Track B failing hits. The actual mechanism is `csMap[cs].term_value`-based dynamic composition, which is a Sprint 2f2 architectural concern.

## What landed in 2f1

1. **`api/simulator/replay/capture_reader.py`** — 4-line filter relaxation: accept frames where the top-level `dir` field is absent (older capture format compatibility). Unlocked use of richer captures.

2. **`docs/research/replay_report_websocket_debug_20260510_154057.md`** — Outlier dashboard for the richest available capture (Heidemarie+Narja in Tower of Screams). 7894 events, 290 with delta_pct populated, c_1052_uni4_lbk measurable (5 hits, obs=4197).

3. **`tests/api/test_simulator_formulas.py`** — 3 `@pytest.mark.xfail(strict=False)` oracle tests for the 3 documented failing hits. Permanent regression markers; remove xfail decoration in 2f2 when term_value composition lands.

## xfail oracle status

| Oracle | Status | Pred (v1) | Obs target | Closed by v1? |
|---|---|---|---|---|
| `c_30093_srt4_rsp1` crit 1398 | XFAIL | ~1275 | 1398 | No |
| `c_30093_srt4_rsp1` crit 1148 | XFAIL | ~1275 | 1148 | No |
| `c_1052_uni4_lbk` crit 10743 | XFAIL | ~3029 | 10743 | No |

## Replay dashboard summary

For `websocket_debug_20260510_154057.jsonl`:

- Total events: **7894**
- Dispatched within ±5%: **8**
- Dispatched outside ±5%: **282**
- Missing from index: 503 (no formula registered)
- No-target / skipped: 517
- Crashed: 0

The outlier table (top 50) shows simulator OVER-predicting by 100–1158% on Veronica's `c_1033_cre1_01` and various monster cards. Hypothesis: v1's presence-based composition applies multipliers from too many cs_ids on heavily-conditioned targets. Sprint 2f2 / future work may need to gate by `link_cs_id` AND/OR weight by `term_value`.

## Slow regression status

- `test_real_capture_replays_without_crash`: PASS
- `test_real_capture_caster_resolution_rate_above_80_pct`: PASS (floor 25%, currently ~29%)
- `test_event_parser_extracts_thousands_of_events_from_real_capture`: PASS
- `test_real_capture_dva_stacks_visible_for_dmg_events`: PASS
- `test_real_capture_dva_multiplier_applied_for_at_least_5_dmg_events`: PASS

## Why no v2 feature shipped

Deep-dive on `c_1052_uni4_lbk` seq=425 (sim=1771, obs=4197, delta -57.8%, need ~1.58× additional multiplier on top of v1's 1.5×):

**Target 39 stacks at fire time (15 unique cs_ids)** with CSMultiplierIndex modifier mapping:

| cs_id | accumulator count | static modifier | v1 applies? |
|---|---|---|---|
| `cs00_0002` | 13 | +50% PCT take | YES (×1.5) |
| `cs00_0012` | 1 | -20% MATHSIGN_ADD take | NO (v1 skips ADD) |
| `cs06_0064` | 6 | +20% MATHSIGN_ADD take | NO (v1 skips ADD) |
| `cs00_0001` | 6 | +20% MATHSIGN_ADD attack | NO (wrong direction) |
| `cs00_0003` | 2 | +75% MULTIPLY_PCT attack | NO (wrong direction) |
| 10 others | various | none in CSMultiplierIndex | N/A |

**Evaluation of v2 options A/B/C against the LBK gap:**

- **Option A (per-stack count scaling)**: `cs00_0002^13 = 1.5^13 = 194×` → massive over-shoot
- **Option B (MATHSIGN_ADD composition)**: cs00_0012 (-20%) + cs06_0064 (+20%) = **net 0** → no change
- **Option C (link_cs_id gate evaluation)**: no gated modifiers present → no change

**Conclusion**: None of the 3 v2 features scoped in the Sprint 2e1 spec close the LBK gap. The actual mechanism must be dynamic (term_value-based), not static eff_value-based.

## The term_value finding

Snapshot at JSONL line=556 captures target 39's LBK damage (`lastDamageEvent.damage=4197, crit=True, is_auto=False`). The csMap state at THAT snapshot shows target 39 has only **`cs00_0004` with `term_value=3`** as a populated stack.

But Sprint 2d's accumulator reported target 39 had 15 stacks at seq=425, with `cs00_0004` cumulative count = 12.

**Divergence**:
- Accumulator (event-stream cumulative): count=12
- Snapshot (instantaneous term_value): 3

The simulator currently uses accumulator state. The actual game mechanic uses **snapshot's term_value**. The 9× ratio (4×3 ≈ 12; 4 maybe the multiplier per term unit?) is suggestive but not yet validated across multiple LBK hits.

This is the Sprint 2f2 architectural problem:
1. Read `csMap[cs].term_value` from snapshot at fire time (not accumulator's cumulative count)
2. Empirically map `term_value` → damage multiplier formula across multiple LBK hits
3. Replace or augment `_compose_dva_multiplier` to consume term_value

## Sprint 2f2 proposed scope

**Pre-requisite**: more captures with measurable LBK hits (>5 data points; ideally across multiple battles and characters with LBK cards). Need term_value evolution traced over turns.

**Tasks**:
1. T1: Augment harness state with snapshot-derived term_value lookup (independent of accumulator)
2. T2: Empirical fit — try formulas like `mult = 1 + term_value × k`, `mult = term_value^k`, etc., against multiple LBK hits
3. T3: Replace static eff_value composition with term_value composition for cs_ids that have specific tagging (probably LBK-class cards)
4. T4: Remove xfail decoration from `test_track_b_oracle_c_1052_uni4_lbk_crit_10743` if closed

**Why not now**: insufficient data (only 5 measurable LBK hits, all in same battle, term_value snapshot timing inconsistent with fire-time). User would need to play more battles with LBK-state cards.

## Architectural insight from 2f1

**Measurement-first saved real implementation effort.** If 2f1 had implemented Option A (count scaling) blindly, it would have introduced a 1.5^13 multiplier on heavily-stacked targets — massive regression. Option B would have added complexity for zero gap-closure. The investigation cost ~2 commits; the avoided wrong-implementation cost would have been ~5 commits + regression cleanup.

**Captures matter.** The original capture (`websocket_debug_20260511_100845.jsonl`) had 1 lastDamageEvent (auto-attack only). The richer Heidemarie+Narja capture (`websocket_debug_20260510_154057.jsonl`) had 53 lastDamageEvent occurrences and unlocked the entire investigation. A measurement-driven sprint depends on rich, targeted captures — building test fixtures matters as much as building code.

## Files touched in 2f1

- `api/simulator/replay/capture_reader.py` (4-line fix)
- `docs/research/replay_report_websocket_debug_20260510_154057.md` (new dashboard)
- `tests/api/test_simulator_formulas.py` (3 xfail oracles + 2 helpers)
- `docs/research/track_b_post_2e1_baseline.md` (this file)
