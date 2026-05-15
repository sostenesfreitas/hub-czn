# Sprint 2f5 Feature 4 — Nia eff_value investigation

**Date**: 2026-05-11
**Question**: why does `best_damage_eff_for("Nia")` return 100.0?

## Nia's cards (starting + epiphany)

- starting: `c_1003_srt1`, `c_1003_srt2`, `c_1003_srt3`, `c_1003_srt4`
- epiphany: `c_1003_uni1`, `c_1003_uni2`, `c_1003_uni3`, `c_1003_uni4`
- ego: `c_1003_eps`

Damage-firing instances inside starting+epiphany:

| card_id | eff_type | eff_value | target |
|---|---|---|---|
| `c_1003_srt1_01` | `SKILL_EFF_DMG` | 100 | TARGET_UNIT_SELECTED |

Everything else (`srt2`, `srt3`, `srt4`, `uni1..uni4`) emits **zero** `SKILL_EFF_DMG`/`SKILL_EFF_DMG_IGNORE_COND`/`SKILL_EFF_DMG_COOP` instances.

Card descriptions confirm the kit shape:

- `c_1003_srt4` — "Decibel. Check the top 3 cards of the Draw Pile. Choose one to activate." (utility / draw control)
- `c_1003_uni1` — "Discard 1 random card(s). The owner of those cards performs 250% Extra Attack to a random enemy." (Extra Attack, fires from another character's stats — not Nia's eff_value)
- `c_1003_uni2` — "Heal 200%, 2 Decibel, 4 Elasticity, Activate even when Discarded" (heal)
- `c_1003_uni3` — "Draw 2. Discard 2. Move discarded card that is effected to top of the Draw Pile." (card flow)

## All Nia damage cards in EffInstanceIndex (any `_1003_` match)

| id | eff_value |
|---|---|
| `c_1003_srt1_01` | 100 |
| `c_1003_eps_01` | 200 |
| `c_1003_eps_lbk_01` | 200 |

Only three damage-firing card instances exist for Nia globally. Two of those three are her EGO (`c_1003_eps` + its LBK variant), which is intentionally excluded from `best_damage_eff_for` because EGO is not part of the standard deck rotation that the optimizer considers for damage scaling.

## Variant data

The `card_variants.json` index reports five epiphany variants for `c_1003_srt4`, `c_1003_uni1`, `c_1003_uni2`, `c_1003_uni3` — but none of these variants is a damage card. They are all utility variants (different decibel/heal/draw tuning). No `_rsp1` / `_lbk` damage-bearing variants exist for Nia's starting/epiphany cards.

## Conclusion

**(a) Nia is genuinely a 100%-scaling character.** All her non-EGO damage cards have `eff_value = 100`. The rest of her kit is utility (heal, decibel, draw control) and Extra Attack triggered on *another* character's discarded card (so that 250% scales off the discarded card's owner, not Nia).

`best_damage_eff_for("Nia") = 100.0` is **correct behavior** and matches the design intent of the character. No code change required.

The optimizer's avg-damage column should rank Nia low for raw damage scaling — which reflects her actual role as a support / decibel-engine. If users want to surface her utility value, that is a separate UI feature (e.g., heal-power or draw-power scaling), not a `best_damage_eff_for` fix.
