# Sprint 2f2 — empirical formula fit notes (T3)

**Date**: 2026-05-11
**Diagnostic input**: `docs/research/track_b_skill_map_diagnostic.txt` (T1 output)
**Target hits for fit**: c_30093_srt4_rsp1 seq=161 (ratio 1.131, 4 stacks) and c_1052_uni4_lbk seq=425 (ratio 2.37, 15 stacks)

## Empirical findings

### c_30093 seq=161 (target=347, obs=1398, sim=1236)

- Accumulator at fire time: 4 stacks `cs00_0002=1, cs00_0003=1, cs02_0404=1, cs02_0405=1`
- Snapshot at relevant frame (line 1299, lde_dmg=1398): csMap has ONE entry on target — `cs_inst[1] res=cs02_2013 term_value=1 skillEffs=[5]`
- `skillMap[5]`: `res=cs02_2013_01 eff_value=1 parent.type=CS` — but `cs02_2013_01` in client db `cs(monster)@skill_eff.json` is `SKILL_EFF_CARD_MOVE_TO`, **NOT a damage modifier**.
- Conclusion: the 13.1% gap on seq=161 does NOT come from any cs entry visible in the snapshot's skillMap. The contributing stacks (cs00_0003, cs02_0404, cs02_0405) are either not represented in the snapshot at all, or have no static damage modifier.

### c_1052_uni4_lbk seq=425 (target=39, obs=4197, sim=1771)

- Accumulator at fire time: 15 stacks across cs00_0001..cs06_0064 (multiple res_ids)
- Snapshot at line 556 (lde_dmg=4197): csMap has ONE entry on target — `cs_inst[57] res=cs00_0004 term_value=3 skillEffs=[144]`
- `skillMap[144]`: `res=cs00_0004_01 eff_value=50 parent.type=CS` — but `cs00_0004` is **already in CSMultiplierIndex** with `+50% MATHSIGN_ADD_HUND_MULTIPLY_PCT direction=take`. v1 already applies this.
- **`lastDamageEvent.dva_css = [76, 132, 192, 194, 236, 237, 160, 201]`** — 8 cs INSTANCE ids consumed at hit time that contributed to the 4197 damage. None are present in the snapshot's csMap anymore.

## Verdict on the 4 candidate formulas

| Candidate | Behavior | Outcome |
|---|---|---|
| **A** (naive PCT) | `(1 + eff/100)` per qualifying entry | Re-applies cs00_0004 already in CSMultiplierIndex → DOUBLE-COUNTS v1 (regression on LBK and any hit with cs00_0004 stack) |
| **B** (count scaling) | `(1 + eff/100) ** term_value` | Same double-count issue + count scaling overshoots (1.5^3 = 3.375× on cs00_0004) |
| **C** (linear eff × term) | `(1 + eff × term / 100)` | Same double-count issue + cs02_2013 (eff_value=1) doesn't move the needle |
| **D** (direct ratio) | `mult *= eff/100` | Cs02_2013's eff_value=1 → mult=0.01, would zero out damage. Clearly wrong. |

None of A/B/C/D close ≥1 oracle without breaking other hits. The data simply doesn't carry the missing multipliers.

## Architectural finding

The actual game mechanism uses `lastDamageEvent.dva_css` (list of cs INSTANCE ids that contributed to the hit) coupled with per-instance term_value at consumption time. Both the consumed-cs-instances and their consumption-time term_values are NOT in the snapshot frame written AFTER the hit lands.

**To resolve Track B gaps, Sprint 2f3+ must either:**
1. **Refactor Sprint 2d's accumulator to track per cs_inst_id** (not just per res_id), so consumption-time term_values are observable at fire time, OR
2. **Read lastDamageEvent.dva_css and trace each cs_inst_id back through event-stream history** to determine its term_value at consumption.

Either is a substantial architectural change beyond Sprint 2f2's scope.

## T4 directive

**FAILURE_MODE / Branch E**: ship `_compose_skill_map_multiplier` as a no-op (returns 1.0) with detailed docstring explaining the empirical finding. State plumbing from T2 stays in tree — net positive infra for the future Sprint 2f3 architecture.

## Deferred to 2f3

- Per-instance accumulator tracking
- dva_css extraction from lastDamageEvent
- Empirical fit on per-instance term_value data
- Closing the 3 xfail oracles
