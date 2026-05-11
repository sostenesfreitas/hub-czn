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


FORMULA_REGISTRY: dict[str, Callable] = {
    "F_BASE_DMG": _formula_base_damage,
}
