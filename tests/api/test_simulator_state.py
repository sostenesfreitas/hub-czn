"""Tests for BattleState and its participating dataclasses."""
import random

from api.simulator.state import BattleState, CharState, MonsterState, CardState


def test_charstate_can_be_constructed():
    c = CharState(id="char_a", atk=1000, def_=300, hp=8000, hp_current=8000,
                  cri=10.0, cri_dmg_rate=200.0, weak_ego_dmg_rate=130.0)
    assert c.atk == 1000
    assert c.hp_current == 8000


def test_monsterstate_apply_damage_reduces_hp():
    m = MonsterState(id="m1", def_=200, hp=5000, hp_current=5000, dmg_decrease_rate=0.3)
    m.apply_damage(700)
    assert m.hp_current == 4300


def test_monsterstate_apply_damage_clamps_at_zero():
    m = MonsterState(id="m1", def_=200, hp=5000, hp_current=100, dmg_decrease_rate=0.3)
    m.apply_damage(9999)
    assert m.hp_current == 0


def test_battlestate_initial_cs_stacks_empty():
    s = BattleState(turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
                    morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    assert s.cs_stacks == {}


def test_cs_stacks_increment():
    s = BattleState(turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
                    morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    s.add_cs("m1", "cs_91", 2)
    s.add_cs("m1", "cs_91", 3)
    assert s.cs_stacks["m1"]["cs_91"] == 5


def test_monsterstate_has_caster_fields():
    """MonsterState must expose atk/cri/cri_dmg_rate so it can serve as a
    caster for formulas that read those fields."""
    m = MonsterState(id="m1", def_=200, hp=5000, hp_current=5000,
                     atk=1500, cri=10.0, cri_dmg_rate=200.0)
    assert m.atk == 1500
    assert m.cri == 10.0
    assert m.cri_dmg_rate == 200.0


def test_monsterstate_caster_fields_default_to_zero():
    m = MonsterState(id="m1", def_=200, hp=5000, hp_current=5000)
    assert m.atk == 0
    assert m.cri == 0.0
    assert m.cri_dmg_rate == 0.0
