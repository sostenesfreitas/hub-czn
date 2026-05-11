# F_BASE_DMG Scale Investigation

Empirical diagnosis of why predicted damages overshoot observed.
For each outlier, four hypotheses are computed and compared to
the variant description's expected eff_pct (deck_builder ground truth).

Atk used: 1100 (placeholder; matches mid-game level 60 char average).

| seq | char | skill_eff_id | inst eff_value | inst count | desc pct | sim (current) | H1 ×count | H3 /1000 | obs |
|---|---|---|---|---|---|---|---|---|---|
| 11 | Heidemarie | `c_30093_uni4_lbk_mut1_01` | 700 | 1 | ? | 12227 | 5390 | 539 | 30 |
| 4 | ? | `cs06_0157_03` | 200 | 1 | ? | 3494 | 1540 | 154 | 30 |
| 4 | ? | `cs06_0157_04` | 200 | 1 | ? | 3494 | 1540 | 154 | 30 |
| 4 | ? | `cs06_0157_05` | 200 | 1 | ? | 3494 | 1540 | 154 | 30 |
| 10 | ? | `cs06_0157_03` | 200 | 1 | ? | 3494 | 1540 | 154 | 30 |
| 10 | ? | `cs06_0157_04` | 200 | 1 | ? | 3494 | 1540 | 154 | 30 |
| 3 | Heidemarie | `c_30093_cre1_mut1_02` | 120 | 1 | ? | 2096 | 923 | 92 | 30 |
| 3 | Heidemarie | `c_30093_cre1_mut1_02` | 120 | 1 | ? | 2096 | 923 | 92 | 30 |
| 4 | Heidemarie | `c_30093_cre1_mut1_02` | 120 | 1 | ? | 2096 | 923 | 92 | 30 |
| 8 | Heidemarie | `c_30093_cre1_mut1_02` | 120 | 1 | ? | 2096 | 923 | 92 | 30 |
| 10 | ? | `cs06_0157_05` | 200 | 1 | ? | 1792 | 1540 | 154 | 30 |
| 8 | Heidemarie | `c_30093_uni2_rsp3_01` | 100 | 1 | 180 | 1747 | 770 | 77 | 30 |
| 2 | Diana | `c_1061_uni2_rsp4_01` | 180 | 1 | 180 | 1612 | 1386 | 138 | 30 |
| 4 | Heidemarie | `c_30093_srt4_rsp1_01` | 80 | 2 | 80 | 1397 | 1232 | 61 | 30 |
| 4 | Heidemarie | `c_30093_cre1_mut1_02` | 120 | 1 | ? | 1075 | 923 | 92 | 30 |
| 8 | Heidemarie | `c_30093_cre1_mut1_02` | 120 | 1 | ? | 1075 | 923 | 92 | 30 |
| 12 | ? | `rr_lux_01_01_01` | 50 | 1 | ? | 873 | 385 | 38 | 30 |
| 3 | Heidemarie | `c_30093_srt4_rsp1_01` | 80 | 2 | 80 | 717 | 1232 | 61 | 30 |
| 8 | Heidemarie | `c_30093_srt4_rsp1_01` | 80 | 2 | 80 | 717 | 1232 | 61 | 30 |
| 5 | ? | `rr_lux_01_01_01` | 50 | 1 | ? | 448 | 385 | 38 | 30 |
| 3 | ? | `30094_c1_lv5_01_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |
| 3 | ? | `cs01_1084_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |
| 3 | ? | `cs06_0157_01` | 4 | 1 | ? | 0 | 30 | 3 | 30 |
| 3 | ? | `30094_c1_lv5_01_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |
| 3 | ? | `eq_pub_032_01_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |
| 3 | ? | `cs01_1084_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |
| 3 | ? | `cs06_0157_01` | 4 | 1 | ? | 0 | 30 | 3 | 30 |
| 3 | ? | `30094_c1_lv5_01_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |
| 3 | ? | `eq_pub_032_01_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |
| 3 | ? | `cs01_1084_01` | 1 | 1 | ? | 0 | 7 | 0 | 30 |

## Verdict criteria

- If `inst eff_value` ≈ `desc pct` → scale is /100 and current code is correct (H2). Overshoot comes from elsewhere (count? double-mult?).
- If `inst eff_value` ≈ `desc pct × count` → eff_value is pre-multiplied by count. Sim should divide.
- If `inst eff_value` ≈ `desc pct × 10` → scale is /1000 (H3).
- If all hypotheses miss → ATK or DR is wrong, not eff_value.

## Analysis (implementer notes)

Four rows have parseable `desc pct`. Ratio analysis:

| skill_eff_id | eff_value | count | desc_pct | ratio_1 (eff/pct) | ratio_2 (eff/pct/count) | ratio_3 (eff/pct/10) |
|---|---|---|---|---|---|---|
| `c_1061_uni2_rsp4_01` | 180 | 1 | 180 | **1.000** | 1.000 | 0.100 |
| `c_30093_srt4_rsp1_01` | 80 | 2 | 80 | **1.000** | 0.500 | 0.100 |
| `c_30093_uni2_rsp3_01` | 100 | 1 | 180 | 0.556 | 0.556 | 0.056 |

Notes:
- `c_1061_uni2_rsp4_01` (Diana's uni2 resonance-4 variant): eff_value=180 = desc_pct=180. ratio_1 = 1.0.
  This variant is a resonance-boosted form of the 180% card; the eff_value **exactly matches** the percentage.
- `c_30093_srt4_rsp1_01` (Heidemarie's srt4 resonance-1 variant): eff_value=80 = desc_pct=80, count=2.
  The card description reads "80% Damage × 2"; eff_value is the **per-hit** value (80), not pre-multiplied.
  ratio_1 = 1.0, ratio_2 = 0.5 → eff_value is NOT pre-multiplied by count. H1 does not apply.
- `c_30093_uni2_rsp3_01`: eff_value=100 vs desc_pct=180 (0.556). This is a resonance-3 variant of
  the 180% card; at resonance-3 the hit multiplier may differ. Not a clean anchor row.

**Root cause of reported outliers**: `obs=30` for every row is a false ground-truth.
Inspecting the websocket capture shows all `lastDamageEvent` entries have `type: [DMG_ATTR_AUTO, DMG_ATTR_FIX]`
and `is_auto: true` — this is a fixed-damage auto-attack (30 HP), completely unrelated to the skill card
being evaluated. The harness reads `lastDamageEvent.damage` from the next snapshot, which reflects whatever
hit the monster last (the auto-attack), not the skill card's damage.
The sim values (1612, 1747, 1397, etc.) are **plausible** for mid-game ATK × eff_value/100; the "overshoot"
is an artefact of comparing to auto-attack damage, not skill damage.

Additionally, the harness falls back to `player_team[0]` (Heidemarie, atk=1410) when caster_id is not found
in the player_team (e.g., Diana fires from id=2 but if the caster_id is unmapped it uses id=1). This inflates
some sim values relative to the true caster's ATK, but does not affect the eff_value scale conclusion.

## Verdict

Verdict: ambiguous — no single hypothesis fits the data, because the observed damage (`obs=30`) is spurious.

All `lastDamageEvent` entries in this capture are `DMG_ATTR_FIX` auto-attacks (30 HP), not skill card damage.
The ground truth comparison is invalid. **The eff_value scale is /100 (H2 / current formula is correct)**:
two clean anchor rows (`c_1061_uni2_rsp4_01` ratio=1.000, `c_30093_srt4_rsp1_01` ratio=1.000) confirm
eff_value equals the deck_builder description percentage, and eff_value is per-hit (not pre-multiplied by count).

**Action required**: fix the replay harness's observed-damage extraction to read skill-card damage, not
`lastDamageEvent` (which can be a stale auto-attack). A reliable source would be comparing HP deltas between
consecutive snapshots for the target monster, filtered to frames immediately following the skill fire event.
