from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from urllib.request import urlopen

API_BASE = "http://127.0.0.1:7842"
OUTPUT_PATH = Path("api/data/deck_builder_cards.json")

def normalize(value: str) -> str:
    value = value.strip().casefold()
    value = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in value if unicodedata.category(ch) != "Mn")


def get_json(path: str):
    with urlopen(f"{API_BASE}{path}") as response:
        return json.loads(response.read().decode("utf-8"))


def card_sort_key(card: dict) -> tuple[int, int, str]:
    card_id = card.get("card_id", "")

    start_match = re.search(r"_srt(\d+)$", card_id)
    if start_match:
        return (1, int(start_match.group(1)), card_id)

    epiphany_match = re.search(r"_uni(\d+)$", card_id)
    if epiphany_match:
        return (2, int(epiphany_match.group(1)), card_id)

    if re.search(r"_eps$", card_id):
        return (3, 0, card_id)

    return (99, 0, card_id)


def to_manifest_item(card: dict) -> dict:
    return {
        "card_id": card["card_id"],
    }


def main() -> None:
    cards = get_json("/api/cards")
    characters = get_json("/api/cards/characters")

    characters = sorted(
        characters,
        key=lambda character: normalize(character.get("name") or str(character.get("char_res_id"))),
    )

    manifest: dict[str, dict] = {}
    summary: list[tuple[str, int, int, int, str]] = []

    for character in characters:
        char_res_id = int(character["char_res_id"])
        character_name = character.get("name") or str(char_res_id)

        character_cards = [
            card
            for card in cards
            if str(card.get("char_res_id")) == str(char_res_id)
        ]

        starting_cards = sorted(
            [
                card
                for card in character_cards
                if re.search(r"_srt\d+$", card.get("card_id", ""))
            ],
            key=card_sort_key,
        )

        epiphany_cards = sorted(
            [
                card
                for card in character_cards
                if re.search(r"_uni\d+$", card.get("card_id", ""))
            ],
            key=card_sort_key,
        )

        ego_cards = sorted(
            [
                card
                for card in character_cards
                if re.search(r"_eps$", card.get("card_id", ""))
            ],
            key=card_sort_key,
        )

        manifest[str(char_res_id)] = {
            "character_name": character_name,
            "starting_cards": [to_manifest_item(card) for card in starting_cards],
            "epiphany_cards": [to_manifest_item(card) for card in epiphany_cards],
            "ego_skill": to_manifest_item(ego_cards[0]) if ego_cards else None,
        }

        summary.append(
            (
                character_name,
                char_res_id,
                len(starting_cards),
                len(epiphany_cards),
                "yes" if ego_cards else "no",
            )
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Manifest generated: {OUTPUT_PATH}")
    print()
    print(f"{'Character':<28} {'ID':<8} {'Start':<7} {'Epiphany':<9} {'Ego'}")
    print("-" * 62)

    for character_name, char_res_id, starting_count, epiphany_count, has_ego in summary:
        print(
            f"{character_name:<28} "
            f"{char_res_id:<8} "
            f"{starting_count:<7} "
            f"{epiphany_count:<9} "
            f"{has_ego}"
        )


if __name__ == "__main__":
    main()