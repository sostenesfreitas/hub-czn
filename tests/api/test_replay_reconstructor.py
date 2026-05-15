"""Unit tests for StateReconstructor."""
import random

from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.state import BattleState, CardState, EgoState, SparkState


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


def test_cs_stacks_initialized_from_csmap():
    bw = _minimal_battle_wt()
    bw["csMap"] = {
        "1": {"cs_id": 1, "res_id": "cs19_0071", "term_value": 3, "owner_id": 1, "is_passive": True},
        "2": {"cs_id": 2, "res_id": "cs00_0002", "term_value": 5, "owner_id": 79, "is_passive": False},
    }
    state = StateReconstructor().reconstruct(bw)
    assert state.cs_stacks["1"]["cs19_0071"] == 3
    assert state.cs_stacks["79"]["cs00_0002"] == 5


def test_cards_populated_into_hand():
    """cardMap entries with card_place=CARD_PLACE_HAND go into state.hand."""
    bw = _minimal_battle_wt()
    bw["cardMap"] = {
        "7": {
            "id": 7, "res_id": "c_1057_srt1", "char_id": 1, "cost": 1,
            "card_place": "CARD_PLACE_HAND", "skill_eff_ids": ["c_1057_srt1_01"],
            "r_spark": "none", "curEgo": 0, "interruptOutline": False,
        },
        "8": {
            "id": 8, "res_id": "c_1057_srt2", "char_id": 1, "cost": 2,
            "card_place": "CARD_PLACE_DECK", "skill_eff_ids": ["c_1057_srt2_01"],
            "r_spark": "none", "curEgo": 0, "interruptOutline": False,
        },
    }
    state = StateReconstructor().reconstruct(bw)
    assert len(state.hand) == 1
    assert state.hand[0].card_id == "c_1057_srt1"
    assert state.hand[0].cost == 1
    assert len(state.deck) == 1
    assert state.deck[0].card_id == "c_1057_srt2"


def test_ego_state_set_from_curEgo_on_cards():
    """If any of the caster's cards has curEgo > 0, mark is_ego_active."""
    bw = _minimal_battle_wt()
    bw["cardMap"] = {
        "7": {
            "id": 7, "res_id": "c_x", "char_id": 1, "cost": 1,
            "card_place": "CARD_PLACE_HAND", "skill_eff_ids": [],
            "r_spark": "none", "curEgo": 2, "interruptOutline": False,
        },
    }
    state = StateReconstructor().reconstruct(bw)
    assert state.ego_state["1"].stage == 2


def test_reconstructs_monster_with_atk_and_crit_fields():
    bw = _minimal_battle_wt()
    bw["monsters"][0]["status"]["info"]["S_ATK"] = 2903
    bw["monsters"][0]["status"]["info"]["S_CRI"] = 15.0
    bw["monsters"][0]["status"]["info"]["S_CRI_DMG_RATE"] = 180.0
    state = StateReconstructor().reconstruct(bw)
    m = state.enemies[0]
    assert m.atk == 2903
    assert m.cri == 15.0
    assert m.cri_dmg_rate == 180.0


def test_card_owner_lookup_populated_from_cardmap_char_id():
    bw = _minimal_battle_wt()
    bw["cardMap"] = {
        "7": {"id": 7, "res_id": "c_1057_srt1", "char_id": 1, "cost": 1,
              "card_place": "CARD_PLACE_HAND", "skill_eff_ids": ["c_1057_srt1_01"],
              "r_spark": "none", "curEgo": 0, "interruptOutline": False},
        "8": {"id": 8, "res_id": "c_1062_srt1", "char_id": 2, "cost": 1,
              "card_place": "CARD_PLACE_HAND", "skill_eff_ids": ["c_1062_srt1_01"],
              "r_spark": "none", "curEgo": 0, "interruptOutline": False},
        "54": {"id": 54, "res_id": "1006005_01_pt2_10", "char_id": 103, "cost": 1,
               "card_place": "CARD_PLACE_HAND", "skill_eff_ids": ["1006005_01_pt2_10_01"],
               "r_spark": "none", "curEgo": 0, "interruptOutline": False},
    }
    state = StateReconstructor().reconstruct(bw)
    assert state.card_owner_lookup == {"7": "1", "8": "2", "54": "103"}


