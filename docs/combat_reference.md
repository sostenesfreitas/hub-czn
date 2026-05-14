# CZN Combat Reference — Reverse Engineered

**Status**: living document  
**Client data version**: 2026-05-01 (extracted JSONs)  
**Last updated**: 2026-05-14 (Sprint 2i1)  
**Captures**: 6+ sessions (2026-05-04 to 2026-05-13), ~40k+ frames total

---

## 1. Combat Structure

### 1.1 Turn Flow

```
Battle start
  └─ Wave N
       └─ Turn
            ├─ Player Phase: 1+ Segments (one per card played)
            │    Segment:
            │      SegmentStart event
            │      used_card <actor_id> <card_res_id>  ← sets segment_caster
            │      SkillEff fires (immediate card effects)
            │      [ConditionTriggered → chain SkillEffs fire AFTER SegmentEnd]
            │      SegmentEnd event
            │    * segment_caster persists after SegmentEnd until next SegmentStart
            └─ Monster Phase: monster_use_card <res_id>  ← no unit_id mapping
```

Key behaviors confirmed empirically:
- Chain effects from `ConditionTriggered` fire **after** `SegmentEnd`, not within the segment
- `segment_caster` must persist past `SegmentEnd` to attribute chain effects correctly (Sprint 2f6)
- Monster card uses have no player-unit context; `segment_caster` is cleared on `monster_use_card`

### 1.2 Timing States

Observed in captures via `timing_changed:<TIMING>` dev_msg events:
- `TIMING_CARD_USE_START` / `TIMING_CARD_USE_END`
- `TIMING_MONSTER_TURN`
- `TIMING_BEFORE_COMBAT` / `TIMING_AFTER_COMBAT`

Timing state is tracked but not yet used to gate any simulator logic.

---

## 2. SkillEff ID Naming Convention

SkillEff IDs encode their source in the prefix. This is the primary caster resolution signal.

| Prefix pattern | Source | Example |
|---|---|---|
| `c_<char_res_id>_*` | Player character card skill | `c_1052_uni1_rsp2_01` |
| `<5+digits>_*` | Monster skill / monster-applied buff | `1006005_pt1_00_01`, `30094_c1_lv5_01` |
| `cs<NN>_<NNNN>_<NN>` | Condition stack effect | `cs01_0473_01`, `cs06_0166_03` |
| `eq_*` | Equipment passive | `eq_ds02_003_02_01` |
| `add_r_spark_<name>_*` | Character reactive spark | `add_r_spark_nihilum_01_0` |
| `card_ta_*` | Tutorial/special card | `card_ta_00002_01` |
| `rr_*` | Arena/encounter reward effect | `rr_lux_01_01_01` |

**Sequence numbers**: Effects that fire globally (not tied to a player card) use a fixed `SkillEff` sequence number in the dev_msg (e.g., `cs01_0473_01` always fires as seq=186). This is the diagnostic signature of global passive effects.

---

## 3. Damage Formula

### 3.1 Hit Damage

```
dmg = ATK × (eff_value/100) × (1 − DR) × cf_ev × weak_mult × (1 + extra_dmg_pct/100) × target_count
```

| Term | Source | Notes |
|---|---|---|
| `ATK` | `chars[i].status.info.S_ATK` | Per-character, not team average |
| `eff_value` | `skillMap[seid].eff_value` or `*skill_eff.json` `eff_value` | Integer %, e.g. 75 = 75% ATK |
| `DR` | `268 / (DEF + 503)` | Empirical fit (R²=0.989), see §3.2 |
| `cf_ev` | `1 + (cri/100) × (cri_dmg_rate/100 − 1)` | Expected value crit factor |
| `weak_mult` | `1.0` or `S_WEAK_EGO_DMG_RATE / 100` | Only when `card.outline AND monster.weak` |
| `extra_dmg_pct` | Gear main stat / optimizer config | Extra DMG% buff (default 0) |
| `target_count` | Card `target_unit_type` or user config | 1 for single-target, 3+ for AoE |

**Crit factor derivation**: `CDmg = S_CRI_DMG_RATE / 100` (e.g., 2.37 for 237%).  
`cf_ev = 1.0 + (cri/100) × (CDmg − 1)` → at 30% crit, 237% CDmg: cf_ev = 1.0 + 0.30 × 1.37 = **1.411**

