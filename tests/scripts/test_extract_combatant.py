"""Tests for scripts/extract_combatant.py.

Strategy: run the extractor against res_ids whose CHARACTERS entries are
already known-good, then assert key fields match. If the game files were
re-extracted with the same content, output must equal CHARACTERS[res_id].
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from api.game_data.characters import CHARACTERS  # noqa: E402

OUTPUT_DIR = Path(r"C:\Users\soste\Downloads\output")


@pytest.fixture(scope="module")
def extractor():
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    import extract_combatant  # noqa: WPS433 (local import is fine here)
    return extract_combatant


def test_yuki_1057_round_trip(extractor):
    """Yuki: Order/Striker/grade 5 — anchor for c_striker_green."""
    entry = extractor.extract(OUTPUT_DIR, 1057)
    expected = CHARACTERS[1057]
    assert entry["name"] == expected["name"]
    assert entry["grade"] == expected["grade"]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]
    assert entry["base_atk"] == expected["base_atk"]
    assert entry["base_def"] == expected["base_def"]
    assert entry["base_hp"] == expected["base_hp"]


def test_nia_1003_round_trip(extractor):
    """Nia: Instinct/Controller/grade 4 — anchor for c_controller_orange."""
    entry = extractor.extract(OUTPUT_DIR, 1003)
    expected = CHARACTERS[1003]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_khalipe_1008_round_trip(extractor):
    """Khalipe: Instinct/Vanguard/grade 5 — anchor for c_knight_orange, RARITY_SSR."""
    entry = extractor.extract(OUTPUT_DIR, 1008)
    expected = CHARACTERS[1008]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_magna_1010_round_trip(extractor):
    """Magna: Justice/Vanguard — anchor for c_knight_blue."""
    entry = extractor.extract(OUTPUT_DIR, 1010)
    expected = CHARACTERS[1010]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]


def test_rin_1018_round_trip(extractor):
    """Rin: Void/Striker — anchor for c_striker_purple."""
    entry = extractor.extract(OUTPUT_DIR, 1018)
    expected = CHARACTERS[1018]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]


def test_veronica_1033_round_trip(extractor):
    """Veronica: Passion/Ranger — anchor for c_ranger_red."""
    entry = extractor.extract(OUTPUT_DIR, 1033)
    expected = CHARACTERS[1033]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]


def test_adelheid_1055_is_vanguard_void_ssr(extractor):
    """Adelheid: display class+attr from char_base@char_base (c_knight_purple, RARITY_SSR)."""
    entry = extractor.extract(OUTPUT_DIR, 1055)
    required = {"name", "grade", "attribute", "class", "base_atk",
                "base_def", "base_hp", "base_crit_rate", "base_crit_dmg",
                "base_weak_ego_dmg_rate", "node_50", "node_60"}
    assert required.issubset(entry.keys())
    assert entry["name"] == "Adelheid"
    assert entry["class"] == "Vanguard"
    assert entry["attribute"] == "Void"
    assert entry["grade"] == 5
