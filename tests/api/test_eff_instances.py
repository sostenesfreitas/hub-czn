"""Tests for the EffInstanceIndex (Layer 2)."""
from pathlib import Path

import pytest

from api.game_data.eff_instances import EffInstanceIndex, EffInstance

CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")


@pytest.fixture(scope="module")
def index() -> EffInstanceIndex:
    return EffInstanceIndex(CLIENT_DB)


def test_lookup_known_id_returns_instance(index):
    """The first SKILL_EFF_DMG row from card(c_1057)@skill_eff.json must resolve."""
    inst = index.get("c_1057_srt1_01")
    assert isinstance(inst, EffInstance)
    assert inst.id == "c_1057_srt1_01"
    assert inst.eff_type == "SKILL_EFF_DMG"
    assert inst.eff_value == 100


def test_unknown_id_raises(index):
    with pytest.raises(KeyError):
        index.get("not_a_real_id_xyz")


def test_by_type_returns_all_dmg_instances(index):
    dmg = index.by_type("SKILL_EFF_DMG")
    assert len(dmg) > 1000  # ~1362 instances expected
    assert all(i.eff_type == "SKILL_EFF_DMG" for i in dmg)


def test_eff_value_parses_to_int(index):
    inst = index.get("c_1057_srt1_01")
    assert isinstance(inst.eff_value, int)


def test_link_cs_id_parses_to_list(index):
    """Some instances have link_cs_id as a JSON-array-shaped string like '[cs_a,cs_b]'."""
    for inst in index.by_type("SKILL_EFF_CS_SET_ADD"):
        if inst.link_cs_id:
            assert isinstance(inst.link_cs_id, list)
            assert all(isinstance(v, str) for v in inst.link_cs_id)
            break
    else:
        pytest.skip("no SKILL_EFF_CS_SET_ADD with link_cs_id found")
