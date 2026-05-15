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


def test_battlestate_has_card_owner_lookup_default_empty():
    s = BattleState(turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
                    morale=0, ego_state={}, spark_state={}, cs_stacks={},
                    rng=random.Random(0))
    assert s.card_owner_lookup == {}


def test_battlestate_card_owner_lookup_accepts_initial_value():
    s = BattleState(turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
                    morale=0, ego_state={}, spark_state={}, cs_stacks={},
                    rng=random.Random(0),
                    card_owner_lookup={"7": "1", "8": "2"})
    assert s.card_owner_lookup["7"] == "1"
    assert s.card_owner_lookup["8"] == "2"


def test_charstate_supports_res_id():
    c = CharState(id="1", atk=1000, def_=200, hp=8000, hp_current=8000,
                  cri=10.0, cri_dmg_rate=200.0, res_id="1057")
    assert c.res_id == "1057"


def test_monsterstate_supports_res_id():
    m = MonsterState(id="38", def_=200, hp=5000, hp_current=5000, res_id="1006017_01")
    assert m.res_id == "1006017_01"


def test_battle_state_skill_map_raw_defaults_to_none():
    """Sprint 2f2: BattleState carries optional skill_map_raw populated by
    StateReconstructor from battle_wt.skillMap. Synth states leave it None
    so the v2 multiplier helper degrades to identity (1.0)."""
    import random
    from api.simulator.state import BattleState
    state = BattleState(
        turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={},
        rng=random.Random(0),
    )
    assert state.skill_map_raw is None
    assert state.cs_map_raw is None


def test_battle_state_skill_map_raw_can_be_set_explicitly():
    """Allow constructor or attribute assignment to populate the fields."""
    import random
    from api.simulator.state import BattleState
    state = BattleState(
        turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={},
        rng=random.Random(0),
        skill_map_raw={1: {"eff_value": 50}},
        cs_map_raw={2: {"owner_id": 39, "term_value": 1}},
    )
    assert state.skill_map_raw == {1: {"eff_value": 50}}
    assert state.cs_map_raw == {2: {"owner_id": 39, "term_value": 1}}
