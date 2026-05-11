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


def _find_firing_card(inst_id: str, state):
    """Locate the CardState whose skill_eff_ids contains inst_id.
    Walks hand → deck → discard. Returns None if not found
    (e.g., card was exhausted or never present in synthetic state).
    """
    for card in state.hand + state.deck + state.discard:
        if inst_id in card.skill_eff_ids:
            return card
    return None


def _formula_base_damage(inst, caster, targets, state) -> EffectResult:
    """Validated Track B formula + Sprint 2c weak_mult + Sprint 2d dva observation:
       dmg = ATK * (eff_value/100) * (1 - dmg_decrease_rate) * crit_factor * weak_mult

       dva_stacks_observed: dict of cs_id -> count for stacks referenced by
       inst.link_cs_id that are currently present on the target.  Sprint 2d
       OBSERVATION ONLY — does not affect damage calculation.  Sprint 2e
       wires the actual multiplier.
    """
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    target = targets[0]
    dr = target.dmg_decrease_rate if target.dmg_decrease_rate > 0 else _def_reduce(target.def_)
    cf = _crit_factor(caster, state)
    firing_card = _find_firing_card(inst.id, state)
    outline = firing_card.outline if firing_card is not None else False
    weak_mult = (caster.weak_ego_dmg_rate / 100.0
                 if (outline and getattr(target, "weak", False))
                 else 1.0)
    raw = caster.atk * (inst.eff_value / 100.0) * (1.0 - dr) * cf * weak_mult
    dealt = target.apply_damage(raw)

    # Sprint 2d: observe (don't apply) dva_css stack counts on target
    dva_stacks_observed: dict[str, int] = {}
    if inst.link_cs_id:
        dva_stacks = getattr(state, "dva_stacks", None)
        if dva_stacks is not None:
            target_stacks = dva_stacks.get(str(target.id), {})
            dva_stacks_observed = {
                cs_id: int(target_stacks.get(cs_id, 0)) for cs_id in inst.link_cs_id
            }

    return EffectResult(
        damage=dealt,
        target_id=target.id,
        dva_stacks_observed=dva_stacks_observed,
    )


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


def _formula_add_cs_random(inst, caster, targets, state) -> EffectResult:
    """Pick ONE cs_id at random from link_cs_id, add stacks."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    cs_ids = inst.link_cs_id or []
    if not cs_ids:
        return EffectResult(skipped=True, skip_reason="no cs_id list")
    target = targets[0]
    chosen = state.rng.choice(cs_ids)
    qty = inst.eff_count_value or 1
    state.add_cs(target.id, chosen, qty)
    return EffectResult(cs_added={chosen: qty}, target_id=target.id)


def _formula_add_card(inst, caster, targets, state) -> EffectResult:
    """Generate eff_value-count new card(s) into hand. MVP uses a synthetic card_id."""
    from api.simulator.state import CardState
    count = inst.eff_value or 1
    moved = []
    for i in range(count):
        new = CardState(card_id=f"_generated_{inst.id}_{i}", cost=0)
        state.hand.append(new)
        moved.append(new.card_id)
    return EffectResult(cards_moved=moved)


def _formula_kill(inst, caster, targets, state) -> EffectResult:
    """Set target hp_current to 0."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    target = targets[0]
    if hasattr(target, "hp_current"):
        target.hp_current = 0
    return EffectResult(target_id=getattr(target, "id", None))


def _formula_max_hp_modify(inst, caster, targets, state) -> EffectResult:
    """Adjust target's max HP by eff_value % of current max (positive or negative)."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    target = targets[0]
    if hasattr(target, "hp"):
        delta = int(target.hp * (inst.eff_value / 100.0))
        target.hp += delta
        # do NOT auto-refill current HP; that's a separate engine concern
    return EffectResult(target_id=getattr(target, "id", None))


def _formula_energy_change(inst, caster, targets, state) -> EffectResult:
    """Adjust state.morale by eff_value. MATHSIGN handling deferred to runtime."""
    state.morale = max(0, state.morale + inst.eff_value)
    return EffectResult()


def _formula_stress_add(inst, caster, targets, state) -> EffectResult:
    """Accumulate stress on target via synthetic '__stress__' cs key."""
    if not targets:
        return EffectResult(skipped=True, skip_reason="no target")
    target = targets[0]
    state.add_cs(target.id, "__stress__", inst.eff_value)
    return EffectResult(cs_added={"__stress__": inst.eff_value}, target_id=target.id)


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
    # damage variants
    "F_DMG_COOP": _formula_base_damage,
    # cs management
    "F_ADD_CS_FORCE": _formula_add_cs,
    "F_ADD_CS_RANDOM": _formula_add_cs_random,
    "F_SET_CS": _formula_add_cs,
    # card management
    "F_ADD_CARD": _formula_add_card,
    # meta
    "F_KILL": _formula_kill,
    "F_MAX_HP_MODIFY": _formula_max_hp_modify,
    "F_ENERGY_CHANGE": _formula_energy_change,
    "F_TACTIC_GAUGE_ADD": _formula_energy_change,  # MVP: conflate gauges
    # status
    "F_STRESS_ADD": _formula_stress_add,
    "F_STRESS_ADD_NONE_COLLAPSE": _formula_stress_add,
}

# Honest stubs — semantics not modellable in MVP, runtime acknowledges effect
_STUB_REFS = [
    "F_DAMAGE_VALUE_ADD",      # passive damage mod, consumed-before-snapshot
    "F_SHIELD_VALUE_ADD",      # passive shield mod
    "F_SHIELD_CHANGE",         # shield strip, 2 instances total
    "F_CURE_VALUE_ADD",        # passive cure mod
    "F_COUNT_VALUE_ADD",       # passive hit count mod
    "F_CRIT_PCT_ADD",          # passive crit% mod
    "F_TARGET_CS_VALUE_ADD",   # dva_css mechanism, architecturally hidden
    "F_CARD_CHANGE",           # card identity swap (Camille mutation)
    "F_CARD_COST_CHANGE",      # AP cost modifier
    "F_CARD_TALENT_MODIFY",    # talent add/remove
    "F_MONSTER_TURN_COUNT",    # monster turn budget
    "F_TRIGGER_INSPIRATION",   # inspiration trigger
    "F_UNKNOWN_META",          # catch-all
]
for _ref in _STUB_REFS:
    FORMULA_REGISTRY[_ref] = _formula_noop
