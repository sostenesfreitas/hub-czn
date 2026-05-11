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
