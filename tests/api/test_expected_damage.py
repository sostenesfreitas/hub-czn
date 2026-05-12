"""Pure-math expected-damage helpers used by the optimizer."""
import math

import pytest

from api.optimizer.expected_damage import (
    DUMMY_DEF,
    default_damage_reduction,
    expected_crit_factor,
    expected_damage,
)


def test_expected_crit_factor_at_zero_cri_returns_1():
    assert expected_crit_factor(0.0, 200.0) == pytest.approx(1.0)


def test_expected_crit_factor_at_100_cri_returns_cdmg_over_100():
    assert expected_crit_factor(100.0, 200.0) == pytest.approx(2.0)


def test_expected_crit_factor_50_200_is_1_5():
    assert expected_crit_factor(50.0, 200.0) == pytest.approx(1.5)


def test_expected_crit_factor_30_180_is_1_24():
    assert expected_crit_factor(30.0, 180.0) == pytest.approx(1.24)


def test_dummy_def_is_500():
    assert DUMMY_DEF == 500


def test_default_damage_reduction_at_dummy_def_500():
    assert default_damage_reduction() == pytest.approx(268.0 / 1003.0, abs=1e-6)


def test_default_damage_reduction_accepts_override():
    assert default_damage_reduction(dummy_def=1000) == pytest.approx(268.0 / 1503.0, abs=1e-6)


def test_expected_damage_known_inputs():
    result = expected_damage(atk=10000.0, cri=50.0, cri_dmg_rate=200.0)
    expected = 10000.0 * 1.0 * (1.0 - 268.0 / 1003.0) * 1.5
    assert result == pytest.approx(expected, abs=1e-3)


def test_expected_damage_eff_scales_linearly():
    base = expected_damage(atk=10000.0, cri=50.0, cri_dmg_rate=200.0, eff_pct=100.0)
    double = expected_damage(atk=10000.0, cri=50.0, cri_dmg_rate=200.0, eff_pct=200.0)
    assert double == pytest.approx(2.0 * base, abs=1e-6)


def test_expected_damage_atk_scales_linearly():
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    triple = expected_damage(atk=3000.0, cri=50.0, cri_dmg_rate=200.0)
    assert triple == pytest.approx(3.0 * base, abs=1e-6)


def test_expected_damage_non_negative_at_zero_atk():
    assert expected_damage(atk=0.0, cri=0.0, cri_dmg_rate=125.0) == pytest.approx(0.0)


def test_expected_damage_weak_mult_default_is_identity():
    """Sprint 2f4: weak_mult parameter defaults to 1.0 — pre-2f4 behavior."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    with_wm = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, weak_mult=1.0)
    assert base == with_wm


def test_expected_damage_weak_mult_2_doubles_result():
    """Sprint 2f4: weak_mult=2.0 doubles the result."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    doubled = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, weak_mult=2.0)
    assert doubled == pytest.approx(2.0 * base)


def test_expected_damage_weak_mult_scales_linearly():
    """Sprint 2f4: weak_mult is the last multiplicative factor."""
    for wm in (0.5, 1.0, 1.5, 2.0):
        base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
        scaled = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, weak_mult=wm)
        assert scaled == pytest.approx(base * wm)


def test_expected_damage_extra_dmg_pct_default_is_no_op():
    """Sprint 2h2: extra_dmg_pct parameter defaults to 0.0 — pre-2h2 behavior."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    with_zero = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, extra_dmg_pct=0.0)
    assert base == with_zero


def test_expected_damage_extra_dmg_pct_50_increases_result_by_1_5x():
    """Sprint 2h2: extra_dmg_pct=50 multiplies result by 1.5."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    boosted = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, extra_dmg_pct=50.0)
    assert boosted == pytest.approx(1.5 * base)


def test_expected_damage_extra_dmg_pct_100_doubles_result():
    """extra_dmg_pct=100 doubles."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    doubled = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, extra_dmg_pct=100.0)
    assert doubled == pytest.approx(2.0 * base)


def test_expected_damage_extra_dmg_composes_multiplicatively_with_weak():
    """When both extra_dmg_pct and weak_mult set, both apply multiplicatively."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    both = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0,
                           extra_dmg_pct=50.0, weak_mult=2.0)
    assert both == pytest.approx(base * 1.5 * 2.0)


def test_expected_damage_target_count_default_is_1():
    """Sprint 2h3: target_count parameter defaults to 1 — pre-2h3 behavior."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    with_one = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, target_count=1)
    assert base == with_one


def test_expected_damage_target_count_3_triples_result():
    """Sprint 2h3: target_count=3 multiplies result by 3."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    triple = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0, target_count=3)
    assert triple == pytest.approx(3.0 * base)


def test_expected_damage_target_count_composes_with_extra_dmg_and_weak():
    """When target_count + extra_dmg_pct + weak_mult all set, all apply multiplicatively."""
    base = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0)
    all_three = expected_damage(atk=1000.0, cri=50.0, cri_dmg_rate=200.0,
                                  target_count=2, extra_dmg_pct=50.0, weak_mult=1.5)
    assert all_three == pytest.approx(base * 2.0 * 1.5 * 1.5)


def test_expected_dot_damage_default_ticks_3():
    """Sprint 2h5: expected_dot_damage(atk, dot_pct) computes per-hit DoT.
    Default ticks=3 (game-typical)."""
    from api.optimizer.expected_damage import expected_dot_damage
    # 1000 ATK x 50% DoT x 3 ticks = 1500
    result = expected_dot_damage(atk=1000.0, dot_pct=50.0)
    assert result == pytest.approx(1500.0)


def test_expected_dot_damage_zero_dot_pct_returns_zero():
    """Chars without DoT% sources return 0 - no contribution to AvgDMG."""
    from api.optimizer.expected_damage import expected_dot_damage
    result = expected_dot_damage(atk=1000.0, dot_pct=0.0)
    assert result == 0.0


def test_expected_dot_damage_scales_with_target_count():
    """DoT applies to all targets (AoE DoT cards)."""
    from api.optimizer.expected_damage import expected_dot_damage
    single = expected_dot_damage(atk=1000.0, dot_pct=50.0, target_count=1)
    triple = expected_dot_damage(atk=1000.0, dot_pct=50.0, target_count=3)
    assert triple == pytest.approx(3.0 * single)


def test_expected_dot_damage_scales_with_extra_dmg():
    """Extra DMG% modifier applies to DoT too."""
    from api.optimizer.expected_damage import expected_dot_damage
    base = expected_dot_damage(atk=1000.0, dot_pct=50.0)
    with_extra = expected_dot_damage(atk=1000.0, dot_pct=50.0, extra_dmg_pct=100.0)
    assert with_extra == pytest.approx(2.0 * base)


def test_expected_dot_damage_custom_ticks():
    """User-tunable ticks parameter (default 3) overrides."""
    from api.optimizer.expected_damage import expected_dot_damage
    three_ticks = expected_dot_damage(atk=1000.0, dot_pct=50.0, ticks=3)
    five_ticks = expected_dot_damage(atk=1000.0, dot_pct=50.0, ticks=5)
    assert five_ticks == pytest.approx(5.0 / 3.0 * three_ticks)
