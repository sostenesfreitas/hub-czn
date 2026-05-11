"""Best-damage-card eff_pct sampler used by the optimizer.

For a given character, returns the maximum eff_pct across the
character's starting + epiphany cards whose description appears to
describe a damage effect.  Falls back to 100.0 (a canonical baseline
card scaling) when no damage card is detected.

The classifier is intentionally crude — string match on "damage" plus a
target_class filter.  v2 can refine via EffInstanceIndex.eff_type once
we have a stable cross-reference from card_id to skill_eff_id.
"""
import functools
from typing import Optional

from api.simulator.replay.char_resolver import CardExpectation, CharResolver


_DEFAULT_RESOLVER: Optional[CharResolver] = None


def _get_resolver() -> CharResolver:
    global _DEFAULT_RESOLVER
    if _DEFAULT_RESOLVER is None:
        _DEFAULT_RESOLVER = CharResolver()
    return _DEFAULT_RESOLVER


def _default_lookup_char_info_by_name(name: str):
    """Find CharInfo by display name. Returns None if absent."""
    resolver = _get_resolver()
    for info in resolver.all_chars():
        if info.name == name:
            return info
    return None


def _lookup_char_info_by_name(name: str):
    """Patchable indirection for tests; production calls the default."""
    return _default_lookup_char_info_by_name(name)


def _is_damage_card(exp: CardExpectation) -> bool:
    """v1 damage-card classifier."""
    if exp is None or exp.eff_pct is None:
        return False
    desc = (exp.raw_description or "").lower()
    if "damage" not in desc:
        return False
    if exp.target_class == "self":
        return False
    return True


@functools.lru_cache(maxsize=None)
def best_damage_eff_for(char_name: str, _resolver: Optional[CharResolver] = None) -> float:
    """Max eff_pct among damage cards in char's starting + epiphany decks (level 1).
    Falls back to 100.0 when the char is unknown or has no damage card.

    _resolver: testing hook; production callers leave it None.
    """
    # Resolve via globals so tests that `del mod._lookup_char_info_by_name`
    # in teardown still leave the production code functional.
    lookup = globals().get("_lookup_char_info_by_name", _default_lookup_char_info_by_name)
    info = lookup(char_name)
    if info is None:
        return 100.0
    resolver = _resolver if _resolver is not None else _get_resolver()
    candidates: list[int] = []
    for card_id in list(info.starting_card_ids) + list(info.epiphany_card_ids):
        exp = resolver.card_expectation(card_id, level=1)
        if _is_damage_card(exp):
            candidates.append(exp.eff_pct)
    if not candidates:
        return 100.0
    return float(max(candidates))
