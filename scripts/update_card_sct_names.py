"""
One-off script: add sct_name to each card entry in api/data/game_db.json.

Usage:
    python scripts/update_card_sct_names.py <path_to_output_folder>

Example:
    python scripts/update_card_sct_names.py "C:/Users/soste/Downloads/output"
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def main(output_dir: str) -> None:
    db_path = Path(output_dir) / "db"
    game_db_path = Path(__file__).parent.parent / "api" / "data" / "game_db.json"

    if not db_path.exists():
        sys.exit(f"ERROR: db/ folder not found at {db_path}")
    if not game_db_path.exists():
        sys.exit(f"ERROR: game_db.json not found at {game_db_path}")

    # Build sct_name lookup from all card(*)@card.json files
    sct_names: dict[str, str] = {}
    card_re = re.compile(r"card\([^)]+\)@card\.json$")
    for f in db_path.iterdir():
        if not card_re.match(f.name):
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for entry in data:
            cid = entry.get("id")
            sct = entry.get("sct_name")
            if cid and sct and sct not in ("none", ""):
                sct_names[cid] = sct

    print(f"Found {len(sct_names)} sct_name mappings")

    # Update game_db.json
    bundle = json.loads(game_db_path.read_text(encoding="utf-8"))
    updated = 0
    for card_id, card_data in bundle.get("cards", {}).items():
        sct = sct_names.get(card_id)
        if sct:
            card_data["sct_name"] = sct
            updated += 1

    game_db_path.write_text(
        json.dumps(bundle, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Updated {updated} / {len(bundle.get('cards', {}))} cards in {game_db_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/update_card_sct_names.py <path_to_output_folder>")
    main(sys.argv[1])
