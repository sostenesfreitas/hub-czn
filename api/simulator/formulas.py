"""FORMULA_REGISTRY: name -> callable(instance, caster, targets, state) -> EffectResult."""
from typing import Callable

from api.simulator.result import EffectResult


def _def_reduce(monster_def: int) -> float:
    """Empirical fit from Track B: 268 / (DEF + 503), R^2 = 0.989."""
    return 268.0 / (monster_def + 503.0)


def _crit_factor(caster, state) -> float:
    """CDmg/100 when crit fires, else 1.0. Uses caster's cri% against rng."""
    is_crit = state.rng.random() * 100.0 < caster.cri
    return (caster.cri_dmg_rate / 100.0) if is_crit else 1.0


def _formula_base_damage(inst, caster, targets, state) -> EffectResult:
    """Validated Track B formula:
       dmg = ATK * (eff_value/100) * (1 - dmg_decrease_rate) * crit_factor
    """
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    target = targets[0]
    dr = target.dmg_decrease_rate if target.dmg_decrease_rate > 0 else _def_reduce(target.def_)
    cf = _crit_factor(caster, state)
    raw = caster.atk * (inst.eff_value / 100.0) * (1.0 - dr) * cf
    dealt = target.apply_damage(raw)
    return EffectResult(damage=dealt, target_id=target.id)


def _formula_add_cs(inst, caster, targets, state) -> EffectResult:
    """SKILL_EFF_CS_SET_ADD: cs_id is in link_cs_id; eff_count_value is stack qty."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    target = targets[0]
    # cs_id from link_cs_id (list); fallback to eff_value if it's a cs_* string
    cs_ids = inst.link_cs_id or []
    if not cs_ids:
        # legacy fallback: some entries put cs_id directly in eff_value
        raw_eff = inst.raw.get("eff_value", "")
        if isinstance(raw_eff, str) and raw_eff.startswith("cs_"):
            cs_ids = [raw_eff]
    if not cs_ids:
        return EffectResult(skipped=True, skip_reason="no cs_id in instance")
    qty = inst.eff_count_value or 1
    cs_added = {}
    for cs_id in cs_ids:
        state.add_cs(target.id, cs_id, qty)
        cs_added[cs_id] = qty
    return EffectResult(cs_added=cs_added, target_id=target.id)


def _formula_remove_cs(inst, caster, targets, state) -> EffectResult:
    """SKILL_EFF_CURE: removes condition stacks from target. cs_id from link_cs_id."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    target = targets[0]
    cs_ids = inst.link_cs_id or []
    if not cs_ids:
        return EffectResult(skipped=True, skip_reason="no cs_id in instance")
    qty = inst.eff_count_value or 1
    cs_changes = {}
    for cs_id in cs_ids:
        removed = state.remove_cs(target.id, cs_id, qty)
        cs_changes[cs_id] = -removed
    return EffectResult(cs_added=cs_changes, target_id=target.id)


def _formula_shield(inst, caster, targets, state) -> EffectResult:
    """SKILL_EFF_SHIELD: eff_value is % of caster ATK granted as shield."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    amount = int(caster.atk * (inst.eff_value / 100.0))
    target = targets[0]
    target.shield = (target.shield or 0) + amount
    return EffectResult(shield_added=amount, target_id=target.id)


def _formula_heal(inst, caster, targets, state) -> EffectResult:
    """SKILL_EFF_HEAL: eff_value is % of caster ATK restored to target HP."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    amount = int(caster.atk * (inst.eff_value / 100.0))
    target = targets[0]
    target.hp_current = min(target.hp, target.hp_current + amount)
    return EffectResult(target_id=target.id)


def _formula_draw(inst, caster, targets, state) -> EffectResult:
    """SKILL_EFF_CARD_DRAW: move N cards from deck to hand."""
    count = inst.eff_value or 1
    moved = []
    for _ in range(count):
        if not state.deck:
            break
        card = state.deck.pop(0)
        state.hand.append(card)
        moved.append(card.card_id)
    return EffectResult(cards_moved=moved)


def _formula_discard(inst, caster, targets, state) -> EffectResult:
    """SKILL_EFF_CARD_DISCARD: move N cards from hand to discard pile."""
    count = inst.eff_value or 1
    moved = []
    for _ in range(count):
        if not state.hand:
            break
        card = state.hand.pop(0)
        state.discard.append(card)
        moved.append(card.card_id)
    return EffectResult(cards_moved=moved)


def _formula_move_card(inst, caster, targets, state) -> EffectResult:
    """SKILL_EFF_CARD_MOVE_TO: move N cards from source pile to dest.
       MVP: treat all moves as hand->discard (most common observed shape).
    """
    return _formula_discard(inst, caster, targets, state)


def _formula_noop(inst, caster, targets, state) -> EffectResult:
    """Effects with no damage-relevant side effect in the MVP."""
    return EffectResult(skipped=True, skip_reason=f"noop ({inst.eff_type})")


FORMULA_REGISTRY: dict[str, Callable] = {
    "F_BASE_DMG": _formula_base_damage,
    "F_ADD_CS": _formula_add_cs,
    "F_REMOVE_CS": _formula_remove_cs,
    "F_CURE": _formula_remove_cs,  # CURE removes cs (the cs_id of the negative status)
    "F_SHIELD": _formula_shield,
    "F_HEAL": _formula_heal,
    "F_DRAW": _formula_draw,
    "F_DISCARD": _formula_discard,
    "F_MOVE_CARD": _formula_move_card,
    "F_NOOP": _formula_noop,
}
