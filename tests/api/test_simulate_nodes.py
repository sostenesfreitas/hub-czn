"""Unit tests for potential node bonus calculation logic."""
from api.routes.simulate import (
    _decode_node_id,
    _calc_stat_add_bonus,
    _compute_node_bonuses,
)


# ---------------------------------------------------------------------------
# _decode_node_id
# ---------------------------------------------------------------------------

def test_decode_node_id_basic():
    assert _decode_node_id(10601001) == "1060_1_0_1"


def test_decode_node_id_rspark():
    assert _decode_node_id(10603101) == "1060_3_1_1"


def test_decode_node_id_two_digit_node():
    # Last two digits = 10 → node index 10
    assert _decode_node_id(10602010) == "1060_2_0_10"


def test_decode_node_id_different_char():
    assert _decode_node_id(10570101) == "1057_0_1_1"


# ---------------------------------------------------------------------------
# _calc_stat_add_bonus
# ---------------------------------------------------------------------------

def test_stat_add_no_check_returns_limit():
    effect = {"limit": 5, "check": None, "thresh": 0, "excess": False, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 500}) == 5


def test_stat_add_atk_floor_division():
    # ATK=934, val=100, limit=5 → floor(934/100)=9 capped at 5
    effect = {"limit": 5, "check": "S_ATK", "thresh": 0, "excess": False, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 934}) == 5


def test_stat_add_atk_below_limit():
    # ATK=350, val=100, limit=5 → floor(350/100)=3
    effect = {"limit": 5, "check": "S_ATK", "thresh": 0, "excess": False, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 350}) == 3


def test_stat_add_threshold_not_met():
    # stat < thresh → 0
    effect = {"limit": 5, "check": "S_ATK", "thresh": 1000, "excess": False, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 500}) == 0


def test_stat_add_threshold_met():
    # stat >= thresh, excess=False → use full stat_val
    effect = {"limit": 5, "check": "S_ATK", "thresh": 500, "excess": False, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 700}) == 5


def test_stat_add_excess_mode():
    # excess=True → use (stat - thresh) = 700 - 500 = 200 → floor(200/100) = 2
    effect = {"limit": 5, "check": "S_ATK", "thresh": 500, "excess": True, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 700}) == 2


def test_stat_add_excess_below_thresh():
    # excess=True but stat < thresh → 0 usable
    effect = {"limit": 5, "check": "S_ATK", "thresh": 500, "excess": True, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 300}) == 0


def test_stat_add_unknown_stat_key():
    effect = {"limit": 5, "check": "S_UNKNOWN", "thresh": 0, "excess": False, "val": 100}
    assert _calc_stat_add_bonus(effect, {"ATK": 1000}) == 0


# ---------------------------------------------------------------------------
# _compute_node_bonuses
# ---------------------------------------------------------------------------

_SAMPLE_NODE_EFFECTS = {
    "1060_3_1_1": {
        "type": "NODE_CARD_R_SPARK",
        "cards": ["c_1060_srt1"],
        "val": 0, "limit": 0, "check": None, "thresh": 0, "excess": False,
    },
    "1060_2_0_10": {
        "type": "NODE_REINFORCE_CARD_UNIQUE",
        "cards": [],
        "val": 20, "limit": 0, "check": None, "thresh": 0, "excess": False,
    },
    "1060_1_0_1": {
        "type": "NODE_STAT_ADD_SKILL_EFF_VALUE",
        "cards": ["c_1060_srt1"],
        "val": 100, "limit": 5, "check": None, "thresh": 0, "excess": False,
    },
}

# node_int values matching the keys above
_NODE_IDS = [10603101, 10602010, 10601001]


def test_compute_pot_cards():
    _, pot_cards, _ = _compute_node_bonuses(_NODE_IDS, _SAMPLE_NODE_EFFECTS, {"ATK": 900})
    assert "c_1060_srt1" in pot_cards


def test_compute_sort_bonus():
    _, _, sort_bonus = _compute_node_bonuses(_NODE_IDS, _SAMPLE_NODE_EFFECTS, {"ATK": 900})
    assert sort_bonus.get("SORT_UNIQUE", 0) == 20


def test_compute_card_specific_bonus():
    card_bonus, _, _ = _compute_node_bonuses(_NODE_IDS, _SAMPLE_NODE_EFFECTS, {"ATK": 900})
    # limit=5, check=None → returns limit=5
    assert card_bonus.get("c_1060_srt1", 0) == 5


def test_compute_no_nodes():
    card_bonus, pot_cards, sort_bonus = _compute_node_bonuses([], _SAMPLE_NODE_EFFECTS, {"ATK": 900})
    assert card_bonus == {}
    assert pot_cards == set()
    assert sort_bonus == {}


def test_compute_unknown_node_ignored():
    card_bonus, pot_cards, sort_bonus = _compute_node_bonuses(
        [99999999], _SAMPLE_NODE_EFFECTS, {"ATK": 900}
    )
    assert card_bonus == {}
    assert pot_cards == set()
    assert sort_bonus == {}


def test_compute_reinforce_start():
    node_effects = {
        "1060_2_1_5": {
            "type": "NODE_REINFORCE_CARD_START",
            "cards": [],
            "val": 15, "limit": 0, "check": None, "thresh": 0, "excess": False,
        },
    }
    _, _, sort_bonus = _compute_node_bonuses([10602105], node_effects, {})
    assert sort_bonus.get("SORT_START", 0) == 15


def test_compute_reinforce_neutral():
    node_effects = {
        "1060_2_1_6": {
            "type": "NODE_REINFORCE_CARD_NEUTRAL",
            "cards": [],
            "val": 10, "limit": 0, "check": None, "thresh": 0, "excess": False,
        },
    }
    _, _, sort_bonus = _compute_node_bonuses([10602106], node_effects, {})
    assert sort_bonus.get("SORT_COLLAPSE", 0) == 10
    assert sort_bonus.get("SORT_COLLAPSE_SKILL", 0) == 10