**Confirmed wrong constant**: documented `dmg_revise_rate = 0.36` does NOT appear in observed PvE damage (falsified in Track B H1). May apply to PvP only.

### 3.2 DEF Reduction Curve

```
DR = 268 / (DEF + 503)
```

Derived from 153 empirical (DEF, S_DMG_DECREASE_RATE) battle pairs.

| DEF | DR | Note |
|---|---|---|
| 0 | 0.532 | No defense |
| 100 | 0.447 | Early-game monster |
| 200 | 0.383 | Mid-game monster |
| 500 | 0.267 | Optimizer dummy DEF |
| 1000 | 0.178 | Late-game monster (incorrect — see §5) |
| 258 | 0.320 | Sprint 2h10 max endgame DEF (real data) |

**Shape**: DR *decreases* with DEF (counter-intuitive sign). Higher DEF = lower DR = less damage reduction. Empirically confirmed correct. Constants 268 and 503 do not appear in `constant_meta(stat_formula)@constant_meta.json`.

### 3.3 DoT Damage

```
dot_dmg = ATK × (dot_pct/100) × ticks × target_count × (1 + extra_dmg_pct/100)
```

DoT does NOT include:
- `cf_ev` — DoT does not crit
- `weak_mult` — DoT bypasses weakness gate (game convention)
- `DR` — DoT bypasses DEF reduction (game convention)

Default ticks = 3. Returns 0 when `dot_pct ≤ 0`.

---

## 4. Stat System

### 4.1 Per-Character Stats (from snapshot `chars[i].status.info`)

| Field | Description |
|---|---|
| `S_ATK` | Attack (used in damage formula) |
| `S_DEF` | Defense |
| `S_HP` | Max HP |
| `S_CURRENT_HP` | Current HP at snapshot time |
| `S_CRI` | Crit rate (%) |
| `S_CRI_DMG_RATE` | Crit damage rate (%, e.g. 200 = 2× crit multiplier) |
| `S_WEAK_EGO_DMG_RATE` | Weakness/EGO damage multiplier (%) |
| `S_CURRENT_SHIELD` | Current shield points |

**Team vs per-char**: `char.info` (team-level aggregate) carries `S_ATK` as a team average. `S_CRI_DMG_RATE` is NOT present in team-level fields — must use per-char.

### 4.2 Optimizer Stat Calculation Pipeline

```
base (L1) + level_scaling × level + ascend_scaling (cumulative) + friendship flat
         → × (1 + gear_pct/100) + flat_gear + partner + potential_nodes
```

**Known gaps** (Track A):
- `equip_stat_define` per-piece constant (+120 ATK / +60 DEF / +180 HP) observed but formula unknown
- Partner/friendship should be inside the `× pct` multiplier, not after it
- Median under-prediction still ~-26% for ATK/DEF/HP after fixes

### 4.3 Monster DEF — Real Stat Tiers (Sprint 2h10)

Monster DEF is derived via a 3-step lookup:

```
monster_id "<base>_<NN>"
  → tier_monster_stat[id=int(NN)].stage_enter_link_mon_stat_id  (e.g., "stat_10")
  → mon_stat["stat_10"].stat_def
  → × (monster.stat_def_pct / 100)
```

`mon_stat` has 200 stat tiers (`stat_1`..`stat_200`), NOT 10 as previously assumed.  
`default_powerstep` is a key into `powerstep_define` (damage/HP revise pcts), not a stat tier.

**Post-Sprint 2h10 DEF distribution** (510 catalog entries):
- Range: 47..258, mean: 109
- No more bimodal artifact; endgame monsters capped at ~258 DEF (not 643)
- Each `_NN` variant (e.g., `1004019_10` vs `1004019_01`) is genuinely distinct

---

## 5. Condition Stack (CS) System

### 5.1 What CS Stacks Are

Condition stacks (`cs_id` values like `cs01_0473`, `cs00_0002`) are per-unit accumulators that track battle states. They drive:
- Damage value adjustments (DVA multipliers)
- Effect gating (eff_opt conditions on SkillEff)
- Reactive triggers (ConditionTriggered chains)

### 5.2 Stack Operations (from dev_msg `StackAddEvent`)

```
<actor_id>(role) added <cs_id> to <target_id>(role) value <V> sign <MATHSIGN>
```

