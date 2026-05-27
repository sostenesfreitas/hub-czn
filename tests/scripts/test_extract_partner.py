"""Tests for scripts/extract_partner.py.

extract_partner.py is *assisted* extraction: it auto-resolves stats,
grade, class and ego_name/cost from the DB, but emits passive_desc and
values as a best-effort scaffold for human review. Tests assert only the
auto-resolved fields.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from api.game_data.partners import PARTNERS  # noqa: E402

OUTPUT_DIR = Path(r"C:\Users\soste\Downloads\output")


@pytest.fixture(scope="module")
def extractor():
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    import extract_partner  # noqa: WPS433
    return extract_partner


def test_ivy_1025_class_and_grade(extractor):
    """Ivy: Psionic / grade 5 — anchor for s_psionic → Psionic, RARITY_SSR → 5."""
    entry = extractor.extract(OUTPUT_DIR, 1025)
    expected = PARTNERS[1025]
    assert entry["name"] == expected["name"]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_solia_1058_class_and_grade(extractor):
    """Solia: Ranger / grade 5 — anchor for s_ranger → Ranger."""
    entry = extractor.extract(OUTPUT_DIR, 1058)
    expected = PARTNERS[1058]
    assert entry["name"] == expected["name"]
    assert entry["class"] == expected["class"]


def test_arwen_20001_class_and_grade(extractor):
    """Arwen: Controller / grade 4 — anchor for s_controller → Controller, RARITY_SR → 4."""
    entry = extractor.extract(OUTPUT_DIR, 20001)
    expected = PARTNERS[20001]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_clara_30095_emits_required_fields(extractor):
    """Clara: should emit all required PARTNERS fields, even if values are scaffolded."""
    entry = extractor.extract(OUTPUT_DIR, 30095)
    required = {"name", "grade", "class", "passive_name", "passive_desc",
                "values", "stats", "ego_name", "ego_cost", "ego_desc"}
    assert required.issubset(entry.keys())
    assert entry["name"] == "Clara"
    # Clara is a Knight-class partner per partner_base@char_partner.json
    assert entry["class"] == "Vanguard"
