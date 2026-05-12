"""Best-damage-card eff_pct sampler used by the optimizer.

Sprint 2f4: v2 classifier uses EffInstanceIndex (the authoritative source for
'this card has a damage-firing skill_eff') instead of string-matching 'damage'
in card descriptions. The 4 fallback chars from v1 (Adelheid, Mei Lin, Narja,
Nia) get correct eff_pct under v2.

v1 string-match classifier kept as fallback when EffInstanceIndex is None
(e.g., synth tests without client_db).
"""
import functools
from pathlib import Path
from typing import Optional

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.replay.char_resolver import CardExpectation, CharResolver


_CLIENT_DB_DEFAULT = Path(r"C:\Users\soste\Downloads\output\db")

_DAMAGE_EFF_TYPES = (
    "SKILL_EFF_DMG",
    "SKILL_EFF_DMG_IGNORE_COND",
    "SKILL_EFF_DMG_COOP",
)


_DEFAULT_RESOLVER: Optional[CharResolver] = None
_DEFAULT_EFF_INDEX: Optional[EffInstanceIndex] = None


def _get_resolver() -> CharResolver:
    global _DEFAULT_RESOLVER
    if _DEFAULT_RESOLVER is None:
        _DEFAULT_RESOLVER = CharResolver()
    return _DEFAULT_RESOLVER


def _get_default_eff_index() -> Optional[EffInstanceIndex]:
    """Lazy-load the default EffInstanceIndex from the hardcoded CLIENT_DB path.
    Returns None if the path doesn't exist (e.g., on a fresh dev machine)."""
    global _DEFAULT_EFF_INDEX
    if _DEFAULT_EFF_INDEX is None and _CLIENT_DB_DEFAULT.exists():
        _DEFAULT_EFF_INDEX = EffInstanceIndex(_CLIENT_DB_DEFAULT)
    return _DEFAULT_EFF_INDEX


def _default_lookup_char_info_by_name(name: str):
    resolver = _get_resolver()
    for info in resolver.all_chars():
        if info.name == name:
            return info
    return None


def _lookup_char_info_by_name(name: str):
    """Patchable for tests; production calls the default."""
    fn = globals().get("_lookup_char_info_by_name_override")
    if fn is None:
        return _default_lookup_char_info_by_name(name)
    return fn(name)


def _is_damage_card(exp: CardExpectation) -> bool:
    """v1 classifier (fallback). String-match 'damage' in description."""
    if exp is None or exp.eff_pct is None:
        return False
    desc = (exp.raw_description or "").lower()
    if "damage" not in desc:
        return False
    if exp.target_class == "self":
        return False
    return True


@functools.lru_cache(maxsize=1)
def _damage_card_ids_via_eff_index(eff_index: EffInstanceIndex) -> frozenset:
    """Build a set of card_ids whose skill_eff instances fire damage."""
    card_ids = set()
    for eff_type in _DAMAGE_EFF_TYPES:
        for inst in eff_index.by_type(eff_type):
            inst_id = inst.id
            if "_" not in inst_id:
                continue
            card_id = inst_id.rsplit("_", 1)[0]
            card_ids.add(card_id)
    return frozenset(card_ids)


def _is_damage_card_v2(card_id: str, damage_card_ids: frozenset,
                        exp: CardExpectation) -> bool:
    """v2 classifier: card_id is in the EffInstanceIndex-derived set."""
    if exp is None or exp.eff_pct is None:
        return False
    if exp.target_class == "self":
        return False
    return card_id in damage_card_ids


@functools.lru_cache(maxsize=None)
def best_damage_eff_for(char_name: str,
                        _resolver: Optional[CharResolver] = None,
                        _eff_index: Optional[EffInstanceIndex] = None) -> float:
    """Max eff_pct among damage cards in char's starting + epiphany decks.
    Falls back to 100.0 when char is unknown or has no damage card.

    Sprint 2f4: uses EffInstanceIndex-based classifier when available;
    falls back to v1 string match otherwise.
    """
    info = _lookup_char_info_by_name(char_name)
    if info is None:
        return 100.0
    resolver = _resolver if _resolver is not None else _get_resolver()
    eff_index = _eff_index if _eff_index is not None else _get_default_eff_index()

    damage_card_ids = _damage_card_ids_via_eff_index(eff_index) if eff_index else None

    candidates: list[int] = []
    for card_id in list(info.starting_card_ids) + list(info.epiphany_card_ids):
        exp = resolver.card_expectation(card_id, level=1)
        if exp is None or exp.eff_pct is None:
            continue
        if damage_card_ids is not None:
            if _is_damage_card_v2(card_id, damage_card_ids, exp):
                candidates.append(exp.eff_pct)
        else:
            if _is_damage_card(exp):
                candidates.append(exp.eff_pct)
    if not candidates:
        return 100.0
    return float(max(candidates))
