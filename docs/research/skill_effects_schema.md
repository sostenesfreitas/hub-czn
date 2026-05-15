# Skill Effects — Canonical Schema (Track C)

**Status**: research-only, machine-readable dictionary at `api/snapshots/skill_eff_dictionary.json`.
**Client data version**: 2026-05-01

## Coverage

| Source | eff_types | Observation |
|---|---|---|
| Client `*@skill_eff.json` files | 181 | Canonical universe |
| Observed in dev_msg (4 capture sessions) | 46 | Subset that has appeared in actual gameplay |
| Prior `skill_eff_schema.json` (older capture) | 42 | Earlier snapshot before more sessions |
| Total observations across captures | 37,595 | Includes repeats — top types fire many times per battle |

## Top observed effect types

| eff_type | observed | client instances | params_keys |
|---|---|---|---|
| SKILL_EFF_CS_SET_ADD | 10529 | 3424 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CS_SET_ADD_IGNORE_COND | 9539 | 696 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_DMG | 3051 | 1362 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_DMG_IGNORE_COND | 2794 | 143 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CARD_MOVE_TO | 2025 | 166 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CARD_DRAW | 1202 | 269 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CS_SET_ADD_AUTO | 942 | 142 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_SHIELD_IGNORE_COND | 857 | 84 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CARD_DISCARD | 831 | 54 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_SHIELD | 821 | 329 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CURE_IGNORE_COND | 706 | 33 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CARD_GET | 651 | 459 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_TRIGGER_INSPIRATION | 629 | 6 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CURE | 475 | 139 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_DMG_COOP | 423 | 28 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_MONSTER_TURN_COUNT | 244 | 35 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_STRESS_ADD | 225 | 81 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_HEAL | 200 | 74 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CARD_TALENT_ADD | 169 | 41 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |
| SKILL_EFF_CARD_USE | 168 | 53 | eff_value, eff_count_value, eff_value_type_1, eff_value_type_2, eff_condition_value_0, eff_condition_value_1, eff_condition_value_math_sign_0, eff_condition_value_math_sign_1, value_opt_1, value_opt_2, value_save_renewal_flag |

## Most-defined-but-never-observed (top 10)

| eff_type | client instances | source files (sample) |
|---|---|---|
| SKILL_EFF_DAMAGE_VALUE_ADD | 972 | card(aqswaw9004), card(bookie), card(camille1009) (+23 more) |
| SKILL_EFF_SHIELD_VALUE_ADD | 88 | card(camille1009), card(neutral), cs(card1) (+10 more) |
| SKILL_EFF_CURE_VALUE_ADD | 67 | card(hongooo), card(partner), cs(card1) (+12 more) |
| SKILL_EFF_CARD_COST_CHANGE | 59 | card(ikarus), cs(card1), cs(card2) (+4 more) |
| SKILL_EFF_CRITICAL_PCT_VALUE_ADD | 54 | card(camille1009), card(domi), card(hongooo) (+11 more) |
| SKILL_EFF_TUTORIAL | 46 | cs(tutorial) only |
| SKILL_EFF_COUNT_VALUE_ADDITIONAL | 44 | card(camille1009), cs(card1), cs(card2) (+4 more) |
| SKILL_EFF_TARGET_CS_VALUE_ADD | 44 | card(hongooo), cs(card1), cs(card2) (+4 more) |
| SKILL_EFF_CURRENCY_ADD | 32 | card(neutral), cs(monster), fate_skill (+4 more) |
| SKILL_EFF_RUN | 32 | monster(encounter) only |

Notes on unobserved types:
- `SKILL_EFF_DAMAGE_VALUE_ADD` has by far the most client instances (972) yet was never seen — likely a passive stat-mod applied before battle starts and therefore not emitted in dev_msg battle logs.
- `SKILL_EFF_TUTORIAL` appears only in `cs(tutorial)` files — tutorial battles are unlikely to appear in normal capture sessions.
- `SKILL_EFF_RUN` appears only in `monster(encounter)` — may require a specific escape/flee event not covered by our 4 sessions.

## Stack rule inference (top 10 observed)

For the top 10 most-observed types, `?` is used whenever the name and params alone are insufficient to determine the rule. No stack behavior is assumed without direct evidence.

