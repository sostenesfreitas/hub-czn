"""Best damage card eff_pct sampler used by the optimizer."""
from unittest.mock import MagicMock

import pytest

from api.game_data.char_eff import best_damage_eff_for, _is_damage_card


class _FakeExp:
    def __init__(self, eff_pct, target_class, description):
        self.eff_pct = eff_pct
        self.target_class = target_class
        self.raw_description = description


def test_is_damage_card_accepts_damage_keyword():
    assert _is_damage_card(_FakeExp(120, None, "Deals 120% damage to enemy"))


def test_is_damage_card_rejects_none_eff():
    assert not _is_damage_card(_FakeExp(None, None, "Deals damage"))


def test_is_damage_card_rejects_self_target():
    assert not _is_damage_card(_FakeExp(50, "self", "Restores HP; damage taken reduced"))


def test_is_damage_card_rejects_non_damage_card():
    assert not _is_damage_card(_FakeExp(75, None, "Heals an ally"))


def test_best_damage_eff_for_returns_max_eff_pct():
    resolver = MagicMock()
    info = MagicMock()
    info.starting_card_ids = ["c_X_srt1", "c_X_srt2"]
    info.epiphany_card_ids = ["c_X_uni1"]

    def _find_char(name):
        return info if name == "Tester" else None

    def _expectation(card_id, level=1):
        return {
            "c_X_srt1": _FakeExp(100, None, "Deals 100% damage to one enemy"),
            "c_X_srt2": _FakeExp(120, None, "Deals 120% damage to one enemy"),
            "c_X_uni1": _FakeExp(80, None, "Heals self"),
        }[card_id]

    resolver.card_expectation.side_effect = _expectation

    from api.game_data import char_eff as mod
    mod._lookup_char_info_by_name = _find_char  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        result = best_damage_eff_for("Tester", _resolver=resolver)
        assert result == pytest.approx(120.0)
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name


def test_best_damage_eff_for_unknown_char_falls_back_to_100():
    resolver = MagicMock()
    from api.game_data import char_eff as mod
    mod._lookup_char_info_by_name = lambda name: None  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        result = best_damage_eff_for("DoesNotExist", _resolver=resolver)
        assert result == pytest.approx(100.0)
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name


def test_best_damage_eff_for_no_damage_card_falls_back_to_100():
    resolver = MagicMock()
    info = MagicMock()
    info.starting_card_ids = ["c_X_srt1"]
    info.epiphany_card_ids = []
    resolver.card_expectation.return_value = _FakeExp(80, None, "Heals ally")

    from api.game_data import char_eff as mod
    mod._lookup_char_info_by_name = lambda name: info  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        result = best_damage_eff_for("HealerOnly", _resolver=resolver)
        assert result == pytest.approx(100.0)
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name


def test_best_damage_eff_for_caches_per_char():
    resolver = MagicMock()
    info = MagicMock()
    info.starting_card_ids = ["c_X_srt1"]
    info.epiphany_card_ids = []
    resolver.card_expectation.return_value = _FakeExp(150, None, "Deals 150% damage")

    from api.game_data import char_eff as mod
    mod._lookup_char_info_by_name = lambda name: info  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        a = best_damage_eff_for("Cached", _resolver=resolver)
        b = best_damage_eff_for("Cached", _resolver=resolver)
        assert a == b == pytest.approx(150.0)
        assert resolver.card_expectation.call_count == 1
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name


def test_best_damage_eff_for_real_resolver_returns_positive_for_known_chars():
    """Smoke test against the real CharResolver / deck_builder data."""
    best_damage_eff_for.cache_clear()
    for char_name in ("Diana", "Nia", "Haru"):
        value = best_damage_eff_for(char_name)
        assert value > 0.0, f"{char_name}: got {value}"
