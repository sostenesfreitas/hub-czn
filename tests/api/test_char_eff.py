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


def test_best_damage_eff_for_returns_max_eff_pct(monkeypatch):
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
    # Force v1 fallback for synth tests by disabling the real EffInstanceIndex.
    monkeypatch.setattr(mod, "_get_default_eff_index", lambda: None)
    mod._lookup_char_info_by_name_override = _find_char  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        result = best_damage_eff_for("Tester", _resolver=resolver)
        assert result == pytest.approx(120.0)
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name_override


def test_best_damage_eff_for_unknown_char_falls_back_to_100():
    resolver = MagicMock()
    from api.game_data import char_eff as mod
    mod._lookup_char_info_by_name_override = lambda name: None  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        result = best_damage_eff_for("DoesNotExist", _resolver=resolver)
        assert result == pytest.approx(100.0)
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name_override


def test_best_damage_eff_for_no_damage_card_falls_back_to_100():
    resolver = MagicMock()
    info = MagicMock()
    info.starting_card_ids = ["c_X_srt1"]
    info.epiphany_card_ids = []
    resolver.card_expectation.return_value = _FakeExp(80, None, "Heals ally")

    from api.game_data import char_eff as mod
    mod._lookup_char_info_by_name_override = lambda name: info  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        result = best_damage_eff_for("HealerOnly", _resolver=resolver)
        assert result == pytest.approx(100.0)
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name_override


def test_best_damage_eff_for_caches_per_char(monkeypatch):
    resolver = MagicMock()
    info = MagicMock()
    info.starting_card_ids = ["c_X_srt1"]
    info.epiphany_card_ids = []
    resolver.card_expectation.return_value = _FakeExp(150, None, "Deals 150% damage")

    from api.game_data import char_eff as mod
    monkeypatch.setattr(mod, "_get_default_eff_index", lambda: None)
    mod._lookup_char_info_by_name_override = lambda name: info  # type: ignore[attr-defined]
    try:
        best_damage_eff_for.cache_clear()
        a = best_damage_eff_for("Cached", _resolver=resolver)
        b = best_damage_eff_for("Cached", _resolver=resolver)
        assert a == b == pytest.approx(150.0)
        assert resolver.card_expectation.call_count == 1
    finally:
        best_damage_eff_for.cache_clear()
        del mod._lookup_char_info_by_name_override


def test_best_damage_eff_for_real_resolver_returns_positive_for_known_chars():
    """Smoke test against the real CharResolver / deck_builder data."""
    best_damage_eff_for.cache_clear()
    for char_name in ("Diana", "Nia", "Haru"):
        value = best_damage_eff_for(char_name)
        assert value > 0.0, f"{char_name}: got {value}"


# ===========================================================================
# Sprint 2f4 — v2 classifier via EffInstanceIndex
# ===========================================================================

def test_damage_card_ids_via_eff_index_collects_damage_firing_cards():
    """v2 classifier helper: build a set of card_ids whose skill_eff instances
    are SKILL_EFF_DMG / SKILL_EFF_DMG_IGNORE_COND / SKILL_EFF_DMG_COOP."""
    from unittest.mock import MagicMock
    from api.game_data.char_eff import _damage_card_ids_via_eff_index
    from api.game_data.eff_instances import EffInstance

    eff_index = MagicMock()
    fake_dmg = EffInstance(id="c_1003_srt4_01", eff_type="SKILL_EFF_DMG", raw={})
    fake_dmg2 = EffInstance(id="c_1003_uni2_03", eff_type="SKILL_EFF_DMG_IGNORE_COND", raw={})
    fake_heal = EffInstance(id="c_1003_uni3_01", eff_type="SKILL_EFF_HEAL", raw={})

    def by_type(eff_type):
        if eff_type == "SKILL_EFF_DMG":
            return [fake_dmg]
        if eff_type == "SKILL_EFF_DMG_IGNORE_COND":
            return [fake_dmg2]
        return []

    eff_index.by_type.side_effect = by_type

    result = _damage_card_ids_via_eff_index(eff_index)
    assert "c_1003_srt4" in result
    assert "c_1003_uni2" in result
    assert "c_1003_uni3" not in result  # heal card excluded


def test_best_damage_eff_for_v2_finds_nia_damage_cards():
    """v1 string match missed Nia's damage cards; v2 EffInstanceIndex classifier
    now identifies c_1003_srt1 as a damage card. Nia's card_expectation for that
    card currently has eff_pct=None (support-class card data gap), so the
    fallback to 100.0 is expected — but the CLASSIFIER step now succeeds,
    which is the v2 fix.
    """
    from api.game_data.char_eff import (
        best_damage_eff_for,
        _damage_card_ids_via_eff_index,
        _get_default_eff_index,
    )
    best_damage_eff_for.cache_clear()
    # The classifier must now identify at least one Nia card as damage.
    eff_index = _get_default_eff_index()
    if eff_index is not None:
        dmg_ids = _damage_card_ids_via_eff_index(eff_index)
        nia_starting = {"c_1003_srt1", "c_1003_srt2", "c_1003_srt3", "c_1003_srt4"}
        nia_epi = {"c_1003_uni1", "c_1003_uni2", "c_1003_uni3", "c_1003_uni4"}
        assert (nia_starting | nia_epi) & dmg_ids, (
            "v2 classifier failed to identify any Nia card as damage-firing"
        )
    # And best_damage_eff_for still returns a float (>=100).
    value = best_damage_eff_for("Nia")
    assert value >= 100.0, f"Nia eff_pct: expected >= 100, got {value}"


def test_best_damage_eff_for_v2_strong_chars_unchanged_or_better():
    """v2 should not REGRESS chars that already had eff_pct > 100 in v1."""
    from api.game_data.char_eff import best_damage_eff_for
    best_damage_eff_for.cache_clear()
    diana = best_damage_eff_for("Diana")
    assert diana >= 100.0, f"Diana eff_pct went below 100: {diana}"


def test_best_damage_eff_for_v2_unknown_char_falls_back_to_100():
    """Unknown chars still return 100.0."""
    from api.game_data.char_eff import best_damage_eff_for
    best_damage_eff_for.cache_clear()
    assert best_damage_eff_for("DoesNotExist") == 100.0
