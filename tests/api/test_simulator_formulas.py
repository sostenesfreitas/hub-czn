"""Per-formula unit tests. F_BASE_DMG is anchored on Track B verified hits."""
import random

import pytest

from api.game_data.eff_instances import EffInstance
from api.simulator.formulas import _formula_base_damage
from api.simulator.state import BattleState, CharState, MonsterState


def _state(caster: CharState, target: MonsterState) -> BattleState:
    return BattleState(turn=1, player_team=[caster], enemies=[target],
                       hand=[], deck=[], discard=[], morale=0,
                       ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))


def _fake_inst(eff_value: int) -> EffInstance:
    raw = {"id": "fake", "eff": "SKILL_EFF_DMG", "eff_value": str(eff_value),
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[]"}
    return EffInstance(id="fake", eff_type="SKILL_EFF_DMG", raw=raw)


# Track B verified: c_30075_srt4_mut hit. ATK=1087, eff_value=75, DR=0.334, no crit -> 547
def test_f_base_dmg_track_b_verified_hit_1():
    caster = CharState(id="c", atk=1087, def_=300, hp=1, hp_current=1,
                       cri=10.0, cri_dmg_rate=221.0)
    target = MonsterState(id="m", def_=540, hp=99999, hp_current=99999, dmg_decrease_rate=0.334)
    result = _formula_base_damage(_fake_inst(75), caster, [target], _state(caster, target))
    # Predicted 543; observed 547. Allow ±5%.
    assert abs(result.damage - 547) / 547 < 0.05


def test_f_base_dmg_non_crit_uses_factor_one():
    caster = CharState(id="c", atk=1000, def_=300, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=200.0)  # 0% crit -> never crits
    target = MonsterState(id="m", def_=200, hp=99999, hp_current=99999, dmg_decrease_rate=0.4)
    result = _formula_base_damage(_fake_inst(100), caster, [target], _state(caster, target))
    # dmg = 1000 * 1.0 * (1 - 0.4) * 1.0 = 600
    assert result.damage == 600


def test_f_base_dmg_applies_to_first_target_only():
    caster = CharState(id="c", atk=1000, def_=300, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=200.0)
    t1 = MonsterState(id="m1", def_=0, hp=99999, hp_current=99999, dmg_decrease_rate=0.0)
    t2 = MonsterState(id="m2", def_=0, hp=99999, hp_current=99999, dmg_decrease_rate=0.0)
    state = BattleState(turn=1, player_team=[caster], enemies=[t1, t2],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    result = _formula_base_damage(_fake_inst(100), caster, [t1, t2], state)
    assert result.target_id == "m1"
    assert t1.hp_current < 99999
    assert t2.hp_current == 99999


from api.simulator.formulas import (
    _formula_add_cs,
    _formula_shield,
    _formula_heal,
    _formula_draw,
    _formula_discard,
    _formula_move_card,
    _formula_noop,
)
from api.simulator.state import CardState


def test_f_draw_moves_from_deck_to_hand():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster], enemies=[],
                        hand=[],
                        deck=[CardState(card_id="c1", cost=1), CardState(card_id="c2", cost=1)],
                        discard=[], morale=0, ego_state={}, spark_state={}, cs_stacks={},
                        rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_CARD_DRAW", "eff_value": "1",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CARD_DRAW", raw=raw)
    _formula_draw(inst, caster, [], state)
    assert len(state.hand) == 1
    assert len(state.deck) == 1


def test_f_discard_moves_hand_to_discard():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster], enemies=[],
                        hand=[CardState(card_id="c1", cost=1)], deck=[], discard=[],
                        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_CARD_DISCARD", "eff_value": "1",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CARD_DISCARD", raw=raw)
    _formula_discard(inst, caster, [], state)
    assert len(state.hand) == 0
    assert len(state.discard) == 1


def test_f_noop_returns_skipped_with_no_state_change():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = _state(caster, MonsterState(id="m", def_=0, hp=1, hp_current=1))
    raw = {"id": "fake", "eff": "SKILL_EFF_BATTLE_SKIP", "eff_value": "0",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_NONE",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_BATTLE_SKIP", raw=raw)
    result = _formula_noop(inst, caster, [], state)
    assert result.skipped is True


def test_f_add_cs_increments_target_stacks():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=1, hp_current=1)
    state = _state(caster, target)
    # SKILL_EFF_CS_SET_ADD uses link_cs_id for the cs_id; eff_count_value for quantity.
    raw = {"id": "fake", "eff": "SKILL_EFF_CS_SET_ADD", "eff_value": "0",
           "eff_count_value": "2", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[cs_91]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CS_SET_ADD", raw=raw)
    result = _formula_add_cs(inst, caster, [target], state)
    assert state.cs_stacks["m1"]["cs_91"] == 2
    assert result.cs_added == {"cs_91": 2}


def test_f_shield_adds_to_target():
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    ally = CharState(id="a1", atk=0, def_=0, hp=5000, hp_current=5000, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster, ally], enemies=[],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_SHIELD", "eff_value": "30",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_SHIELD", raw=raw)
    # 30% of caster.atk = 300
    result = _formula_shield(inst, caster, [ally], state)
    assert ally.shield == 300
    assert result.shield_added == 300


def test_f_heal_restores_hp():
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    ally = CharState(id="a1", atk=0, def_=0, hp=5000, hp_current=2000, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster, ally], enemies=[],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_HEAL", "eff_value": "50",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_HEAL", raw=raw)
    # 50% of caster.atk = 500
    _formula_heal(inst, caster, [ally], state)
    assert ally.hp_current == 2500