| Sign | Operation |
|---|---|
| `MATHSIGN_ADD` | `cur + v` |
| `MATHSIGN_SUBTRACT` | `cur - v` |
| `MATHSIGN_SUBTRACT_MIN_0` | `max(0, cur - v)` |
| `MATHSIGN_SET` | `v` (overwrite) |
| `MATHSIGN_MULTIPLY` | `cur × v` |

Stacks at value ≤ 0 are deleted. Stack state is maintained per `(unit_id, cs_id)` pair.

### 5.3 CS Map (snapshot `csMap`)

`csMap` in the battle snapshot contains the current state of all condition stacks:
```json
"<key>": {
  "res_id": "cs01_0808",      // CS type identifier
  "char_id": 3,               // owning character's unit id
  "owner_id": 21,             // bearer unit id (may differ from char_id for monster-carried)
  "skillEffs": [82],          // skill_eff instances attached to this stack
  "term_value": 3,            // current stack count
  "is_passive": false
}
```

**cs_map_raw** in `BattleState`: the raw `csMap` dict from the snapshot, preserved for caster resolution (Path 6).

### 5.4 CS Categories by Prefix

| Prefix | Category | Notes |
|---|---|---|
| `cs00_*` | Global battle conditions | Universal effects, applied to all units |
| `cs01_*` | Character-specific conditions | Most per-char buffs/debuffs |
| `cs02_*` | Card-interaction conditions | Tied to specific card plays |
| `cs03_*` | Monster-sourced conditions | Applied by monsters during their turn |
| `cs06_*` | Special conditions | Some not in client DB (cs06_0166, cs06_0169 missing) |
| `cs19_*` | Monster-specific buffs | E.g., `cs19_0071` in monster-applied buff context |

### 5.5 Global Passive Effects

`cs01_0473_01` and `cs01_0833_01` (type `SKILL_EFF_CS_SET_ADD`) fire with:
- Fixed `SkillEff` sequence number = **186** in dev_msg
- `caster_id = None` (no actor)
- Zero entries in `csMap` for their res_id
- `target_unit_type = TARGET_UNIT_USER`

These are global passive triggers that fire every combat action, independent of any specific character. The "user" is semantically undefined at the snapshot-polling capture level.

---

## 6. DVA Multiplier System

DVA (Damage Value Adjustment) applies additional multipliers to damage based on condition stack counts at fire time.

### 6.1 How It Works

1. At SkillEff fire time, accumulator provides per-unit stack state (`dva_stacks`)
2. `CSMultiplierIndex` maps `cs_id → [DamageModifier]`
3. Modifiers with `direction="take"` (incoming) and `sign=MATHSIGN_*_PCT` are applied to damage

### 6.2 DamageModifier Structure

```python
cs_id: str           # e.g., "cs00_0002"
eff_value: int       # modifier value
sign: str            # "MATHSIGN_ADD_HUND_MULTIPLY_PCT" or "MATHSIGN_MULTIPLY_PCT"
direction: str       # "attack" | "take" | "other"
link_cs_id: list     # dependencies (chained modifiers)
```

### 6.3 Source Shards (from client DB)

- `cs(monster)@skill_eff.json`
- `cs(card1)@skill_eff.json`
- `cs(card2)@skill_eff.json`

Only `SKILL_EFF_DAMAGE_VALUE_ADD` effects are indexed (972 client instances, 0 observed in dev_msg — likely pre-battle passives, not emitted as SkillEff during battle).

### 6.4 Architectural Limit

`lastDamageEvent.dva_css` lists cs_ids consumed at hit application time. These cs_ids are expired BEFORE the snapshot frame is written. Example: two crit hits from the same card with identical `dva_css = [110, 111, 112]` produce different damages (1398 vs 1148) — proving the values differ at consumption and are unrecoverable from snapshots.

---

## 7. Effect Type Taxonomy

### 7.1 Damage Effects

| Type | Behavior | Notes |
|---|---|---|
| `SKILL_EFF_DMG` | Standard hit damage | Most common damage type (3051 observed) |
| `SKILL_EFF_DMG_IGNORE_COND` | Damage bypassing conditions | `_IGNORE_COND` skips precondition checks |
| `SKILL_EFF_DMG_COOP` | Cooperative/team damage | Applies when multiple chars cooperate (423 observed) |

### 7.2 Condition Stack Effects

