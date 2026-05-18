"""Extract the equipment relic catalog from the game's db + text files.

Reads `db/relic@relic.json` and `text/{ko,en}/text.json`, keeps the
weapon/armor/accessory equipment relics, resolves their bilingual name and
description, de-templatizes the descriptions, and returns a raw catalog.

CLI:
    python -m scripts.ko_pipeline.extract_equipment <output_dir>
writes scripts/ko_pipeline/data/equipment_catalog.raw.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from scripts.ko_pipeline.detemplatize import detemplatize

_SLOT_BY_TYPE = {
    "EQUIP_WEAPON": "Weapon",
    "EQUIP_ARMOR": "Armor",
    "EQUIP_ACC": "Accessory",
}
_RARITY = {
    "RARITY_COMMON": "Common",
    "RARITY_RARE": "Rare",
    "RARITY_LEGEND": "Legendary",
    "RARITY_UNIQUE": "Unique",
}


def _load_text(path: Path) -> dict[str, str]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {e["id"]: e.get("text", "") for e in data if isinstance(e, dict) and "id" in e}


def extract_equipment(
    relic_path: Path,
    text_ko_path: Path,
    text_en_path: Path,
) -> list[dict]:
    """Return the raw equipment catalog (one dict per equipment relic)."""
    relics = json.loads(Path(relic_path).read_text(encoding="utf-8"))
    ko = _load_text(text_ko_path)
    en = _load_text(text_en_path)

    catalog: list[dict] = []
    for r in relics:
        slot = _SLOT_BY_TYPE.get(r.get("relic_type", ""))
        if slot is None:
            continue  # RELIC-type rows have no deck slot — skip

        name_key = r.get("name", "")
        desc_key = r.get("s1_description", "")
        desc_ko, jargon_ko = detemplatize(ko.get(desc_key, ""))
        desc_en, jargon_en = detemplatize(en.get(desc_key, ""))

        catalog.append(
            {
                "id": r["id"],
                "slot": slot,
                "rarity": _RARITY.get(r.get("rarity", ""), "Rare"),
                "icon_name": r.get("icon_name", ""),
                "name": {"en": en.get(name_key, ""), "pt-BR": ko.get(name_key, "")},
                "desc_en": desc_en,
                "desc_ko": desc_ko,
                "jargon_en": jargon_en,
                "jargon_ko": jargon_ko,
            }
        )
    return catalog


def main(output_dir: str) -> None:
    output = Path(output_dir)
    catalog = extract_equipment(
        relic_path=output / "db" / "relic@relic.json",
        text_ko_path=output / "text" / "ko" / "text.json",
        text_en_path=output / "text" / "en" / "text.json",
    )
    out = Path(__file__).parent / "data" / "equipment_catalog.raw.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {out} ({len(catalog)} equipment relics)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m scripts.ko_pipeline.extract_equipment <output_dir>")
    main(sys.argv[1])
