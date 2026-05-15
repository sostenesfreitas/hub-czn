# Combat Mechanics — Reverse Engineered (Track B)

**Status**: research-only, not wired into runtime.
**Client data version**: 2026-05-01 (extracted JSONs)
**Captures used**: 5 sessions between 2026-05-04 and 2026-05-10 (13,132 frames total)

## TL;DR — validated formula

```
dmg = ATK × (card_eff_value / 100) × (1 − S_DMG_DECREASE_RATE) × crit_factor × weak_mult [× hidden_modifiers]

crit_factor = CDmg / 100        if crit, else 1.0
weak_mult   = S_WEAK_EGO_DMG_RATE / 100   if (card.outline AND monster.weak), else 1.0
def_reduce  = 268 / (S_DEF + 503)         (best fit, R²=0.989)
```

Where:
- `ATK` is `S_ATK` from the caster char (resolved via `cardMap[card_id].char_id` → `chars[i].id`)
- `card_eff_value` is `skillMap[seid].eff_value` for the main damage entry of the card
- `S_DMG_DECREASE_RATE` is read directly from the monster's `status.info` at hit time
- `CDmg` is `S_CRI_DMG_RATE` from the caster (NOT team average — team dict lacks this field)
- `card.outline = True` is the gate for EGO-active cards (`curEgo` is set on ALL cards in the team and doesn't gate)
- `hidden_modifiers` are dva_css and EGO/spark charging mechanisms — **structurally invisible to snapshot polling**, see "Architectural limits" below.

**Coverage on real data**: 10% of all 40 hits (4/7 EMP-eligible) within ±5%. The 3 failing eligible hits all have hidden modifiers.

## Constants (from `constant_meta(stat_formula)@constant_meta.json`)

| Constant | Documented value | Status in actual formula |
|---|---|---|
| `dmg_revise_rate` | 0.36 | **NOT USED in observed damage formula** — falsified empirically (Track B3) |
| `dmg_decrease_rate_0_value` | -160 | **Doesn't fit** the S_DMG_DECREASE_RATE curve (Track B2) |
| `dmg_decrease_rate_curv_value` | 300 | Doesn't fit; empirical fit uses 503 |
| `shield_revise_rate` | 0.3 | Not yet validated |
| `shield_cal_rate_for_base_def` | 1 | Not yet validated |
| `shield_cal_rate_for_add_def` | 0.5 | Not yet validated |
| `rage_base` / `rage_scale` | 1.1 / 1.25 | Not yet validated |
| `battle/elite/boss_rage_turn` | 5 / 7 / 10 | Not yet validated |

The documented `dmg_revise_rate` and `dmg_decrease_rate_*` may apply to player-side mechanics (PvP, shields) not yet captured. They do NOT appear in the observed PvE damage equations.

## DEF reduction curve (Track B1+B2)

**Method**: extracted 153 (enemy_def, S_DMG_DECREASE_RATE) pairs from `battle_*.json` summaries.

**Best fit** among 6 candidate functional forms:

| Form | Definition | R² on 153 pairs |
|---|---|---|
| f1 | `(d − 160) / 300`, clamped 0..1 | -100.56 |
| f2 | `d / (d + 300)` | -58.09 |
| f3 | `(d − 160) / (d + 300)` | -258.07 |
| f4 | `d / (d + 460)` | -8.56 |
| f5 | `300 / (d + 300)` (mirrored shape) | -223.11 |
| **f6** | **`268 / (d + 503)`** (empirical fit) | **0.9884** |

Note: f1-f4 all increase with DEF, but observed `S_DMG_DECREASE_RATE` decreases with DEF, which is why they produce severely negative R². f5 has the correct decreasing shape but uses the documented constant 300 which doesn't fit the data. Only f6 (fully empirical) achieves a meaningful fit. The constants 268 and 503 don't appear in `constant_meta(stat_formula)`.

## Per-hit damage equation evolution

The empirical formula evolved through four iterations as failed hypotheses revealed real structure:

### H1 (FALSIFIED)
```
dmg = ATK × 0.36 × (1 − def_reduce) × crit_factor × 1.0
```
Coverage: 0%. The `0.36` global multiplier doesn't exist in observed damage.

### EMP (validated for clean non-crit hits)
```
dmg = ATK × (skillMap[skill_eff_id].eff_value / 100) × (1 − S_DMG_DECREASE_RATE) × crit_factor
```
The `0.36` is replaced by the per-card `eff_value / 100`. **First verified hit**: `c_30075_srt4_mut`, ATK=1087, eff_value=75, DR=0.334, no crit → predicted 543 vs observed 547 (0.7% error).

### EMP_CF_DIRECT (corrected crit_factor)
```
crit_factor = CDmg / 100        if crit, else 1.0     ← NOT (1 + CDmg/100)
```
Tested both `1 + CDmg/100` (3.37× at CDmg=237) and `CDmg/100` (2.37× at CDmg=237). The latter wins. Adds 2 newly-passing crit hits. Coverage: 10% (4/40).

### EMP_FULL (added weak + EGO gate)
```
weak_mult = S_WEAK_EGO_DMG_RATE / 100   if (card.outline AND lastDamageEvent.weak), else 1.0
```
Reduces LBK card miss from 77% to 72% error but doesn't fully close it. Coverage unchanged at 10% — the remaining failures are architectural (see below).

## Architectural limits — snapshot capture cannot resolve everything

Three hidden modifiers were identified and proven unresolvable from snapshot data alone:

### 1. dva_css (damage value adjustment via condition stacks)

`lastDamageEvent.dva_css` is a list of `cs_id` references. Each `cs_id` SHOULD map to `csMap[cs_id].skillEffs[*]` → `skillMap[seid].eff_value`. However:

**Empirical proof of architectural limit**: 0 of 5 dva cs_ids cited in failing hits (110, 111, 112, 124, 125) ever appear in `csMap` across ALL 13,132 frames in ALL 5 capture files. Stronger evidence: two crit hits from the same card with **identical** `dva_css = [110, 111, 112]` produce **different** damages (1398 vs 1148) — proving condition VALUES differ at consumption time.

Conclusion: dva_css cs_ids are consumed/expired at hit application time, BEFORE the snapshot frame is written. The snapshot captures a state that no longer contains them. Resolving dva_css requires **event-stream capture** — intercepting websocket frames at the moment of hit application, not periodic snapshot polls.

### 2. EGO/Spark/LBK charging mechanisms

Card `c_1052_uni4_lbk` (Lose Brake unique LBK card) fires a hit at observed damage 10,743 vs base prediction 2,423 — a **4.43× multiplier**. The same card hits 13 monsters in the same frame with damages ranging from 78 to 10,743 despite identical monster DEF stats. The variation is driven by per-monster charging condition stacks (`cs[91]` term_value=23, 9-entry `dva_css`) that accumulate over turns and are consumed at hit time — same architectural limit as dva_css.

The user's references confirm:
- **EGO** ("Manifest Ego"): 6-stage progression feature that enhances combatant abilities
- **Spark** ("Epifania"): mechanic that enhances Manifestation of Chaos cards

The data exposes the WRAPPERS for these mechanics (`ep`, `curEgo`, `before_used_ego`, `card.r_spark`, `card.outline`) but the per-hit damage AMPLIFIERS they apply are consumed-on-use, same as dva_css.

### 3. additional_attack triggers

Card `c_1052_srt4_rsp1` fires an additional_attack reaction whose damage driver isn't in the card's `skill_eff_ids`. Predicted 186, observed 193 — close enough to pass under EMP_CF_DIRECT, but only because `eff_value=30` happened to coincide approximately. The actual triggered skill resolution path isn't visible in `cardMap`.

## Per-hit residual table (final state)

```
card                            obs  crit cdmg ego weak  EMP_FULL  err     status
c_30075_srt4_mut                547   N   221   N    Y    543    -0.7%   PASS  (clean non-crit, B3 verified hit)
c_30093_srt4_rsp1               530   N   237   N    Y    552    +4.1%   PASS  (clean non-crit)
c_30093_srt4_rsp1              1219   Y   237   N    Y   1275    +4.6%   PASS  (clean crit)
c_1052_srt4_rsp1                193   Y   125   N    N    186    -3.7%   PASS  (additional_attack, lucky fit)
c_30093_srt4_rsp1              1398   Y   237   N    Y   1275    -8.8%   FAIL  (dva_css consumed)
c_30093_srt4_rsp1              1148   Y   237   N    Y   1275   +11.0%   FAIL  (dva_css consumed)
c_1052_uni4_lbk               10743   Y   195   Y    Y   3029   -71.8%   FAIL  (LBK charging stack)
```

4 of 7 EMP-eligible hits PASS. The 3 failures all have provably hidden modifiers.

## Data sources

### Snapshot frames (where damage lives)

`data.snapshot.cache.battle_wt` contains:
- `monsters[i].lastDamageEvent`: `{damage, crit, weak, dva_css, old_hp, new_hp, ...}`
- `cardMap['<id>']`: `{res_id, char_id, caster_id, skill_eff_ids, passive, continueSkill, r_spark, outline, curEgo, talents}`
- `skillMap['<id>']`: `{eff_value, eff_count_value, final_count_value, stat_source, parent}`
- `csMap['<id>']`: `{cs_id, res_id, skillEffs, term_value, is_passive}` (75 entries typical)
- `condMap['<id>']`: `{condition_type, trigger, value, stack_input, ...}` (131 entries typical)
- `chars[i].status.info`: `{S_ATK, S_DEF, S_HP, S_CRI, S_CRI_DMG_RATE, S_WEAK_EGO_DMG_RATE, ...}` per char
- `char.info`: team-level stats (S_ATK = average), but does NOT carry CDmg

All map keys are **strings** (`'7'`, not `7`). `used_cards` and `dva_css` contain INTS — cast to str for lookups.

### dev_msg frames (text logs)

`dev_msg` is a plain-text battle log with `SkillEff N:res_id:SKILL_EFF_TYPE[:params]` lines. **No numerical damage data.** Useful for Track C (cataloguing observed effect types) but not for damage validation.

### battle_*.json (post-battle summaries)

Contains `enemy_def`, `enemy_dmg_decrease`, `battle_result`, `player_chars[].atk/def/cri/cri_dmg`. 153 files captured. Used for B2 DEF curve fit; no per-hit damage data.

## Open questions

- [ ] **Shield/break mechanics**: documented constants `shield_revise_rate=0.3`, `shield_cal_rate_for_*` not yet tested
- [ ] **Rage mechanics**: `rage_base=1.1`, `rage_scale=1.25`, `battle/elite/boss_rage_turn=5/7/10` not yet tested
- [ ] **PvP applicability of `dmg_revise_rate=0.36`**: maybe applies to player-vs-player, untested
- [ ] **Hidden modifier resolution requires architectural change** to capture: event-stream interception instead of snapshot polling (would need refactor of `api/capture/manager.py`)

## What would help close the gap further

1. **Event-stream capture**: intercept and decode the actual damage application messages from the websocket (not periodic snapshots). Would resolve dva_css, EGO/Spark charging, and additional_attack triggers.
2. **More captures from boss/elite battles**: surviving monsters with multiple non-kill hits per battle. Most current frames are end-of-wave wipes.
3. **PvP captures**: to test whether documented constants apply there.

## Snapshot version

Client data extracted: 2026-05-01.
Battle summaries: 153 files (2026-05-04 to 2026-05-10).
JSONL captures: 5 sessions, 13,132 total frames (the 2026-05-10 capture alone is 34MB, 2,282 lines).