| Type | Behavior |
|---|---|
| `SKILL_EFF_CS_SET_ADD` | Add stacks to cs (10529 observed — most common overall) |
| `SKILL_EFF_CS_SET_ADD_IGNORE_COND` | Add stacks, bypass preconditions (9539 observed) |
| `SKILL_EFF_CS_SET_ADD_AUTO` | Auto-triggered stack add (942 observed) |
| `SKILL_EFF_TARGET_CS_VALUE_ADD` | Add to target's CS value directly |

### 7.3 Card Economy Effects (simulator does not model these)

| Type | Behavior |
|---|---|
| `SKILL_EFF_CARD_DRAW` | Draw N cards |
| `SKILL_EFF_CARD_GET` | Add card to hand |
| `SKILL_EFF_CARD_DISCARD` | Discard N cards |
| `SKILL_EFF_CARD_MOVE_TO` | Move card between zones |
| `SKILL_EFF_CARD_COPY_TO` | Copy card to zone |
| `SKILL_EFF_CARD_TALENT_ADD` | Add talent to card |
| `SKILL_EFF_CARD_CHANGE` | Transform card |
| `SKILL_EFF_CARD_USE` | Force-use a card |

These return `status=no_target` in the simulator (no combatant target).

### 7.4 Defensive Effects

| Type | Behavior |
|---|---|
| `SKILL_EFF_SHIELD` | Apply shield (value unclear: % or flat) |
| `SKILL_EFF_SHIELD_IGNORE_COND` | Shield bypassing conditions |
| `SKILL_EFF_CURE` | Heal HP |
| `SKILL_EFF_CURE_IGNORE_COND` | Heal bypassing conditions |
| `SKILL_EFF_HEAL` | Heal HP (variant, 200 observed) |

### 7.5 Other Effects

| Type | Behavior |
|---|---|
| `SKILL_EFF_TRIGGER_INSPIRATION` | Triggers inspiration mechanic (629 observed) |
| `SKILL_EFF_STRESS_ADD` | Add stress to unit (225 observed) |
| `SKILL_EFF_MONSTER_TURN_COUNT` | Modify monster turn counter (244 observed) |
| `SKILL_EFF_ENERGY_CHANGE` | Change energy/morale |
| `SKILL_EFF_MONSTER_CREATE` | Summon monster (returns no_target — not modeled) |
| `SKILL_EFF_NONE` | No-op |

---

## 8. Equipment Effects

Equipment passives fire as `eq_*` SkillEff IDs (e.g., `eq_ds02_003_02_01`).

- **Caster resolution**: Path 6 (cs_map_raw lookup) using full ID or stripped form
- **In cs_map_raw**: Appear as standard entries with `char_id` pointing to the equipped character
- **Gap**: Some equipment IDs not in client DB (e.g., `eq_ds03_007_*` — missing entirely)
- **Not in cs_map_raw**: 17 `eq_*` inferred events remain unresolvable with current capture format

---

## 9. Reactive Spark System (add_r_spark_*)

Reactive sparks are character-specific passive abilities triggered automatically by combat conditions. Named by character: `add_r_spark_<char_name>_<variant>_<idx>`.

### 9.1 Known Char Name → Res_ID Mapping (empirical from this capture)

| Char name in ID | Res_ID | Unit type | Note |
|---|---|---|---|
| `nihilum` (variant 01) | `1052` | Player | Fires after char 1052's own action |
| `nihilum` (variant 03) | `30093` | Monster/NPC | Same char name, different game entity |
| `diallos` (variant 03) | `1033` | Player | |
| `circen` (variant 02) | Multiple | Player | Ambiguous — 2+ chars in same frame |
| `caligo`, `secred`, `vitor` | Unknown | — | Not observed in primary capture |

### 9.2 Resolution (Path 7, Sprint 2i1)

For `add_r_spark_*` IDs: if exactly one `c_<res_id>_*` skill fires in the same dev_msg frame, that char is the reactive spark owner.

Frame with `c_1052_uni1_rsp2_01` (seq 53) + `add_r_spark_nihilum_01_0` (seq 54) → `frame_char_hint = "1052"` → resolved to player unit with `res_id="1052"`.

Fails when multiple chars fire in the same frame (frame_char_hint=None).

---

## 10. Caster Resolution — 7-Path Fallback Chain

The harness resolves caster for each SkillEff in priority order:

