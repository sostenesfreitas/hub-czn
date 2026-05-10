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


from api.capture.validate_damage import predict_damage_h1, validate_against_hits


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
