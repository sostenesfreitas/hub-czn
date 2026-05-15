# Sprint 2g1 — Resolver fall-through investigation conclusion

**Date**: 2026-05-12
**Diagnostic**: `docs/research/track_b_resolver_fallthrough.txt`

## Per-capture path distribution

| Capture | Dispatched | Resolved | Resolved % | p1 | p2 | p3 | p4 | p5 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| websocket_debug_20260511_100845 | 652 | 187 | 28.7% | 13 | 0 | 174 | 0 | 465 |
| websocket_debug_20260510_154057 | 6874 | 2387 | 34.7% | 643 | 0 | 1742 | 2 | 4487 |
| websocket_debug_20260509_111039 | 10215 | 5159 | 50.5% | 2355 | 0 | 2797 | 7 | 5056 |
| websocket_debug_20260505_104037 | 4318 | 1975 | 45.7% | 930 | 0 | 1045 | 0 | 2343 |
| **TOTAL** | **22059** | **9708** | **44.0%** | 3941 | 0 | 5758 | 9 | 12351 |

Overall path mix (of 22,059 dispatched events):
- path 1 (direct match): 17.9%
- path 2 (card_owner_lookup): 0.0%
- path 3 (skill_eff_id prefix): 26.1%
- path 4 (segment_caster): 0.0% (only 9 events)
- path 5 (fallback player_team[0]): **56.0%**

Aggregate "resolved" rate (paths 1-4) is 44.0% — well above the
single-capture 28.68% baseline from Sprint 2f6 (which measured caster
resolution on the smaller 100845 capture). Larger captures with 1052/Rich
runs hit ~45-50% because path 1 (direct match) and path 3 (prefix) cover
more events when there are many player-skill fires.

Path 4 (segment_caster) firing only 9 times across 22,059 events is
notable — the segment-caster instrumentation from 2f5/2f6 is effectively
dormant once paths 1-3 are in place. Most "chain" effects either match
a player res_id via prefix (path 3) or fall to path 5.

## Top patterns hitting path 5

| Count | Pattern |
|---:|---|
| 1064 | cs-prefix (cs01_0808*) |
| 770 | other |
| 755 | eq-prefix (eq_pub*) |
| 569 | monster_prefix (30094*) |
| 427 | cs-prefix (cs01_1084*) |
| 306 | monster_prefix (30076*) |
| 302 | cs-prefix (cs01_0473*) |
| 296 | cs-prefix (cs01_1072*) |
| 292 | cs-prefix (cs06_0102*) |
| 290 | cs-prefix (cs06_0133*) |
| 270 | cs-prefix (cs01_0833*) |
| 248 | add_r_spark_* |
| 220 | cs-prefix (cs00_0004*) |
| 218 | cs-prefix (cs06_0124*) |
| 211 | cs-prefix (cs06_0115*) |
| 209 | cs-prefix (cs00_0010*) |
| 198 | cs-prefix (cs00_0288*) |
| 176 | monster_prefix (20033*) |
| 166 | cs-prefix (cs06_0131*) |
| 149 | monster_prefix (30044*) |

Top path-5 eff_types (5701 SKILL_EFF_CS_SET_ADD_IGNORE_COND, 3732
SKILL_EFF_CS_SET_ADD, 867 SKILL_EFF_DMG_IGNORE_COND, ...) confirm the
vast majority are condition-driven CS stack additions and passive
damage ticks — events where "who is firing" is genuinely ambiguous
because they're declarative state mutations, not directed casts.

Inspecting a raw `cs01_0808` csMap entry shows the structure:

```json
{
  "cs_id": 5,
  "res_id": "cs01_0808",
  "owner_id": 21,
  "caster_id": 21,
  "char_id": 3,
  "skillEffs": [48, 49]
}
```

`caster_id` is the unit (cardinst) that triggered the entry, `char_id`
is the player it belongs to. Both fields are reliable on every entry.

## Conclusion

**Outcome (c) — mixed**.

Distribution: clear pattern clusters exist, but the bulk is structurally
unresolved.

- `cs01_*`, `cs06_*`, `cs00_*` patterns total ~3950 events (~32% of
  path-5). All these are chain-skill effects with `cs_map_raw` entries
  carrying authoritative `caster_id` / `char_id` fields. A path-6
  implementation that joins SkillEffEvent → cs_map_raw via the
  `skillEffs` list and resolves to `char_id` (mapping cardinst →
  player char) is technically feasible.
- `eq_pub*`, `eq_g*` equipment effects (~800 events, ~6.5%) are
  passive auras: caster is the equipped unit, but no obvious
  lookup table exists for "which unit has which equipment" at the
  state level. Would need equipment-ownership reconstruction —
  bigger lift.
- Monster-prefix patterns (`20033*`, `30044*`, `30076*`, `30094*`,
  ~1200 events, ~10%) actually SHOULD resolve via path 3 (monster
  prefix branch). The fact they don't suggests their `unit.res_id`
  doesn't match the prefix exactly — possible Sprint 2g2 quick win
  by widening the monster res_id match.
- `other` (770 events, ~6%) and `add_r_spark_*` (248) are remaining
  structural cases.

Critical caveat for path 6 (cs_map_raw): the `cs01_*` patterns are
SKILL_EFF_CS_SET_ADD effects — they ADD stacks to other units, often
from passive auras that themselves trigger on conditions. The
`caster_id` in the cs_map_raw entry is "the unit who put this stack
here," which is the correct semantic caster for most damage attribution
purposes. However, given that path 4 (segment_caster) fires only 9
times and the Sprint 2f6 resolution gain was only 0.77pp, the marginal
benefit of adding path 6 is unclear without measurement.

## Recommendation for T4

**Implement path 6** with the smallest possible surface: only resolve
`cs_*` prefixed skill_eff_ids via `cs_map_raw` lookup, mapping
the cs entry's `char_id` (player res-id) → state.player_team unit.

This addresses the largest fall-through cluster (~32% of path 5,
~3950 events) with a localized, testable change. We can measure the
resolution-rate delta and verify no regression on Track B.

If the path 6 implementation lands cleanly, residual buckets
(monster-prefix mismatch widening, eq_* passive ownership) are
candidates for Sprint 2g2.
