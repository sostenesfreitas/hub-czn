# Combat Mechanics — Reverse Engineered (Track B)

**Status**: research-only, not wired into runtime.
**Client data version**: 2026-05-01 (extracted JSONs)
**Captures used**: 4 sessions between 2026-05-04 and 2026-05-09

## Constants (from `constant_meta(stat_formula)@constant_meta.json`)

| Constant | Documented value | Status in actual formula |
|---|---|---|
| `dmg_revise_rate` | 0.36 | **NOT USED in observed damage formula** (see B3 below) |
| `dmg_decrease_rate_0_value` | -160 | **Doesn't fit** the S_DMG_DECREASE_RATE curve (see B2) |
| `dmg_decrease_rate_curv_value` | 300 | Doesn't fit; empirical fit uses 503 |
| `shield_revise_rate` | 0.3 | Not yet validated |
| `shield_cal_rate_for_base_def` | 1 | Not yet validated |
| `shield_cal_rate_for_add_def` | 0.5 | Not yet validated |
| `rage_base` / `rage_scale` | 1.1 / 1.25 | Not yet validated |
| `battle/elite/boss_rage_turn` | 5 / 7 / 10 | Not yet validated |

## DEF reduction curve (Track B1+B2)

**Method**: extracted 133 (enemy_def, S_DMG_DECREASE_RATE) pairs from `battle_*.json` summaries.

**Best fit** among 6 candidate functional forms:

| Form | Definition | R² on 133 pairs |
|---|---|---|
| f1 | `(d − 160) / 300`, clamped 0..1 | -101.29 |
| f2 | `d / (d + 300)` | -54.04 |
| f3 | `(d − 160) / (d + 300)` | -247.26 |
| f4 | `d / (d + 460)` | -8.66 |
| f5 | `300 / (d + 300)` (mirrored shape) | -211.02 |
| **f6** | **`268 / (d + 503)`** (empirical fit) | **0.9889** |

**Conclusion**: the documented `dmg_decrease_rate_*` constants (-160, 300) don't apply to `S_DMG_DECREASE_RATE` directly. Either they apply to a different curve (player-side?), or the game uses different constants for monster-side computation. The empirical 268/503 isn't in the documented constants — origin unknown.

Note: f1-f4 all increase with DEF, but observed `S_DMG_DECREASE_RATE` decreases with DEF, which is why they produce severely negative R². f5 has the correct decreasing shape but uses the documented constant 300 which doesn't fit the data. Only f6 (fully empirical) achieves a meaningful fit.

## Per-hit damage equation (Track B3)

**Tested hypothesis** (H1):
```
dmg = ATK × dmg_revise_rate × (1 − def_reduce) × crit_factor × skill_mult
```
With `dmg_revise_rate = 0.36` and `skill_mult = 1.0` (placeholder).

**Result**: 12.8% coverage (5/39 hits within ±5%), median relative diff 32.8%.

H2 and H3 are identical to H1 when extra parameters (vulnerable_pct, morale, elemental_mult, rage_mult) are at their default values, so all three hypotheses yielded the same coverage.

**Empirically observed formula** (from 1 verified non-crit hit):
```
dmg = ATK × (card_eff_value / 100) × (1 − S_DMG_DECREASE_RATE) × crit_factor [× dva_css_multiplier?]
```
Verified: `1087 × 0.75 × (1 − 0.334) = 543` vs observed `547` (0.7% error).

Card used: `c_30075_srt4_mut`, `eff_value = 75`, ATK = 1087, `S_DMG_DECREASE_RATE` = 0.3337.

**Key changes from H1**:
- The `0.36` global multiplier is replaced by the per-card `eff_value / 100`. This means the skill multiplier is the dominant scaling, not a global constant.
- Therefore, accurate damage prediction requires the per-skill `eff_value` from `card(*)@skill_eff.json` — Track C dependency.

## Data sources for damage validation

`dev_msg` frames are plain-text battle logs. They DON'T have:
- per-hit ATK/DEF stats
- damage numbers
- crit flags

They DO have:
- `SkillEff N:res_id:SKILL_EFF_TYPE[:params]` lines
- `[condition_triggered]` lines
- card use events with cardMap references

Real per-hit damage data is in **snapshot frames** at `data.snapshot.cache.battle_wt.monsters[i].lastDamageEvent`:
- `damage`: actual damage dealt
- `crit`: bool
- `dva_css`: list of damage-value-adjustment skill IDs active for this hit
- `old_hp` / `new_hp`: HP before/after

Of the 39 hits extracted across 4 JSONL files (10,897 total frames), only 4 were clean surviving hits (new_hp > 0). Kill-shot frames report uncapped predicted damage rather than HP drained, making them unsuitable for formula validation without correction.

## Open questions

- [ ] **dva_css multiplier**: damage-value-adjustment stacks (e.g., `id=110`) modify damage by an unknown multiplier. Three crit hits with identical ATK/DEF/CDmg show 22% spread. The eff_values of these stacks aren't in `skillMap` of the snapshot — possibly tracked elsewhere or computed dynamically.
- [ ] **Crit factor formula**: empirically observed ratio between crit/non-crit (same card) is ~2.64×. Documented formula `1 + CDmg/100` would give 3.37× for CDmg=237%. Either CDmg is applied differently, or the empirical sample includes a confounding factor.
- [ ] **Documented constants vs reality**: `dmg_revise_rate`, `dmg_decrease_rate_*` don't appear in the observed formulas. They may apply to player-side mechanics (PvP?), shield calculations, or other subsystems not yet captured.
- [ ] **Kill-shot interpretation**: `lastDamageEvent.damage` on a kill (`new_hp=0`) reports the UNCAPPED predicted damage, not the HP that was drained. For accurate validation, only non-kill hits should be used.
- [ ] **Skill multipliers** (`card_eff_value`): Track C deliverable. Each skill in `card(*)@skill_eff.json` has an `eff_value` that needs to be parsed and indexed by skill_id.
- [ ] **ATK source for response cards**: the empirical formula uses the individual char's S_ATK for mutation cards; response cards may use the combined team S_ATK (`bwt.char.S_ATK`). Not yet confirmed with a response-card hit.

## What would help close the gap

1. **Track C output**: per-skill `eff_value` lookup table, plug into validate_damage's `_frame_to_hit`.
2. **More captures with surviving monsters**: most current frames are end-of-wave wipes; few clean non-kill multi-hit sequences.
3. **dva_css decoder**: investigate where these stack values are tracked. Possibly inside `skillMap[N].eff_value_history` or per-frame deltas.
4. **PvP captures**: validate the documented `dmg_decrease_rate_*` constants against player-side calculations (where `dmg_revise_rate=0.36` may actually apply).

## Snapshot version

Client data extracted: 2026-05-01.
Battle summaries: 133 files (2026-05-04 to 2026-05-09).
JSONL captures: 4 sessions, 10,897 total frames.
