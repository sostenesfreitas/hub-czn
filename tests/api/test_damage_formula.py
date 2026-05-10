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
