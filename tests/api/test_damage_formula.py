"""Unit tests for damage pair extraction and curve fitting."""
import json
from pathlib import Path
import tempfile
from api.capture.extract_damage_pairs import extract_def_pairs


def test_extract_def_pairs_from_battle_summary():
    """Each battle file with enemy_def + enemy_dmg_decrease yields one (DEF, dmg_decrease) tuple."""
    fake_battle = {
        "enemy_def": 319,
        "enemy_atk": 2628,
        "enemy_dmg_decrease": 0.3262,
        "battle_result": "FAIL",
        "player_chars": [],
    }
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "battle_test.json"
        p.write_text(json.dumps(fake_battle), encoding="utf-8")
        pairs = extract_def_pairs(Path(td))
    assert pairs == [(319, 0.3262)]


def test_extract_def_pairs_skips_invalid():
    fake_battle = {"battle_result": "FAIL"}  # missing fields
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "battle_test.json"
        p.write_text(json.dumps(fake_battle), encoding="utf-8")
        pairs = extract_def_pairs(Path(td))
    assert pairs == []


import math
import pytest
from api.capture.fit_def_curve import fit_def_curve, CANDIDATE_FORMS


def test_fit_def_curve_returns_best_form_with_r_squared():
    """With synthetic data following f3, fit must select f3 with R² > 0.99."""
    pairs = [(d, max(0.0, (d - 160) / (d + 300))) for d in range(50, 1001, 50)]
    result = fit_def_curve(pairs)
    assert result["best_form"] == "f3"
    assert result["r_squared"] > 0.99


def test_fit_def_curve_empty_input_raises():
    with pytest.raises(ValueError):
        fit_def_curve([])


from api.capture.validate_damage import (
    predict_damage_h1,
    predict_damage_empirical,
    predict_damage_empirical_with_dva,
    predict_damage_emp_cf_plus1,
    predict_damage_emp_cf_direct,
    predict_damage_emp_full,
    _resolve_dva_multiplier,
    validate_against_hits,
)


def test_predict_damage_h1_basic():
    """H1: dmg = ATK × 0.36 × (1 - def_reduce) × crit_factor × skill_mult."""
    predicted = predict_damage_h1(
        atk=1000, def_reduce=0.3, crit_factor=1.0, skill_mult=1.0
    )
    assert predicted == pytest.approx(252.0, rel=1e-3)


def test_validate_against_hits_returns_coverage_metrics():
    fake_hits = [
        {"atk": 1000, "def_reduce": 0.3, "crit_factor": 1.0, "skill_mult": 1.0, "observed_dmg": 252.0},
        {"atk": 1000, "def_reduce": 0.3, "crit_factor": 1.0, "skill_mult": 1.0, "observed_dmg": 500.0},
    ]
    result = validate_against_hits(fake_hits, hypothesis="H1", tolerance=0.05)
    assert result["coverage"] == 0.5
    assert result["n_hits"] == 2
    assert result["n_within_tolerance"] == 1


def test_predict_damage_empirical_matches_b3_verified_hit():
    """Hit verified in B3 doc: ATK=1087, eff_value=75, def_reduce=0.334, no crit
    -> predicted dmg = 1087 x 0.75 x 0.666 = 543 vs observed 547 (0.7% error)."""
    predicted = predict_damage_empirical(atk=1087, eff_value=75, def_reduce=0.334, crit_factor=1.0)
    assert predicted == pytest.approx(543.0, rel=0.01)


# ---------------------------------------------------------------------------
# _resolve_dva_multiplier tests (B4)
# ---------------------------------------------------------------------------

def test_resolve_dva_multiplier_empty_returns_one():
    """Empty dva_css list returns 1.0 (neutral multiplier)."""
    assert _resolve_dva_multiplier([], {}, {}) == 1.0