| eff_type | params | duration field | stack rule | notes |
|---|---|---|---|---|
| SKILL_EFF_CS_SET_ADD | eff_value (CS card id), eff_count_value (quantity), link_cs_id | none observed | stack | Adds CS card stacks; observed 10k+ times, per-trigger accumulation implied by additive semantics |
| SKILL_EFF_CS_SET_ADD_IGNORE_COND | same as SKILL_EFF_CS_SET_ADD | none | stack | `_IGNORE_COND` variant bypasses precondition checks; otherwise identical behavior |
| SKILL_EFF_DMG | eff_value (multiplier %), eff_value_type_1 (VALUE_COMMON / VALUE_UNIQUE), eff_count_value | none | n/a | Immediate damage trigger; not a status — stack concept does not apply |
| SKILL_EFF_DMG_IGNORE_COND | same as SKILL_EFF_DMG | none | n/a | `_IGNORE_COND` variant of SKILL_EFF_DMG; same reasoning |
| SKILL_EFF_CARD_MOVE_TO | eff_value (destination slot), eff_count_value, eff_card_place | none | n/a | One-shot card relocation; no persistent state |
| SKILL_EFF_CARD_DRAW | eff_value (draw count), eff_count_value | none | n/a | One-shot card draw; no persistent state |
| SKILL_EFF_CS_SET_ADD_AUTO | same as SKILL_EFF_CS_SET_ADD | none | ? | `_AUTO` suffix may mean triggered automatically (not player-initiated); stack rule unknown without targeted capture |
| SKILL_EFF_SHIELD_IGNORE_COND | eff_value (shield amount %), eff_value_type_1 | not observed directly | ? | `_IGNORE_COND` variant of SKILL_EFF_SHIELD; whether shields stack, refresh, or cap is unknown |
| SKILL_EFF_CARD_DISCARD | eff_value (discard count or card id) | none | n/a | One-shot card discard; no persistent state |
| SKILL_EFF_SHIELD | eff_value (shield amount %), eff_value_type_1, eff_count_value | not observed directly | ? | Observed 821 times but duration/stack fields not distinguished in current captures |

## SKILL_EFF_DMG deep dive (relevance to Track B)

Track B's damage formula validation depends on per-card `eff_value` lookup. SKILL_EFF_DMG has 1362 instances in client JSONs and was observed 3051 times in capture sessions.

Sample SKILL_EFF_DMG row (first instance from `skill_eff_dictionary.json`):

```json
{
  "action_timing_target_renewal_flag": "YES",
  "auto_shuffle_flag": "NO",
  "card_place_toast_visible": "YES",
  "during_eff_0_link_condition_id": "none",
  "during_eff_0_link_skill_eff_id": "none",
  "during_eff_1_link_condition_id": "none",
  "during_eff_1_link_skill_eff_id": "none",
  "eff": "SKILL_EFF_DMG",
  "eff_attr": "[]",
  "eff_card_place": "CARD_PLACE_NONE",
  "eff_card_target_char": "NONE",
  "eff_card_target_count": "-1",
  "eff_card_value_min": "0",
  "eff_condition_count_value_0": "0",
  "eff_condition_count_value_1": "0",
  "eff_condition_count_value_math_sign_0": "MATHSIGN_NONE",
  "eff_condition_count_value_math_sign_1": "MATHSIGN_NONE",
  "eff_condition_value_0": "0",
  "eff_condition_value_1": "0",
  "eff_condition_value_math_sign_0": "MATHSIGN_NONE",
  "eff_condition_value_math_sign_1": "MATHSIGN_NONE",
  "eff_count_value": "1",
  "eff_count_value_0_link_condition_id": "none",
  "eff_count_value_1_link_condition_id": "none",
  "eff_count_value_type": "VALUE_COMMON",
  "eff_count_value_type_opt": "[]",
  "eff_count_value_type_opt_multiple_link": "[]",
  "eff_link_condition_id": "none",
  "eff_opt": "[]",
  "eff_opt_and_or": "AND",
  "eff_opt_multiple_link": "[]",
  "eff_value": "100",
  "eff_value_0_link_condition_id": "none",
  "eff_value_1_link_condition_id": "none",
  "eff_value_math_sign": "MATHSIGN_NONE",
  "eff_value_stat_source_target": "NONE",
  "eff_value_type_1": "VALUE_COMMON",
  "eff_value_type_2": "VALUE_NONE",
  "id": "c_1057_srt1_01",
  "link_battle_system_effect_id": "none",
  "link_cs_id": "[]",
  "operation": "OPERATION_ACTIVE",
  "operation_trigger_motion_type": "none",
  "outline_link_condition_id": "[]",
  "run_check_opt": "none",
  "run_pct": "100",
  "run_priority": "500",
  "target_card_must_flag": "NO",
  "target_card_select_flag": "NO",
  "target_card_set": "CARD_SET_NONE",
  "target_card_set_card_debuff": "[]",
  "target_card_set_card_sort": "[]",
  "target_card_set_card_type": "[]",
  "target_card_set_ego_type": "[]",
  "target_card_set_faction": "[]",
  "target_card_set_list_card_place": "CARD_PLACE_NONE",
  "target_card_set_list_count": "-1",
  "target_card_set_list_count_type": "VALUE_COMMON",
  "target_card_set_list_pick_type": "LIST_PICK_NONE",
  "target_card_set_opt_cost": "[]",
  "target_card_set_opt_multiple_link": "[]",
  "target_card_set_opt_rarity": "[]",
  "target_card_set_talent": "[]",
  "target_effect_flag": "YES",
  "target_save_renewal_flag": "YES",
  "target_unit_type": "TARGET_UNIT_SELECTED",
  "target_unit_type_opt": "[]",
  "target_unit_type_opt_link_cs_id": "[]",
  "target_unit_type_opt_multiple_link": "[]",
  "target_unit_type_opt_outline": "YES",
  "timing_interrupt_flag": "NO",
  "trigger_noti_type": "NO",
  "value_opt_1": "[]",
  "value_opt_1_multiple_link": "[]",
  "value_opt_2": "[]",
  "value_opt_2_multiple_link": "[]",
  "value_save_renewal_flag": "NO"
}
```

