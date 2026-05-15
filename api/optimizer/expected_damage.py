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
    extra_dmg_pct: float = 0.0,
    target_count: int = 1,
) -> float:
    """Expected per-hit damage against a default target.

    Formula: atk * (eff_pct/100) * (1-DR) * cf_ev * weak_mult * (1+extra_dmg_pct/100) * target_count

    Sprint 2h3: added target_count parameter for AoE / multi-target modeling.
    Default 1 preserves single-target behavior. User picks the average
    number of enemies their team typically fights.
    """
    cf_ev = expected_crit_factor(cri, cri_dmg_rate)
    dr = default_damage_reduction(dummy_def)
    extra_mult = 1.0 + extra_dmg_pct / 100.0
    return atk * (eff_pct / 100.0) * (1.0 - dr) * cf_ev * weak_mult * extra_mult * target_count


def expected_dot_damage(
    atk: float,
    dot_pct: float,
    ticks: int = 3,
    target_count: int = 1,
    extra_dmg_pct: float = 0.0,
) -> float:
    """Expected DoT damage contribution to AvgDMG.

    Sprint 2h5: DoT (damage over time) is a separate damage source from
    the per-hit `expected_damage`. AvgDMG = expected_damage + expected_dot_damage.

    Formula: ATK * (dot_pct/100) * ticks * target_count * (1 + extra_dmg_pct/100)

    Skips cf_ev (DoT doesn't crit), weak_mult (game convention), and
    dummy_def (DoT typically bypasses DEF). Default ticks=3 (game-typical).

    Returns 0.0 when dot_pct is 0.
    """
    if dot_pct <= 0.0:
        return 0.0
    extra_mult = 1.0 + extra_dmg_pct / 100.0
    return atk * (dot_pct / 100.0) * ticks * target_count * extra_mult
