"""Extract a character's card illustrations from the unpacked game dump.

For each `c_<res_id>_*` card in api/data/game_db.json we read its `sct_name`
(e.g. `unique_1069_01`), copy `card_illustration/<sct_name>.png` from the dump,
convert it to webp, and write it as `<card_id>.webp` under the deck-builder
combatants folder. The card_id -> path mapping is appended to
deck-builder-card-images.ts so getCardImageUrl() resolves it.

Usage:
    python scripts/extract_card_art.py <dump_dir> <res_id> <char_folder>

Example:
    python scripts/extract_card_art.py C:/Users/soste/Downloads/output 1069 tenebria
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
GAME_DB = REPO_ROOT / "api" / "data" / "game_db.json"
COMBATANTS = REPO_ROOT / "src" / "pages" / "deck-builder" / "data" / "combatants"
MAPPING_TS = REPO_ROOT / "src" / "pages" / "deck-builder" / "data" / "deck-builder-card-images.ts"


def load_cards() -> dict:
    db = json.loads(GAME_DB.read_text(encoding="utf-8"))
    data = db.get("data", db)
    return data.get("cards", db.get("cards", {}))


def tenebria_cards(cards: dict, res_id: int) -> dict[str, str]:
    """Return {card_id: sct_name} for base (non `_pot`) cards of res_id."""
    out: dict[str, str] = {}
    pat = re.compile(rf"^c_{res_id}_")
    for card_id, entry in cards.items():
        if not pat.match(card_id):
            continue
        if card_id.endswith("_pot"):
            continue
        sct = entry.get("sct_name")
        if sct:
            out[card_id] = sct
    return out


def extract(dump_dir: Path, res_id: int, char_folder: str) -> int:
    cards = load_cards()
    wanted = tenebria_cards(cards, res_id)
    if not wanted:
        print(f"No cards found for res_id {res_id} in game_db.json", file=sys.stderr)
        return 2

    dst_dir = COMBATANTS / char_folder
    dst_dir.mkdir(parents=True, exist_ok=True)

    mapping: dict[str, str] = {}
    missing: list[str] = []
    for card_id, sct in sorted(wanted.items()):
        src = dump_dir / "card_illustration" / f"{sct}.png"
        if not src.exists():
            missing.append(f"{card_id} -> card_illustration/{sct}.png")
            continue
        out_name = f"{card_id}.webp"
        Image.open(src).convert("RGBA").save(dst_dir / out_name, "WEBP", quality=90)
        mapping[card_id] = f"combatants/{char_folder}/{out_name}"

    update_mapping(mapping)
    print(f"  copied {len(mapping)} card images to {dst_dir}")
    for m in missing:
        print(f"    [MISSING] {m}")
    return 0


def update_mapping(new_entries: dict[str, str]) -> None:
    """Insert/replace entries in DECK_BUILDER_CARD_IMAGE_BY_ID, keeping it sorted."""
    text = MAPPING_TS.read_text(encoding="utf-8")
    # Only parse entries inside the object body so we never pick up the
    # `Record<string, string>` type annotation or any other stray quoted pairs.
    body_match = re.search(r"\{(.*)\}", text, re.DOTALL)
    body_text = body_match.group(1) if body_match else text
    existing: dict[str, str] = dict(re.findall(r'"([^"]+)":\s*"([^"]+)"', body_text))
    before = len(existing)
    existing.update(new_entries)
    added = len(existing) - before
    lines = [f'  "{k}": "{v}",' for k, v in sorted(existing.items())]
    body = "\n".join(lines)
    MAPPING_TS.write_text(
        "export const DECK_BUILDER_CARD_IMAGE_BY_ID: Record<string, string> = {\n"
        f"{body}\n}}\n",
        encoding="utf-8",
    )
    print(f"  mapping: {before} existing entries, +{added} new, {len(existing)} total")


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print("Usage: python scripts/extract_card_art.py <dump_dir> <res_id> <char_folder>",
              file=sys.stderr)
        return 2
    dump_dir = Path(argv[1])
    if not dump_dir.exists():
        print(f"dump_dir not found: {dump_dir}", file=sys.stderr)
        return 2
    return extract(dump_dir, int(argv[2]), argv[3])


if __name__ == "__main__":
    sys.exit(main(sys.argv))
