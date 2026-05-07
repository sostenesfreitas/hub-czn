#!/usr/bin/env python3
"""Extract character lookup table from desktop game_data into Android asset."""
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from game_data.characters import CHARACTERS
from game_data.partners import PARTNERS

lookup = {}

for res_id, data in CHARACTERS.items():
    if data is None:
        continue
    name = data.get("name", "")
    if name:
        lookup[name] = {
            "res_id": res_id,
            "rarity": data.get("grade", 3),
            "kind": "Combatant"
        }

for res_id, data in PARTNERS.items():
    if data is None:
        continue
    name = data.get("name", "")
    if name:
        lookup[name] = {
            "res_id": res_id,
            "rarity": data.get("grade", 3),
            "kind": "Partner"
        }

out_path = os.path.join(
    os.path.dirname(__file__), "..", "android-app", "app", "src", "main", "assets", "characters.json"
)
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(lookup, f, ensure_ascii=False, indent=2)

print(f"Written {len(lookup)} characters to {out_path}")
