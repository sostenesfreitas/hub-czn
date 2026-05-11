"""Unit tests for StateReconstructor."""
import random

from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.state import BattleState


def _minimal_battle_wt():
    """Synthetic battle_wt with one char and one monster, both with status.info populated."""
    return {
        "chars": [{
            "id": 1,
            "res_id": "1057",
            "status": {"info": {
                "S_ATK": 1111,
                "S_DEF": 200,
                "S_HP": 8000,
                "S_CRI": 53.4,
                "S_CRI_DMG_RATE": 193,
                "S_WEAK_EGO_DMG_RATE": 125,
            }},
            "total_spark_count": 0,
        }],
        "monsters": [{
            "id": 79,
            "res_id": "1006017_01",
            "state": "alive",
            "status": {"info": {
                "S_HP": 1770,
                "S_ATK": 2903,
                "S_DEF": 329,
                "S_DMG_DECREASE_RATE": 0.3226,
                "S_CURRENT_SHIELD": 0,
                "S_CURRENT_HP": 1770,
            }},
        }],
        "cardMap": {},
        "csMap": {},
        "ep": 3,
        "used_cards": [],
    }


def test_reconstructs_one_char_from_status_info():
    bw = _minimal_battle_wt()
    state = StateReconstructor().reconstruct(bw)
    assert len(state.player_team) == 1
    c = state.player_team[0]
    assert c.id == "1"
    assert c.atk == 1111
    assert c.def_ == 200
    assert c.cri_dmg_rate == 193
    assert c.weak_ego_dmg_rate == 125


def test_reconstructs_one_monster_with_dmg_decrease_rate():
    bw = _minimal_battle_wt()
    state = StateReconstructor().reconstruct(bw)
    assert len(state.enemies) == 1
    m = state.enemies[0]
    assert m.id == "79"
    assert m.def_ == 329
    assert m.hp == 1770
    assert m.hp_current == 1770
    assert m.dmg_decrease_rate == 0.3226


def test_handles_missing_status_info():
    """First frame of a capture may have empty status.info."""
    bw = {
        "chars": [{"id": 1, "res_id": "1057", "status": {"info": {}}}],
        "monsters": [{"id": 79, "res_id": "1006017_01", "state": "alive", "status": {"info": {}}}],
        "cardMap": {}, "csMap": {}, "used_cards": [],
    }
    state = StateReconstructor().reconstruct(bw)
    assert state.player_team[0].atk == 0
    assert state.enemies[0].def_ == 0


def test_morale_from_ep_field():
    bw = _minimal_battle_wt()
    state = StateReconstructor().reconstruct(bw)
    assert state.morale == 3


def test_rng_seed_is_applied():
    bw = _minimal_battle_wt()
    state = StateReconstructor().reconstruct(bw, rng_seed=42)
    assert isinstance(state, BattleState)
    expected = random.Random(42).random()
    assert state.rng.random() == expected
