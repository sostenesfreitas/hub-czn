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
