"""
CharResolver: in-process resolver for character + card metadata from the
deck-builder data files shipped at api/data/deck_builder_*.json.

Single instance loads both manifests once; lookups are O(1) after.
"""
import json
import re
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path


REPO = Path(__file__).resolve().parents[3]
DEFAULT_MANIFEST = REPO / "api" / "data" / "deck_builder_cards.json"
DEFAULT_VARIANTS = REPO / "api" / "data" / "deck_builder_epiphany_variants.json"


_PCT_PATTERN = re.compile(r"(\d+)\s*%")
_SCALING_PATTERN = re.compile(r"(Attack|Defense|HP|Health)-based", re.IGNORECASE)
_ALL_ENEMIES_PATTERN = re.compile(r"\b(all\s+enemies|all\s+enemy)\b", re.IGNORECASE)
_SELF_PATTERN = re.compile(r"\bself\b", re.IGNORECASE)


@dataclass(frozen=True)
class CharInfo:
    char_res_id: int
    name: str
    starting_card_ids: list[str]
    epiphany_card_ids: list[str]
    ego_card_id: str | None


@dataclass(frozen=True)
class CardExpectation:
    card_id: str
    variant_id: str | None
    level: int
    cost: int
    card_type: str | None
    eff_pct: int | None
    target_class: str | None
    scaling_stat: str | None
    raw_description: str


class CharResolver:
    def __init__(self,
                 manifest_path: Path = DEFAULT_MANIFEST,
                 variants_path: Path = DEFAULT_VARIANTS):
        self._manifest_path = Path(manifest_path)
        self._variants_path = Path(variants_path)

    @cached_property
    def _manifest(self) -> dict:
        if not self._manifest_path.exists():
            return {}
        return json.loads(self._manifest_path.read_text(encoding="utf-8"))

    @cached_property
    def _variants(self) -> dict:
        if not self._variants_path.exists():
            return {}
        return json.loads(self._variants_path.read_text(encoding="utf-8"))

    def name_for(self, char_res_id) -> str:
        key = str(char_res_id)
        entry = self._manifest.get(key)
        if entry is None:
            return f"unknown({char_res_id})"
        return entry.get("character_name", f"unknown({char_res_id})")

    def char_info(self, char_res_id) -> CharInfo | None:
        key = str(char_res_id)
        entry = self._manifest.get(key)
        if entry is None:
            return None
        starting = [c["card_id"] for c in entry.get("starting_cards", [])]
        epiphany = [c["card_id"] for c in entry.get("epiphany_cards", [])]
        ego = entry.get("ego_skill")
        return CharInfo(
            char_res_id=int(key),
            name=entry.get("character_name", f"unknown({char_res_id})"),
            starting_card_ids=starting,
            epiphany_card_ids=epiphany,
            ego_card_id=ego.get("card_id") if isinstance(ego, dict) else None,
        )

    def card_expectation(self, card_id: str, level: int = 1) -> CardExpectation | None:
        group = self._variants.get(card_id)
        if not isinstance(group, dict):
            return None
        variants = group.get("variants", [])
        chosen = None
        for v in variants:
            if int(v.get("level", 0)) == level:
                chosen = v
                break
        if chosen is None and variants:
            chosen = variants[0]
        if chosen is None:
            return None
        desc = chosen.get("description", "") or ""
        return CardExpectation(
            card_id=card_id,
            variant_id=chosen.get("variant_id"),
            level=int(chosen.get("level", 1)),
            cost=int(chosen.get("cost", 0)),
            card_type=chosen.get("card_type"),
            eff_pct=_parse_eff_pct(desc),
            target_class=_parse_target_class(desc),
            scaling_stat=_parse_scaling(desc),
            raw_description=desc,
        )

    def all_chars(self) -> list[CharInfo]:
        result: list[CharInfo] = []
        for key in self._manifest:
            info = self.char_info(key)
            if info is not None:
                result.append(info)
        return result


def _parse_eff_pct(desc: str) -> int | None:
    m = _PCT_PATTERN.search(desc)
    if m is None:
        return None
    return int(m.group(1))


def _parse_scaling(desc: str) -> str | None:
    m = _SCALING_PATTERN.search(desc)
    if m is None:
        return None
    stat = m.group(1).lower()
    if stat in ("attack",):
        return "atk"
    if stat in ("defense",):
        return "def"
    return "hp"


def _parse_target_class(desc: str) -> str | None:
    if _ALL_ENEMIES_PATTERN.search(desc):
        return "all_enemies"
    if _SELF_PATTERN.search(desc):
        return "self"
    return None
