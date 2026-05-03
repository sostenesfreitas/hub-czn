from __future__ import annotations

import re
from fastapi import APIRouter
from pydantic import BaseModel

import api.utils.game_db as game_db

router = APIRouter()

_CHAR_RE = re.compile(r"^c_(\d+)_")
_RSP_RE = re.compile(r"^rsp\d+_(.+)$")

_EFFECT_LABELS: dict[str, str] = {
    "SKILL_EFF_DMG":                    "DMG",
    "SKILL_EFF_CARD_DRAW":              "Draw",
    "SKILL_EFF_CARD_DRAW_WHILE_UNIQUE": "Draw",
    "SKILL_EFF_CARD_COST_CHANGE":       "Cost",
    "SKILL_EFF_CARD_DISCARD":           "Discard",
    "SKILL_EFF_CARD_EXHAUST":           "Exhaust",
    "SKILL_EFF_CARD_GET":               "Get",
    "SKILL_EFF_BUFF_TYPE_CS_SET_ADD":   "Buff",
    "SKILL_EFF_CARD_CHANGE":            "Change",
    "SKILL_EFF_CARD_USE":               "Use",
    "SKILL_EFF_CARD_COPY_TO":           "Copy",
}


class CardEntry(BaseModel):
    card_id: str
    char_res_id: int | None
    name: str
    cost: int
    eff_value: int
    hits: int
    spark_count: int
    effect_types: list[str]


def _build_library() -> list[CardEntry]:
    db = game_db.get()
    cards = db.get("cards", {})
    effects = db.get("effects", {})
    rsparks = db.get("rsparks", {})
    names = db.get("names", {})

    # Cards that are spark-upgraded versions of base cards
    spark_variants: set[str] = set(rsparks.values())

    # How many spark tiers each base card has
    spark_count: dict[str, int] = {}
    for rsp_id in rsparks:
        m = _RSP_RE.match(rsp_id)
        if m:
            base = m.group(1)
            spark_count[base] = spark_count.get(base, 0) + 1

    result: list[CardEntry] = []
    for card_id, card in cards.items():
        if card_id in spark_variants:
            continue  # skip spark variants

        m = _CHAR_RE.match(card_id)
        char_res_id = int(m.group(1)) if m else None

        total_eff = 0
        total_hits = 0
        seen_types: list[str] = []
        for eid in card.get("link_skill_eff_id", []):
            eff = effects.get(eid, {})
            eff_type = eff.get("eff", "")
            label = _EFFECT_LABELS.get(eff_type)
            if label and label not in seen_types:
                seen_types.append(label)
            if eff_type == "SKILL_EFF_DMG":
                total_eff += eff.get("eff_value", 0)
                total_hits += eff.get("eff_count_value", 0)

        result.append(CardEntry(
            card_id=card_id,
            char_res_id=char_res_id,
            name=names.get(f"card@name@{card_id}", ""),
            cost=card.get("cost", 0),
            eff_value=total_eff,
            hits=total_hits,
            spark_count=spark_count.get(card_id, 0),
            effect_types=seen_types,
        ))

    result.sort(key=lambda c: (c.char_res_id or 0, c.card_id))
    return result


_library_cache: list[CardEntry] | None = None


def _get_library() -> list[CardEntry]:
    global _library_cache
    if _library_cache is None:
        _library_cache = _build_library()
    return _library_cache


@router.get("/cards", response_model=list[CardEntry])
def get_cards(char_res_id: int | None = None):
    library = _get_library()
    if char_res_id is not None:
        return [c for c in library if c.char_res_id == char_res_id]
    return library


@router.get("/cards/characters", response_model=list[dict])
def get_card_characters():
    """Return list of {char_res_id, name} that have cards in the library."""
    db = game_db.get()
    names = db.get("names", {})
    library = _get_library()

    seen: dict[int, str] = {}
    for card in library:
        if card.char_res_id and card.char_res_id not in seen:
            name = names.get(f"char_base@name@{card.char_res_id}", str(card.char_res_id))
            seen[card.char_res_id] = name

    return [{"char_res_id": k, "name": v} for k, v in sorted(seen.items(), key=lambda x: x[1])]
