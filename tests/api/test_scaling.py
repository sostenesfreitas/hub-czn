"""Unit tests for api.game_data.scaling.get_char_base_stats."""
import pytest
from api.game_data.scaling import get_char_base_stats


def test_yuki_at_level_1_ascend_0_returns_l1_base():
    """At L1 A0, scaling adds nothing — should return raw L1 base stats."""
    stats = get_char_base_stats("1057", level=1, ascend=0)
    assert stats["ATK"] == 160
    assert stats["DEF"] == 45
    assert stats["HP"] == 90
    assert stats["CRate"] == 3.0
    assert stats["CDmg"] == 125.0


def test_yuki_at_level_60_ascend_0_adds_level_cumsum():
    """At L60 A0, ATK = L1(160) + cumsum(c_lv_striker_ssr at 60) = 160+227 = 387."""
    stats = get_char_base_stats("1057", level=60, ascend=0)
    assert stats["ATK"] == 387
    assert stats["DEF"] == 125  # 45 + 80
    assert stats["HP"] == 356   # 90 + 266


def test_unknown_combatant_id_raises():
    # "0000" is guaranteed absent from char_base_l1.json
    # ("9999" is a real NPC id in the dataset, so it cannot be used here)
    with pytest.raises(KeyError):
        get_char_base_stats("0000", level=1, ascend=0)


def test_level_above_table_max_clamps_to_max():
    """If user passes level=999 but table only has up to L62, clamp to L62 (no extrapolation)."""
    stats_at_62 = get_char_base_stats("1057", level=62, ascend=0)
    stats_at_999 = get_char_base_stats("1057", level=999, ascend=0)
    assert stats_at_62 == stats_at_999


def test_ascend_above_max_clamps_to_max():
    """ascend=999 should return the same stats as the maximum valid ascend, not zero."""
    stats_at_max = get_char_base_stats("1057", level=60, ascend=5)  # 5 is max in dev_ascend
    stats_at_999 = get_char_base_stats("1057", level=60, ascend=999)
    assert stats_at_max == stats_at_999


def test_ascend_negative_clamps_to_zero():
    """ascend=-1 should be clamped to 0 (same as ascend=0)."""
    stats_at_0 = get_char_base_stats("1057", level=60, ascend=0)
    stats_at_neg = get_char_base_stats("1057", level=60, ascend=-1)
    assert stats_at_0 == stats_at_neg


def test_level_zero_clamps_to_one():
    """level=0 should be clamped to 1 (same as level=1)."""
    stats_at_1 = get_char_base_stats("1057", level=1, ascend=0)
    stats_at_0 = get_char_base_stats("1057", level=0, ascend=0)
    assert stats_at_1 == stats_at_0


def test_ascend_5_is_cumulative_sum_of_rows_1_to_5():
    """A5 must equal cumulative sum of per-tier ascend deltas, not just row 5."""
    stats = get_char_base_stats("1057", level=60, ascend=5)
    # Yuki L60 A5: L1(160) + level_cumsum(227) + ascend_cumulative(80) = 467
    assert stats["ATK"] == 467


def test_optimizer_uses_scaling_for_yuki_l60_a5():
    """Optimizer must compute Yuki's L60 A5 base stats via scaling.py, not legacy CHARACTERS."""
    from api.optimizer.optimizer import GearOptimizer

    opt = GearOptimizer()
    # Mock character_info entry for Yuki L60 A5 (no gear)
    class FakeCharInfo:
        res_id = 1057
        level = 60
        ascend = 5
        partner_res_id = None
        friendship_bonus = (0, 0, 0)
        potential_50_level = 0
        potential_60_level = 0

    opt.character_info = {"Yuki": FakeCharInfo()}
    stats = opt.calculate_build_stats(gear=[], char_name="Yuki")

    # Scaling-driven base must equal what scaling.py reports for Yuki L60 A5
    from api.game_data.scaling import get_char_base_stats
    expected = get_char_base_stats("1057", 60, 5)
    assert stats["ATK"] >= 387  # at minimum, level cumsum is applied
    assert stats["ATK"] == expected["ATK"]