Key fields:
- `eff_value`: the multiplier as integer percentage — `"100"` = 100%, `"75"` = 75%. The first instance is a baseline 100% hit.
- `eff_value_type_1`: scaling target tag. `VALUE_COMMON` appears on the majority of instances; `VALUE_UNIQUE` and other tags appear on special skills.
- `eff_count_value`: hit count (usually `"1"`; multi-hit skills use higher values).
- `target_unit_type`: `TARGET_UNIT_SELECTED` (single-target) vs. other values for AoE.
- `id`: the row identifier from the source file — used to correlate with Track B's skill resolution.

**Track B integration path**:
1. Index SKILL_EFF_DMG instances by `id` (the row key from `card(X)@skill_eff.json`) matching Track B's `_frame_to_hit` skill resolution.
2. In `validate_damage._frame_to_hit`, replace `skill_mult = 1.0` with `skill_mult = SKILL_EFF_DMG_lookup[skill_id]["eff_value"] / 100`.
3. Re-run validation to see if H1 coverage jumps from 12.8% to higher.

## Open questions

- [ ] **Stack rule for the bottom 36 of 46 observed types**: most are `?`. Need targeted captures (apply same effect twice and observe behavior — does duration reset, do stacks accumulate, or does the new instance replace?).
- [ ] **eff_value_type_X meanings**: `VALUE_COMMON`, `VALUE_UNIQUE`, `VALUE_SPECIAL` appear as type tags. Need to map each to its actual scaling source (ATK, unique stat, special formula, etc.).
- [ ] **Effect dependencies / cascades**: some effects (e.g., `SKILL_EFF_CS_SET_ADD` with `link_cs_id`) trigger other effects. The dependency graph is not built.
- [ ] **The 135 of 181 unobserved types**: many are likely cinematic, dialogue, or specific to game modes (PvP, raid) not yet captured. A targeted "capture every event mode" pass could increase observed coverage significantly.
- [ ] **SKILL_EFF_DAMAGE_VALUE_ADD never seen**: 972 client instances but zero observations. This is the largest gap between client definition and observed data. Investigate whether this type is applied as a pre-battle passive (not logged in dev_msg) or only in unreached game modes.
- [ ] **eff_value_stat_source_target field**: most rows show `"NONE"` but the field name implies a stat-sourced scaling path (e.g., a percentage of a specific unit's stat). Cases where this is non-`NONE` have not been isolated.
- [ ] **Multi-hit parsing**: `eff_count_value > 1` defines multi-hit skills. Current Track B formula treats each hit separately; need to confirm whether the dev_msg emits one `SkillEff` line per hit or one per skill use.

## Sources

- `C:\Users\soste\Downloads\output\db\*skill_eff*.json` (43 files, 181 distinct eff_types)
- `C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_*.jsonl` (4 files, 37,595 SkillEff observations parsed)
- Output dictionary: `api/snapshots/skill_eff_dictionary.json`
- Parser: `api/capture/build_skill_eff_dictionary.py`
- Prior snapshot (42-type): `api/snapshots/skill_eff_schema.json`

## Snapshot version

Client data extracted: 2026-05-01.
JSONL captures: 4 sessions (2026-05-04 to 2026-05-09).
