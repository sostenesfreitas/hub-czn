# Sprint 2f3 - empirical formula fit notes (T3)

**Date**: 2026-05-11
**Diagnostic input**: `docs/research/track_b_lbk_csmap_diagnostic.txt`
**Target**: c_1052_uni4_lbk hits in capture `websocket_debug_20260510_154057.jsonl` via cs_map_raw walking
**Branch / base commit**: `feat/combat-rev-eng` at b9deffa

## Architecture pivot from earlier sprints

Sprint 2f2 found that snapshot.skillMap[*] entries duplicate
CSMultiplierIndex. Sprint 2f3 T1 fixed accumulator card-inst-id resolution
but T2 revealed `cs01_0805` is stored under "user-bucket" owner (id 38),
not the caster char id (id 3). The pivot for T3 is: walk
`state.cs_map_raw` entries by `caster_id` (for direction="attack") or
`owner_id` (for "take"), use the snapshot's `term_value`, and apply
CSMultiplierIndex modifiers ONLY for `MATHSIGN_ADD` (v1 already handles
PCT through `dva_stacks`).

The key observation is that csMap entries carry BOTH `owner_id` (where the
stack lives) AND `caster_id` (who applied it). Filtering by `caster_id`
side-steps the user-bucket vs char-id gap exposed in T2.

## Measurable LBK hits (capture 20260510_154057)

| seq | sim   | obs  | ratio  | matched_line | caster_id=3 stacks with MATHSIGN_ADD mods                       |
| --: | ----: | ---: | -----: | -----------: | --------------------------------------------------------------- |
| 425 | 1771  | 4197 | 2.3698 |          556 | cs_inst[91] res=cs01_0805 tv=23 eff=80 (1 mod)                  |
| 439 | 1771  | 4197 | 2.3698 |          556 | cs_inst[91] res=cs01_0805 tv=23 eff=80 (1 mod)                  |
| 459 |  909  | 4197 | 4.6172 |          556 | cs_inst[91] res=cs01_0805 tv=23 eff=80 (1 mod)                  |
| 478 |  909  | 4197 | 4.6172 |          556 | cs_inst[91] res=cs01_0805 tv=23 eff=80 (1 mod)                  |
| 493 | 1771  | 4197 | 2.3698 |          556 | cs_inst[91] res=cs01_0805 tv=23 eff=80 (1 mod)                  |

Note: every measurable hit lands on the same target (id 39) and resolves
against the same snapshot (line 556), because each hit's
`lastDamageEvent.damage` is identical (4197). This means we effectively
have ONE empirical data-point at two distinct sim values (1771 / 909).
The harness reuses the same snapshot for any future-search match.

Full list of caster_id=3 csMap entries at that snapshot (14 total):

```
cs_inst[7]   res=cs06_0131       tv=1   owner=38
cs_inst[8]   res=cs06_0132       tv=1   owner=38
cs_inst[9]   res=cs06_0133       tv=1   owner=38
cs_inst[14]  res=20002_c1_lv1_01 tv=1   owner=38
cs_inst[15]  res=20002_c2_lv1_01 tv=1   owner=38
cs_inst[17]  res=cs01_0855       tv=10  owner=38
cs_inst[18]  res=cs01_0856       tv=20  owner=38
cs_inst[66]  res=cs01_0833       tv=1   owner=7
cs_inst[91]  res=cs01_0805       tv=23  owner=38   * mods: eff=80 sign=MATHSIGN_ADD direction=attack
cs_inst[93]  res=cs03_0201       tv=1   owner=38
cs_inst[95]  res=cs01_0833       tv=1   owner=85
cs_inst[107] res=eq_g01_006_02   tv=3   owner=38
cs_inst[121] res=cs01_0833       tv=1   owner=99
cs_inst[206] res=cs06_0134       tv=2   owner=38
```

Only `cs01_0805` produces a `MATHSIGN_ADD` modifier matching
`direction="attack"` AND `link_cs_id` empty (no conditional gate). All
other cs_ids are no-ops under CSMultiplierIndex for direction="attack" /
MATHSIGN_ADD lookup.

## Formula candidate evaluation

Composition rule: `v2_mult = 1.0 + (sum of candidate(eff, tv)) / 100.0`,
applied multiplicatively against `sim_damage`.

| Candidate            | Formula              | total flat_add | v2_mult | err_pct seq=425 (sim=1771) | err_pct seq=459 (sim=909) | Within ±5%? |
| -------------------- | -------------------- | -------------- | ------- | -------------------------- | ------------------------- | ----------- |
| (a) eff              | 80                   | 80.00          | 1.80    | -24.0%                     | -61.0%                    | N           |
| (b) eff * tv / 100   | 80 * 23 / 100        | 18.40          | 1.18    | -50.0%                     | -74.4%                    | N           |
| (c) eff * tv         | 80 * 23              | 1840.00        | 19.40   | +718.6%                    | +320.2%                   | N           |
| (d) eff + tv         | 80 + 23              | 103.00         | 2.03    | -14.3%                     | -56.0%                    | N           |
| (e) eff * log(tv+1)  | 80 * ln(24)          | 254.24         | 3.54    | +49.5%                     | -23.3%                    | N           |

No candidate closes any of the 5 LBK hits to within ±5%. Worst case (c)
over-shoots by +718.6%; best case for sim=1771 is (d) at -14.3%, and for
sim=909 is (e) at -23.3%. The two clusters of sim values (1771 vs 909)
require DIFFERENT v2_mults (2.37 vs 4.62) to close the gap — meaning the
required v2_mult is correlated to something inside the per-fire context
(not present in csMap, since csMap is identical across all 5 hits).