def test_resolve_dva_multiplier_missing_cs_ids_returns_one():
    """cs_ids not in csMap return 1.0 — this is the normal case in captures."""
    dva = [110, 111, 112]
    cs_map = {}   # empty — cs_ids are consumed before snapshot
    sk_map = {}
    assert _resolve_dva_multiplier(dva, cs_map, sk_map) == 1.0


def test_resolve_dva_multiplier_additive_single_entry():
    """When one cs entry resolves with eff_value=50, dva_mult = 1 + 50/100 = 1.5."""
    cs_map = {
        "10": {"skillEffs": [42]},
    }
    sk_map = {
        "42": {"eff_value": 50},
    }
    result = _resolve_dva_multiplier([10], cs_map, sk_map)
    assert result == pytest.approx(1.5)


def test_resolve_dva_multiplier_additive_multiple_entries():
    """With two cs entries (ev=30, ev=20), dva_mult = 1 + (30+20)/100 = 1.5."""
    cs_map = {
        "1": {"skillEffs": [10]},
        "2": {"skillEffs": [11]},
    }
    sk_map = {
        "10": {"eff_value": 30},
        "11": {"eff_value": 20},
    }
    result = _resolve_dva_multiplier([1, 2], cs_map, sk_map)
    assert result == pytest.approx(1.5)


def test_resolve_dva_multiplier_zero_eff_value_skipped():
    """eff_value=0 entries are skipped; if nothing non-zero is found, returns 1.0."""
    cs_map = {"5": {"skillEffs": [99]}}
    sk_map = {"99": {"eff_value": 0}}
    assert _resolve_dva_multiplier([5], cs_map, sk_map) == 1.0


def test_predict_damage_empirical_with_dva_neutral_equals_emp():
    """dva_mult=1.0 must produce the same result as predict_damage_empirical."""
    atk, ev, dr, cf = 1087.0, 75.0, 0.334, 1.0
    emp = predict_damage_empirical(atk=atk, eff_value=ev, def_reduce=dr, crit_factor=cf)
    dva = predict_damage_empirical_with_dva(atk=atk, eff_value=ev, def_reduce=dr, crit_factor=cf, dva_mult=1.0)
    assert emp == pytest.approx(dva)


def test_predict_damage_empirical_with_dva_scales_correctly():
    """dva_mult=1.5 must scale the base EMP prediction by 1.5."""
    atk, ev, dr, cf = 1000.0, 80.0, 0.3, 1.0
    base = predict_damage_empirical(atk=atk, eff_value=ev, def_reduce=dr, crit_factor=cf)
    scaled = predict_damage_empirical_with_dva(atk=atk, eff_value=ev, def_reduce=dr, crit_factor=cf, dva_mult=1.5)
    assert scaled == pytest.approx(base * 1.5)


def test_predict_damage_empirical_with_dva_skips_zero_eff_value():
    """eff_value=0.0 must raise TypeError regardless of dva_mult."""
    with pytest.raises(TypeError):
        predict_damage_empirical_with_dva(atk=1000, eff_value=0.0, def_reduce=0.3, crit_factor=1.0, dva_mult=1.5)


# ---------------------------------------------------------------------------
# EMP_CF_PLUS1 / EMP_CF_DIRECT tests (crit_factor formula candidates)
# ---------------------------------------------------------------------------

def test_emp_cf_plus1_non_crit_equals_emp():
    """For non-crit hits, EMP_CF_PLUS1 must equal EMP (cf=1.0 in both cases)."""
    atk, ev, dr, cdmg = 1087.0, 75.0, 0.334, 237.0
    emp = predict_damage_empirical(atk=atk, eff_value=ev, def_reduce=dr, crit_factor=1.0)
    p1 = predict_damage_emp_cf_plus1(atk=atk, eff_value=ev, def_reduce=dr, cdmg=cdmg, is_crit=False)
    assert emp == pytest.approx(p1)


