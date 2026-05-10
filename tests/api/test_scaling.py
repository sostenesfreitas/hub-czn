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
