"""Pure-math expected-damage helpers used by the gear optimizer.

These functions consume scalar stats and return deterministic damage
estimates. Track B's empirical formula informs the shape:

    dmg = ATK * (eff/100) * (1 - DR) * cf

where the optimizer uses statistical expectation for cf (since it
enumerates millions of build combinations and cannot afford per-roll
RNG) and a fixed DUMMY_DEF for DR (since the optimizer has no target
monster context at evaluation time).

The simulator runtime (api/simulator/formulas.py) remains the source of
truth for combat behavior; this module borrows the math, not the runtime.
"""

DUMMY_DEF = 500  # mid-game enemy DEF; gives DR ~ 0.267
DEF_REDUCE_NUM = 268.0  # Track B fit numerator
DEF_REDUCE_DEN_C = 503.0  # Track B fit denominator constant


def expected_crit_factor(cri: float, cri_dmg_rate: float) -> float:
    """Statistical expectation of the per-hit crit factor.

    cri: crit rate as a percentage (e.g., 30.0 for 30%)
    cri_dmg_rate: crit damage as a percentage (e.g., 200.0 for 200%)

    A non-crit hit deals 1.0x base damage; a crit deals (cri_dmg_rate/100)x.
    Expected value: 1 + p * (cdmg - 1) where p = cri/100, cdmg = cri_dmg_rate/100.
    """
    p = cri / 100.0
    cdmg = cri_dmg_rate / 100.0
    return 1.0 + p * (cdmg - 1.0)


def default_damage_reduction(dummy_def: int = DUMMY_DEF) -> float:
    """Damage reduction against a default-DEF target.

    268 / (def + 503) — Track B empirical fit (R^2 = 0.989).
    """
    return DEF_REDUCE_NUM / (dummy_def + DEF_REDUCE_DEN_C)


def expected_damage(
    atk: float,
    cri: float,
    cri_dmg_rate: float,
    eff_pct: float = 100.0,
    dummy_def: int = DUMMY_DEF,
    weak_mult: float = 1.0,
) -> float:
    """Expected per-hit damage against a default target.

    Formula: atk * (eff_pct / 100) * (1 - DR) * cf_ev * weak_mult

    Sprint 2f4: added weak_mult parameter. Default 1.0 preserves pre-2f4
    behavior. Optimizer passes caster.weak_ego_dmg_rate / 100 when user
    toggles 'treat target as weak'.
    """
    cf_ev = expected_crit_factor(cri, cri_dmg_rate)
    dr = default_damage_reduction(dummy_def)
    return atk * (eff_pct / 100.0) * (1.0 - dr) * cf_ev * weak_mult