def test_emp_cf_plus1_crit_uses_one_plus_cdmg_over_100():
    """EMP_CF_PLUS1 crit hit: cf = 1 + CDmg/100 = 3.37 when CDmg=237."""
    # atk=1050, ev=80, dr=0.3597, cdmg=237 → base=1050*0.80*0.6403 = 537.9
    # cf = 1 + 237/100 = 3.37 → 537.9 × 3.37 ≈ 1812.6
    p1 = predict_damage_emp_cf_plus1(
        atk=1050.0, eff_value=80.0, def_reduce=0.3597, cdmg=237.0, is_crit=True
    )
    assert p1 == pytest.approx(1050.0 * 0.80 * (1 - 0.3597) * (1 + 237.0 / 100.0), rel=1e-4)


def test_emp_cf_direct_crit_uses_cdmg_over_100():
    """EMP_CF_DIRECT crit hit: cf = CDmg/100 = 2.37 when CDmg=237."""
    # atk=1050, ev=80, dr=0.3597, cdmg=237 → cf=2.37 → 1050*0.80*0.6403*2.37 ≈ 1275.0
    pd = predict_damage_emp_cf_direct(
        atk=1050.0, eff_value=80.0, def_reduce=0.3597, cdmg=237.0, is_crit=True
    )
    assert pd == pytest.approx(1050.0 * 0.80 * (1 - 0.3597) * (237.0 / 100.0), rel=1e-4)


def test_emp_cf_direct_non_crit_uses_cf_one():
    """EMP_CF_DIRECT non-crit hit: cf = 1.0 regardless of CDmg."""
    pd = predict_damage_emp_cf_direct(
        atk=1050.0, eff_value=80.0, def_reduce=0.3597, cdmg=237.0, is_crit=False
    )
    assert pd == pytest.approx(1050.0 * 0.80 * (1 - 0.3597) * 1.0, rel=1e-4)


def test_emp_cf_direct_skips_zero_eff_value():
    """eff_value=0.0 must raise TypeError for EMP_CF_DIRECT."""
    with pytest.raises(TypeError):
        predict_damage_emp_cf_direct(atk=1000, eff_value=0.0, def_reduce=0.3, cdmg=200.0, is_crit=True)


def test_emp_cf_plus1_skips_zero_eff_value():
    """eff_value=0.0 must raise TypeError for EMP_CF_PLUS1."""
    with pytest.raises(TypeError):
        predict_damage_emp_cf_plus1(atk=1000, eff_value=0.0, def_reduce=0.3, cdmg=200.0, is_crit=True)


def test_emp_cf_direct_observed_c30093_rsp1_non_crit():
    """Verified non-crit hit: c_30093_srt4_rsp1, obs=530, pred≈552 (4.1% err)."""
    # Non-crit — cf=1.0 for both formulas; error is due to unresolved dva_css.
    pred = predict_damage_emp_cf_direct(
        atk=1077.3, eff_value=80.0, def_reduce=0.3597, cdmg=237.0, is_crit=False
    )
    assert abs(pred - 530.0) / 530.0 < 0.05


def test_emp_cf_direct_observed_c1052_rsp2_crit():
    """Verified crit hit: c_1052_srt4_rsp1, obs=193, EMP_CF_DIRECT pred≈186 (-3.7%)."""
    pred = predict_damage_emp_cf_direct(
        atk=774.0, eff_value=30.0, def_reduce=0.3597, cdmg=125.0, is_crit=True
    )
    assert abs(pred - 193.0) / 193.0 < 0.05


