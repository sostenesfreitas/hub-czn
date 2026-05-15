"""Unit tests for CharResolver."""
import json
from pathlib import Path

import pytest

from api.simulator.replay.char_resolver import (
    CharResolver, CharInfo, CardExpectation,
)


REPO = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def resolver():
    return CharResolver()


def test_name_for_known_id_resolves(resolver):
    assert resolver.name_for(1052) == "Narja"
    assert resolver.name_for(30093) == "Heidemarie"
    assert resolver.name_for("1057") == "Yuki"


def test_name_for_unknown_id_returns_fallback(resolver):
    name = resolver.name_for(99999)
    assert "unknown" in name
    assert "99999" in name


def test_char_info_returns_card_lists(resolver):
    info = resolver.char_info(1057)
    assert info is not None
    assert info.name == "Yuki"
    assert "c_1057_srt1" in info.starting_card_ids
    assert "c_1057_uni1" in info.epiphany_card_ids
    assert info.ego_card_id == "c_1057_eps"


def test_card_expectation_parses_percent_from_description(resolver):
    exp = resolver.card_expectation("c_1017_uni3")
    assert exp is not None
    assert exp.eff_pct == 200  # "200% Defense-based..."
    assert exp.scaling_stat == "def"
    assert exp.cost == 2


def test_card_expectation_parses_target_class(resolver):
    exp = resolver.card_expectation("c_1017_uni3")
    assert exp is not None
    assert exp.target_class == "all_enemies"


def test_card_expectation_returns_none_for_unknown(resolver):
    assert resolver.card_expectation("c_nonexistent") is None


def test_all_chars_returns_full_roster(resolver):
    chars = resolver.all_chars()
    assert len(chars) >= 30
    names = {c.name for c in chars}
    assert "Heidemarie" in names
    assert "Yuki" in names