| Path | Trigger | Method | inferred |
|---|---|---|---|
| 1 | Direct match | `caster_id == unit.id` | False |
| 2 | Card owner | `caster_id` is a card-instance-id → `card_owner_lookup[caster_id]` | False |
| 3 | ID prefix | Extract `c_<N>_` or `<N>_` from `skill_eff_id`, match `unit.res_id`; fallback to `monster_history` | False |
| 6 | CS map | For `cs*`/`eq_*`/`<digit>*` IDs: scan `cs_map_raw` for matching `res_id`; use `owner_id` > `char_id`; segment_caster as tiebreaker for multi-owner | False |
| 7 | Frame hint | For `add_r_spark_*`: if single `c_<N>_*` in same frame, use that char | False |
| 4 | Segment caster | Use `accumulator.caster_at(seq)` — most recent `UsedCardEvent` actor | False |
| 5 | Fallback | `player_team[0]` | **True** |

**Resolution rate on primary capture (Sprint 2i1)**: 505/652 dispatched = **77.5%**

Unresolvable categories (structural ceiling ~78%):
- Global passives (`cs01_0473/cs01_0833`): no caster context, fixed seq=186
- Card economy effects: no combatant target
- Missing IDs (`cs06_0166_03`, etc.): not in client DB

---

## 11. Capture Format

### 11.1 Frame Types

The game server sends websocket frames of two distinct types, which arrive in **separate** frames:

- **dev_msg frame** (`is_state_update=False`): plain-text battle log with SkillEff lines, no damage numbers
- **battle_wt frame** (`is_state_update=True`): JSON snapshot of current battle state with `lastDamageEvent`

Because they're separate, damage observation requires a two-pass replay: dispatch skills using the most recent state snapshot, then fill in `obs_damage` when the next state-update frame arrives.

### 11.2 Key snapshot fields (battle_wt)

```
chars[i].status.info        → S_ATK, S_DEF, S_HP, S_CRI, S_CRI_DMG_RATE, S_WEAK_EGO_DMG_RATE
monsters[i].status.info     → S_ATK, S_DEF, S_HP, S_CRI, S_CRI_DMG_RATE, S_DMG_DECREASE_RATE
monsters[i].lastDamageEvent → damage, crit, weak, dva_css, is_auto, type, old_hp, new_hp
monsters[i].weak            → bool
cardMap["<id>"]             → res_id, char_id, caster_id, skill_eff_ids, outline, curEgo, r_spark
skillMap["<id>"]            → eff_value, eff_count_value, stat_source, parent
csMap["<id>"]               → res_id, char_id, owner_id, skillEffs, term_value, is_passive
```

All map keys are **strings** (`"7"`, not `7`). `used_cards` and `dva_css` contain INTS — cast to str for lookups.

### 11.3 dev_msg Line Patterns

```
**battle log : SkillEff <N>:<res_id>:<TYPE>[:<params>]
<actor_id>(<role>) added <cs_id> to <target_id>(<role>) value <V> sign <SIGN>
<actor_id> used card <card_res_id>
monster_use_card <res_id>
--------card_use-start--------
========card_use-end========
[condition_triggered] <id>:from_<source>
timing_changed:<TIMING>
```

### 11.4 Architectural Limits

Three categories of data are **unreachable from snapshot polling**:

1. **dva_css consumed at hit time** — `lastDamageEvent.dva_css` lists cs_ids that were expired before snapshot was written. Affects 3/7 validated hits.
2. **EGO/Spark charging stacks** — Per-monster charging accumulators (cs[91] etc.) consumed on LBK use. Same snapshot-timing problem.
3. **additional_attack resolution** — Some skills trigger follow-up hits whose damage driver isn't in the card's `skill_eff_ids`.

Resolving these requires **event-stream capture** (intercept websocket at hit application time, not periodic snapshot polling).

---

## 12. EGO and Spark Mechanics

### 12.1 EGO (Manifest Ego)

- 6-stage progression feature that enhances combatant abilities
- `card.outline = True` gates weak damage bonus (`S_WEAK_EGO_DMG_RATE`)
- `card.curEgo` is set on ALL cards in the team — does NOT gate the weak bonus
- `chars[i].before_used_ego` records pre-use EGO state

### 12.2 Spark (Epifania)

- Mechanic that enhances Manifestation of Chaos (特異) cards
- `card.r_spark` field on cards indicates spark type
- Reactive sparks fire as `add_r_spark_<char>_*` SkillEff events
- `r_spark.json` table: 432 entries, each row describes a spark action's effect chain and conditions