def test_card_owner_lookup_skips_entries_without_char_id():
    bw = _minimal_battle_wt()
    bw["cardMap"] = {
        "7": {"id": 7, "res_id": "c_x", "char_id": 1, "cost": 1,
              "card_place": "CARD_PLACE_HAND", "skill_eff_ids": [],
              "r_spark": "none", "curEgo": 0, "interruptOutline": False},
        "9": {"id": 9, "res_id": "c_y", "cost": 1,
              "card_place": "CARD_PLACE_HAND", "skill_eff_ids": [],
              "r_spark": "none", "curEgo": 0, "interruptOutline": False},
    }
    state = StateReconstructor().reconstruct(bw)
    assert "7" in state.card_owner_lookup
    assert "9" not in state.card_owner_lookup


def test_chars_have_res_id_from_snapshot():
    bw = _minimal_battle_wt()
    state = StateReconstructor().reconstruct(bw)
    assert state.player_team[0].res_id == "1057"  # the minimal fixture's char


def test_monsters_have_res_id_from_snapshot():
    bw = _minimal_battle_wt()
    state = StateReconstructor().reconstruct(bw)
    assert state.enemies[0].res_id == "1006017_01"


def test_state_reconstructor_populates_skill_map_raw_from_battle_wt():
    """Sprint 2f2: reconstructor copies battle_wt.skillMap into state.skill_map_raw."""
    from api.simulator.replay.reconstructor import StateReconstructor
    battle_wt = {
        "turn": 1,
        "chars": [],
        "monsters": [],
        "csMap": {},
        "cardMap": {},
        "skillMap": {"1": {"eff_value": 50, "res_id": "test"}},
    }
    state = StateReconstructor().reconstruct(battle_wt)
    assert state.skill_map_raw == {"1": {"eff_value": 50, "res_id": "test"}}


def test_state_reconstructor_populates_cs_map_raw_from_battle_wt():
    """Sprint 2f2: reconstructor copies battle_wt.csMap into state.cs_map_raw."""
    from api.simulator.replay.reconstructor import StateReconstructor
    battle_wt = {
        "turn": 1,
        "chars": [],
        "monsters": [],
        "csMap": {"5": {"owner_id": 39, "term_value": 3, "skillEffs": [10]}},
        "cardMap": {},
        "skillMap": {},
    }
    state = StateReconstructor().reconstruct(battle_wt)
    assert state.cs_map_raw == {"5": {"owner_id": 39, "term_value": 3, "skillEffs": [10]}}


def test_state_reconstructor_handles_missing_skill_map_gracefully():
    """When battle_wt has no skillMap key, state.skill_map_raw should be None."""
    from api.simulator.replay.reconstructor import StateReconstructor
    battle_wt = {"turn": 1, "chars": [], "monsters": [], "csMap": {}, "cardMap": {}}
    state = StateReconstructor().reconstruct(battle_wt)
    assert state.skill_map_raw is None
    assert state.cs_map_raw is None


def test_state_reconstructor_accumulates_monster_history_across_calls():
    """Sprint 2g2 T2: when multiple snapshots are reconstructed in sequence,
    the monster_history dict accumulates all monsters seen across them."""
    from api.simulator.replay.reconstructor import StateReconstructor
    bw1 = {
        "turn": 1, "chars": [], "csMap": {}, "cardMap": {}, "skillMap": {},
        "monsters": [{"id": "m1", "res_id": "1001012_01", "status": {"info": {"S_DEF": 100, "S_HP": 1000}}}],
    }
    bw2 = {
        "turn": 2, "chars": [], "csMap": {}, "cardMap": {}, "skillMap": {},
        "monsters": [{"id": "m2", "res_id": "3000489_01", "status": {"info": {"S_DEF": 200, "S_HP": 2000}}}],
    }
    rec = StateReconstructor()
    s1 = rec.reconstruct(bw1)
    s2 = rec.reconstruct(bw2)
    # s2 should know BOTH monsters via history (m2 currently visible, m1 from history)
    assert s2.monster_history is not None
    assert "1001012_01" in s2.monster_history or "1001012" in {r[:7] for r in s2.monster_history}
    assert "3000489_01" in s2.monster_history or "3000489" in {r[:7] for r in s2.monster_history}
