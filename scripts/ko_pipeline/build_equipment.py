"""Merge the raw equipment catalog + translations into deck-builder-items.json.

Output shape keeps the fields the deck-builder consumes (id, name, rarity,
slot, image_path, tags) and replaces `description` with a bilingual
{en, pt-BR} object.

CLI:
    python -m scripts.ko_pipeline.build_equipment
"""
from __future__ import annotations

import json
from pathlib import Path

_REPO = Path(__file__).parent.parent.parent
_RAW = Path(__file__).parent / "data" / "equipment_catalog.raw.json"
_TRANSLATIONS = Path(__file__).parent / "data" / "equipment_translations.json"
_OUT = _REPO / "src" / "pages" / "deck-builder" / "data" / "deck-builder-items.json"

# A broken official-EN description reads literally "unused" in the game data.
_BROKEN_EN = {"", "unused"}

# Three game-data entries have corrupt source text (unbalanced markup) that the
# de-templatizer cannot clean. Their English is hand-authored here; applied only
# when residual markup is still present (so a future game-data fix is not overridden).
_CORRUPT_EN_OVERRIDE = {
    "eq_pub_021": "When taking damage, recover X% of Max HP (once per turn).",
    "eq_pub_028": "At the end of battle, if HP is 50% or less, recover X% of Max HP.",
    "eq_ds01_006": "When an ally uses a Forbidden Card, recover X% of Max HP and gain X% Fixed Shield.",
}


def build_items(
    catalog: list[dict],
    translations: dict[str, str],
    old_images: dict[str, str],
) -> list[dict]:
    """Build the final deck-builder item list."""
    items: list[dict] = []
    for e in catalog:
        pt = translations.get(e["id"], "")
        en = e["desc_en"]
        if en.strip().lower() in _BROKEN_EN:
            en = pt  # fall back to the pt-BR (KO-derived) text
        if "#" in en or "$" in en:
            # residual markup survived — corrupt source; use the hand-authored English
            en = _CORRUPT_EN_OVERRIDE.get(e["id"], en)
        items.append(
            {
                "id": e["id"],
                "name": e["name"]["en"],
                "rarity": e["rarity"],
                "slot": e["slot"],
                "tags": [],
                "description": {"en": en, "pt-BR": pt},
                "image_path": old_images.get(e["name"]["en"], ""),
            }
        )
    return items


def _old_images_by_name() -> dict[str, str]:
    """Map old wiki item name -> image_path, read before overwriting the file."""
    if not _OUT.exists():
        return {}
    old = json.loads(_OUT.read_text(encoding="utf-8"))
    return {
        it["name"]: it["image_path"]
        for it in old
        if isinstance(it, dict) and it.get("name") and it.get("image_path")
    }


def main() -> None:
    catalog = json.loads(_RAW.read_text(encoding="utf-8"))
    translations = json.loads(_TRANSLATIONS.read_text(encoding="utf-8"))
    old_images = _old_images_by_name()
    items = build_items(catalog, translations, old_images)
    _OUT.write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {_OUT} ({len(items)} items)")


if __name__ == "__main__":
    main()