### 12.3 Charging Stacks (LBK)

LBK card `c_1052_uni4_lbk` observed 4.43× damage amplification (predicted 2423, observed 10743). Driven by per-monster charging condition stacks accumulated over turns, consumed at hit time. Unresolvable from snapshots.

---

## 13. Monster Mechanics

### 13.1 Monster Turn

Monsters use cards via `monster_use_card <res_id>` events. No unit_id is available in this event — monster identity must be inferred from the res_id prefix.

### 13.2 Monster-Applied Buffs

Some SkillEff IDs have numeric prefixes matching monsters (e.g., `30094_c1_lv5_01_01`). These are buffs applied BY a monster. In `cs_map_raw`, the `owner_id` field identifies the bearer monster (Path 6 prefers `owner_id` over `char_id` for these).

### 13.3 Synthetic Monsters (Sprint 2g3)

Monsters that fire card skills but never appear in any snapshot `battle_wt` frame are handled via synthetic entries in `monster_history`. These are detected from `monster_use_card` events and created as placeholder `MonsterState` objects for path 3 resolution.

### 13.4 Monster Stats in Snapshot

```
monsters[i].status.info.S_DEF           → raw DEF value
monsters[i].status.info.S_DMG_DECREASE_RATE  → DR = 268/(DEF+503) empirically
monsters[i].status.info.S_ATK           → monster ATK (used when monster is caster)
monsters[i].status.info.S_CRI           → monster crit rate
monsters[i].status.info.S_CRI_DMG_RATE  → monster crit damage
monsters[i].weak                        → weakness flag
```

---

## 14. Open Questions

| Question | Status | Notes |
|---|---|---|
| **Shield mechanics** (`shield_revise_rate=0.3`, `shield_cal_rate_*`) | Not validated | Constants in `constant_meta` but not observed in damage formula |
| **Rage mechanic** (`rage_base=1.1`, `rage_scale=1.25`, turn thresholds 5/7/10) | Not validated | May require specific capture targeting rage-phase fights |
| **`SKILL_EFF_DAMAGE_VALUE_ADD`** (972 client instances, 0 observed) | Unknown | Likely pre-battle passive, not emitted in dev_msg |
| **equip_stat_define constant** (+120 ATK / +60 DEF / +180 HP per char) | Observed, formula unknown | Cannot wire without knowing the table key mapping |
| **Partner/friendship inside % multiplier** | Bug documented, not fixed | Game uses `(base + partner) × pct`, optimizer uses `base × pct + partner` |
| **dva_css resolution** | Architecturally blocked | Requires event-stream capture |
| **EGO/Spark charging** (LBK 4.43×) | Architecturally blocked | Requires event-stream capture |
| **Multi-hit eff_count_value > 1** | Not validated | Does dev_msg emit one SkillEff line per hit or per skill use? |
| **`eff_value_stat_source_target` non-NONE cases** | Unknown | Possible stat-sourced scaling path (% of specific unit stat) |
| **add_r_spark_circen_02** caster | Unresolved | 2+ chars fire in same frame → frame_char_hint=None |
| **PvP applicability of `dmg_revise_rate=0.36`** | Unknown | Might apply to PvP only |

---

## 15. Key Empirical Constants

| Constant | Value | Source | Status |
|---|---|---|---|
| DR formula numerator | 268 | Empirical fit (153 samples, R²=0.989) | Validated |
| DR formula denominator offset | 503 | Empirical fit | Validated |
| Optimizer dummy DEF | 500 | Approximation | Reasonable (DR≈0.267) |
| Crit factor form | `CDmg/100` (not `1 + CDmg/100`) | Track B3 | Validated |
| Weak gate | `card.outline AND monster.weak` | Empirical | Validated |
| `dmg_revise_rate` (documented 0.36) | NOT USED in PvE | Falsified Track B H1 | Falsified |
| `dmg_decrease_rate_0_value` (documented -160) | NOT USED | Falsified Track B B2 | Falsified |

---

*Cross-references:*
- *Full damage formula derivation: `docs/research/combat_mechanics.md`*
- *Effect type catalog: `docs/research/skill_effects_schema.md`*
- *Stat calibration pipeline: `docs/research/stat_calibration.md`*
- *Monster DEF research: `docs/research/monster_def_refinement.md`*
- *DVA/DR sign investigation: `docs/research/track_b_dr_sign_investigation.md`*
