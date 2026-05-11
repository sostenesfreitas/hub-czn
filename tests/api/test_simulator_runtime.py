"""Tests for the Runtime dispatcher."""
import json
import random
from pathlib import Path

import pytest

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.runtime import Runtime, EffectResult
from api.simulator.state import BattleState, CharState, MonsterState

REPO = Path(__file__).resolve().parents[2]
CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG_PATH = REPO / "api" / "data" / "eff_type_catalog.json"


@pytest.fixture(scope="module")
def runtime():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)
    return Runtime(catalog=catalog, instances=instances)


@pytest.fixture
def minimal_state():
    caster = CharState(id="c1", atk=1087, def_=300, hp=8000, hp_current=8000,
                       cri=10.0, cri_dmg_rate=221.0)
    target = MonsterState(id="m1", def_=540, hp=3000, hp_current=3000, dmg_decrease_rate=0.334)
    state = BattleState(turn=1, player_team=[caster], enemies=[target],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    return state, caster, target


def test_runtime_dispatches_known_skill_eff_dmg(runtime, minimal_state):
    state, caster, target = minimal_state
    result = runtime.apply("c_1057_srt1_01", caster, state)
    assert isinstance(result, EffectResult)
    assert result.skipped is False


def test_runtime_skips_when_trigger_ineligible(runtime, minimal_state):
    """A passive trigger fired in an active context should return skipped."""
    state, caster, target = minimal_state
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    passive_types = [t for t, b in catalog.items() if b.get("trigger") == "passive"]
    if not passive_types:
        pytest.skip("no passive-trigger types in catalog")
    instances = runtime._instances.by_type(passive_types[0])
    if not instances:
        pytest.skip("no client instances for passive type")
    result = runtime.apply(instances[0].id, caster, state, context="active")
    assert result.skipped


def test_effect_result_has_dva_stacks_observed_default_empty():
    from api.simulator.result import EffectResult
    r = EffectResult()
    assert r.dva_stacks_observed == {}


def test_effect_result_dva_stacks_observed_accepts_dict():
    from api.simulator.result import EffectResult
    r = EffectResult(damage=100, dva_stacks_observed={"cs_91": 3, "cs_112": 1})
    assert r.dva_stacks_observed["cs_91"] == 3
    assert r.dva_stacks_observed["cs_112"] == 1