## Cross-check (other captures)

### c_30093 (capture 20260509_111039) - 3 measurable hits

| seq | sim  | obs  | ratio  | caster_id=3 MATHSIGN_ADD flat_add | v2_mult | err vs obs |
| --: | ---: | ---: | -----: | --------------------------------- | ------- | ---------- |
| 161 | 1236 | 1398 | 1.1311 | 0.00                              | 1.0     | -11.6%     |
| 164 |  828 | 1148 | 1.3865 | 0.00                              | 1.0     | -27.9%     |
| 173 | 1242 | 1219 | 0.9815 | 0.00                              | 1.0     | **+1.9%**  |

The c_30093 hits don't have any cs01_0805 with caster_id=3 at fire time,
so EVERY candidate degenerates to v2_mult=1.0 and predictions are
unchanged. seq=173 keeps passing ±5% (good). seq=161 / 164 stay outside
(unchanged). **No candidate breaks the c_30093 passing hit.**

### c_1052 low (capture 20260505_104037) - 5 measurable LBK hits

| seq | sim  | obs | ratio  | caster_id=3 MATHSIGN_ADD flat_add | tv | predictions |
| --: | ---: | --: | -----: | --------------------------------- | -- | ----------- |
| 124 |  894 | 604 | 0.6756 | eff=80 tv=8                       | 8  | All candidates over-predict massively |
| 143 | 2294 | 547 | 0.2384 | eff=80 tv=8                       | 8  | All candidates over-predict massively |
| 143 |    0 | 547 | 0.0000 | (sim=0, division undefined)       | 8  | n/a         |
| 221 | 2294 | 547 | 0.2384 | eff=80 tv=8                       | 8  | All candidates over-predict massively |
| 221 |    0 | 547 | 0.0000 | (sim=0)                           | 8  | n/a         |

Critically, the LBK_LOW capture has the OPPOSITE sign of error than
LBK_RICH: sim > obs (sim/obs ratio < 1), meaning observed damage is
SMALLER than simulated. Applying ANY positive v2_mult based on
cs01_0805 (which IS present here with tv=8) WORSENS these predictions:

- (a) eff=80: predicted 1609 vs obs 604 -> +166.4% error
- (d) eff+tv=88: predicted 1681 vs obs 604 -> +178.3% error
- Even the smallest candidate (b) gives +57.5% error

**Verdict**: any non-trivial candidate that closes LBK_RICH (sim<obs)
would explosively break LBK_LOW (sim>obs). The two captures have
contradictory error signs while exposing the same cs01_0805 modifier.
The root cause of the LBK gap is NOT cs01_0805's MATHSIGN_ADD modifier
applied via caster_id=3.

## Chosen formula

**Branch E (no-op)** - keep `_compose_skill_map_multiplier` returning
1.0 unconditionally.

Rationale:

1. NO candidate (a)/(b)/(c)/(d)/(e) closes any LBK_RICH hit to within
   ±5%. Best (d) for sim=1771 is at -14.3%; best (e) for sim=909 is at
   -23.3%.
2. The LBK_RICH (under-predict) and LBK_LOW (over-predict) captures
   have OPPOSITE error signs for the same cs01_0805 modifier exposure.
   Any non-trivial candidate that improves LBK_RICH worsens LBK_LOW.
3. Two LBK_RICH sim clusters (1771 vs 909) need v2_mult=2.37 vs 4.62 but
   see identical csMap state — the missing factor lives in per-fire
   context (likely sub-hit indexing, EGO trigger, or sub-skill chain),
   not in csMap.
4. The 2f2 finding (lastDamageEvent.dva_css contains the actual cs
   INSTANCE ids consumed at hit time, not derivable from snapshot
   ALONE) still applies. cs_map_raw walking by caster_id does not
   recover the missing context.
5. Branch E preserves the c_30093 seq=173 passing hit (+1.9% within
   ±5%) and the synth verified_hit_1 tests (which build state without
   cs_map_raw).

## Cross-check verdict

The Branch E choice (return 1.0) is safe across all 3 captures:

- LBK_RICH: simulator stays at sim=1771/909 (matches what Sprint 2e1
  shipped; oracle gap unchanged).
- c_30093: seq=173 keeps its +1.9% pass; seq=161/164 stay outside ±5%
  (unchanged).
- LBK_LOW: predictions stay at sim=894/2294 (unchanged); no further
  over-prediction introduced.

## T4 implementation directive

**FAILURE_MODE selected**: keep `_compose_skill_map_multiplier` as
Branch E no-op. Oracles for c_1052_uni4_lbk stay xfail. Sprint 2f3
ships as measurement-only — the cs_map_raw / skill_map_raw plumbing
from 2f2 remains wired and ready for a future sprint when the dva_css
mechanism (per-fire instance accumulator) is built.

Concretely T4 should:
- leave the body of `_compose_skill_map_multiplier` returning 1.0
- update its docstring to cite this fit-notes document and the
  2f3 T3 conclusion (caster_id walking via cs_map_raw also fails to
  close LBK within ±5%; opposite error signs across LBK_RICH/LBK_LOW)
- keep the harness-side `state.cs_map_raw` / `state.skill_map_raw`
  wiring (2f2) intact for future iteration
