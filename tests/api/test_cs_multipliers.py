"""Unit tests for CSMultiplierIndex."""
from pathlib import Path

import pytest

from api.game_data.cs_multipliers import (
    CSMultiplierIndex, DamageModifier,
)


def test_damage_modifier_dataclass_basic_construction():
    mod = DamageModifier(
        cs_id="cs00_0002", eff_value=50,
        sign="MATHSIGN_ADD_HUND_MULTIPLY_PCT", direction="take",
        link_cs_id=[], source_id="cs00_0002_01",
    )
    assert mod.cs_id == "cs00_0002"
    assert mod.eff_value == 50
    assert mod.direction == "take"


def test_index_lookup_empty_for_unknown_cs_id():
    idx = CSMultiplierIndex()
    assert idx.lookup("cs_does_not_exist") == []


def test_index_all_cs_ids_returns_set():
    idx = CSMultiplierIndex()
    ids = idx.all_cs_ids()
    assert isinstance(ids, set)


def test_index_lookup_returns_modifiers_for_known_cs_id():
    """cs00_0002 has at least one SKILL_EFF_DAMAGE_VALUE_ADD in cs(card1)
    with eff_value=50, sign=MATHSIGN_ADD_HUND_MULTIPLY_PCT, opt=[take]."""
    idx = CSMultiplierIndex()
    mods = idx.lookup("cs00_0002")
    assert len(mods) >= 1
    m = mods[0]
    assert m.eff_value == 50
    assert m.direction == "take"
    assert m.sign == "MATHSIGN_ADD_HUND_MULTIPLY_PCT"
    assert m.cs_id == "cs00_0002"
    assert m.source_id.startswith("cs00_0002")


def test_index_strips_instance_suffix():
    """Modifiers from id='cs00_0002_01' index under cs_id='cs00_0002'."""
    idx = CSMultiplierIndex()
    assert idx.lookup("cs00_0002")  # has entries
    assert idx.lookup("cs00_0002_01") == []  # full id not used as key


def test_index_total_modifiers_around_386():
    """The 3 cs shards together yield ~386 SKILL_EFF_DAMAGE_VALUE_ADD instances."""
    idx = CSMultiplierIndex()
    total = sum(len(idx.lookup(cid)) for cid in idx.all_cs_ids())
    assert 300 <= total <= 500, f"expected ~386 modifiers, got {total}"


def test_index_directions_distribution():
    """Both 'take' and 'attack' directions should appear."""
    idx = CSMultiplierIndex()
    directions = set()
    for cid in idx.all_cs_ids():
        for mod in idx.lookup(cid):
            directions.add(mod.direction)
    assert "take" in directions
    assert "attack" in directions
