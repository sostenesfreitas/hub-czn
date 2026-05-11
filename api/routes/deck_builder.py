from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.routes.cards import CardEntry, _get_library

router = APIRouter()

_MANIFEST_PATH = Path(__file__).resolve().parents[1] / "data" / "deck_builder_cards.json"
_EPIPHANY_VARIANTS_PATH = Path(__file__).resolve().parents[1] / "data" / "deck_builder_epiphany_variants.json"

class DeckBuilderCardManifestItem(BaseModel):
    card_id: str
    copies: int = 1
    name_override: str | None = None


class DeckBuilderCombatantManifest(BaseModel):
    character_name: str | None = None
    starting_cards: list[DeckBuilderCardManifestItem] = []
    epiphany_cards: list[DeckBuilderCardManifestItem] = []
    ego_skill: DeckBuilderCardManifestItem | None = None

class DeckBuilderCard(BaseModel):
    card: CardEntry
    copies: int
    group: Literal["starting", "epiphany", "ego"]
    variants: list[DeckBuilderEpiphanyVariant] = []

class DeckBuilderCombatantResponse(BaseModel):
    char_res_id: int
    character_name: str | None = None
    starting_cards: list[DeckBuilderCard]
    epiphany_cards: list[DeckBuilderCard]
    ego_skill: DeckBuilderCard | None
    missing_card_ids: list[str]

class DeckBuilderEpiphanyVariant(BaseModel):
    variant_id: str
    level: int
    name: str
    cost: int
    card_type: str | None = None
    tags: list[str] = []
    description: str

class DeckBuilderEpiphanyVariantGroup(BaseModel):
    character_id: int
    character_name: str
    base_card_id: str
    base_card_name: str
    variants: list[DeckBuilderEpiphanyVariant] = []

def _load_manifest() -> dict[str, DeckBuilderCombatantManifest]:
    if not _MANIFEST_PATH.exists():
        return {}

    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))

    return {
        str(char_res_id): DeckBuilderCombatantManifest(**config)
        for char_res_id, config in raw.items()
    }

def _copy_card_with_name_override(card: CardEntry, name_override: str | None) -> CardEntry:
    if not name_override:
        return card

    try:
        return card.model_copy(update={"name": name_override})
    except AttributeError:
        return card.copy(update={"name": name_override})

def _load_epiphany_variants() -> dict[str, DeckBuilderEpiphanyVariantGroup]:
    if not _EPIPHANY_VARIANTS_PATH.exists():
        return {}

    raw = json.loads(_EPIPHANY_VARIANTS_PATH.read_text(encoding="utf-8"))

    return {
        str(card_id): DeckBuilderEpiphanyVariantGroup(**config)
        for card_id, config in raw.items()
    }

def _resolve_manifest_items(
    items: list[DeckBuilderCardManifestItem],
    group: Literal["starting", "epiphany", "ego"],
    cards_by_id: dict[str, CardEntry],
    variants_by_card_id: dict[str, DeckBuilderEpiphanyVariantGroup],
    missing_card_ids: list[str],
) -> list[DeckBuilderCard]:
    result: list[DeckBuilderCard] = []

    for item in items:
        card = cards_by_id.get(item.card_id)

        if card is None:
            missing_card_ids.append(item.card_id)
            continue

        variant_group = variants_by_card_id.get(item.card_id)

        result.append(
            DeckBuilderCard(
                card=_copy_card_with_name_override(card, item.name_override),
                copies=item.copies,
                group=group,
                variants=variant_group.variants if variant_group else [],
            )
        )

    return result


@router.get("/deck-builder/combatants/{char_res_id}", response_model=DeckBuilderCombatantResponse)
def get_deck_builder_combatant(char_res_id: int):
    manifest = _load_manifest()
    config = manifest.get(str(char_res_id))
    variants_by_card_id = _load_epiphany_variants()

    if config is None:
        raise HTTPException(
            status_code=404,
            detail=f"Deck builder manifest not found for char_res_id {char_res_id}",
        )

    library = _get_library()
    cards_by_id = {card.card_id: card for card in library}

    missing_card_ids: list[str] = []

    starting_cards = _resolve_manifest_items(
        config.starting_cards,
        "starting",
        cards_by_id,
        variants_by_card_id,
        missing_card_ids,
    )

    epiphany_cards = _resolve_manifest_items(
        config.epiphany_cards,
        "epiphany",
        cards_by_id,
        variants_by_card_id,
        missing_card_ids,
    )

    ego_skill = None
    if config.ego_skill is not None:
        resolved_ego = _resolve_manifest_items(
            [config.ego_skill],
            "ego",
            cards_by_id,
            variants_by_card_id,
            missing_card_ids,
        )
        ego_skill = resolved_ego[0] if resolved_ego else None

    return DeckBuilderCombatantResponse(
        char_res_id=char_res_id,
        character_name=config.character_name,
        starting_cards=starting_cards,
        epiphany_cards=epiphany_cards,
        ego_skill=ego_skill,
        missing_card_ids=missing_card_ids,
    )