def test_validate_against_hits_emp_cf_direct_new_hypotheses():
    """EMP_CF_DIRECT hypothesis key must exist in HYPOTHESES and cover known hits."""
    from api.capture.validate_damage import HYPOTHESES
    assert "EMP_CF_PLUS1" in HYPOTHESES
    assert "EMP_CF_DIRECT" in HYPOTHESES
    assert "EMP_FULL" in HYPOTHESES
    # Synthetic non-crit hit where both formulas agree
    fake_hits = [
        {
            "atk": 1000.0, "eff_value": 80.0, "def_reduce": 0.3,
            "crit_factor": 1.0, "cdmg": 200.0, "is_crit": False,
            "dva_mult": 1.0, "observed_dmg": 560.0,
        },
    ]
    # Non-crit: both CF formulas produce same result as EMP (cf=1.0)
    r_p1 = validate_against_hits(fake_hits, hypothesis="EMP_CF_PLUS1", tolerance=0.05)
    r_dir = validate_against_hits(fake_hits, hypothesis="EMP_CF_DIRECT", tolerance=0.05)
    assert r_p1["n_within_tolerance"] == 1
    assert r_dir["n_within_tolerance"] == 1


# ---------------------------------------------------------------------------
# EMP_FULL tests (weak/EGO multiplier)
# ---------------------------------------------------------------------------

def test_emp_full_non_ego_equals_emp_cf_direct():
    """EMP_FULL with is_ego=False must produce same result as EMP_CF_DIRECT."""
    kwargs = dict(atk=1000.0, eff_value=80.0, def_reduce=0.3, cdmg=200.0,
                  is_crit=True, dva_mult=1.0)
    cf_direct = predict_damage_emp_cf_direct(**kwargs)
    emp_full_no_ego = predict_damage_emp_full(
        **kwargs, is_weak=True, weak_ego_rate=125.0, is_ego=False
    )
    assert emp_full_no_ego == pytest.approx(cf_direct, rel=1e-9)


def test_emp_full_ego_no_weak_equals_emp_cf_direct():
    """EMP_FULL with is_ego=True but is_weak=False must equal EMP_CF_DIRECT."""
    kwargs = dict(atk=1000.0, eff_value=80.0, def_reduce=0.3, cdmg=200.0,
                  is_crit=True, dva_mult=1.0)
    cf_direct = predict_damage_emp_cf_direct(**kwargs)
    emp_full_not_weak = predict_damage_emp_full(
        **kwargs, is_weak=False, weak_ego_rate=125.0, is_ego=True
    )
    assert emp_full_not_weak == pytest.approx(cf_direct, rel=1e-9)


def test_emp_full_ego_and_weak_applies_multiplier():
    """EMP_FULL with is_ego=True and is_weak=True must apply weak_ego_rate/100."""
    kwargs = dict(atk=1000.0, eff_value=80.0, def_reduce=0.3, cdmg=200.0,
                  is_crit=True, dva_mult=1.0)
    cf_direct = predict_damage_emp_cf_direct(**kwargs)
    emp_full = predict_damage_emp_full(
        **kwargs, is_weak=True, weak_ego_rate=125.0, is_ego=True
    )
    # With weak_ego_rate=125, weak_mult=1.25
    assert emp_full == pytest.approx(cf_direct * 1.25, rel=1e-9)


def test_emp_full_skips_zero_eff_value():
    """eff_value=0.0 must raise TypeError for EMP_FULL."""
    with pytest.raises(TypeError):
        predict_damage_emp_full(
            atk=1000, eff_value=0.0, def_reduce=0.3, cdmg=200.0,
            is_crit=True, is_weak=True, weak_ego_rate=125.0, is_ego=True
        )


def test_emp_full_default_neutral_weak_ego_rate():
    """Default weak_ego_rate=100 (neutral) must give same as EMP_CF_DIRECT when ego+weak."""
    kwargs = dict(atk=1000.0, eff_value=80.0, def_reduce=0.3, cdmg=200.0,
                  is_crit=False, dva_mult=1.0)
    cf_direct = predict_damage_emp_cf_direct(**kwargs)
    emp_full = predict_damage_emp_full(
        **kwargs, is_weak=True, weak_ego_rate=100.0, is_ego=True
    )
    # weak_ego_rate=100 -> weak_mult=1.0 -> identical
    assert emp_full == pytest.approx(cf_direct, rel=1e-9)
