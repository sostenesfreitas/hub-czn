"""Auto-extract a partner entry for api/game_data/partners.py::PARTNERS.

This is *assisted* extraction. Class, grade, name, ego_name and ego_cost
are auto-resolved. passive_name / passive_desc / values / stats / ego_desc
are emitted as a best-effort scaffold marked with `# TODO: review` so the
human curator can polish before paste.

Usage:
    python scripts/extract_partner.py <output_dir> <res_id> [<res_id> ...]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

GROWTH_MATERIAL_TO_CLASS = {
    "s_controller": "Controller",
    "s_hunter": "Hunter",
    "s_ranger": "Ranger",
    "s_striker": "Striker",
    "s_knight": "Vanguard",
    "s_psionic": "Psionic",
}

RARITY_TO_GRADE = {
    "RARITY_SSR": 5,
    "RARITY_SR": 4,
    "RARITY_R": 3,
}


def _load_json(path: Path) -> list | dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _index_by_id(rows: list[dict]) -> dict[str, dict]:
    return {str(r["id"]): r for r in rows if "id" in r}


def _name_from_text_json(text_rows: list[dict], res_id: int) -> str | None:
    key = f"char_base@name@{res_id}"
    for row in text_rows:
        if row.get("id") == key:
            return row.get("text")
    return None


def _text_lookup(text_rows: list[dict], key: str) -> str | None:
    for row in text_rows:
        if row.get("id") == key:
            return row.get("text")
    return None


def extract(output_dir: Path, res_id: int) -> dict:
    db = output_dir / "db"
    text_json = output_dir / "text" / "en" / "text.json"

    char_base = _index_by_id(_load_json(db / "partner_base@char_base.json"))
    char_partner = _index_by_id(_load_json(db / "partner_base@char_partner.json"))
    text_rows = _load_json(text_json)

    base_row = char_base.get(str(res_id))
    partner_row = char_partner.get(str(res_id))
    if base_row is None or partner_row is None:
        raise KeyError(f"res_id {res_id} missing from partner_base tables")

    name = _name_from_text_json(text_rows, res_id)
    if name is None:
        raise KeyError(f"no English name for partner res_id {res_id}")

    growth = base_row.get("link_char_growth_material_id", "")
    klass = GROWTH_MATERIAL_TO_CLASS.get(growth)
    if klass is None:
        raise ValueError(f"unmapped growth material: {growth!r}")

    grade = RARITY_TO_GRADE.get(base_row.get("rarity", ""))
    if grade is None:
        raise ValueError(f"unmapped rarity: {base_row.get('rarity')!r}")

    passive_group = partner_row.get("link_partner_passive_group", "")
    passive_name = _text_lookup(text_rows, f"partner_passive@name@{passive_group}") or "TODO: passive name"
    passive_desc = _text_lookup(text_rows, f"partner_passive@desc@{passive_group}") or "TODO: passive desc"

    cs_link = partner_row.get("link_card_id", "")
    ego_name = _text_lookup(text_rows, f"card@name@{cs_link}") or "TODO: ego name"
    ego_desc = _text_lookup(text_rows, f"card@desc@{cs_link}") or "TODO: ego desc"

    entry = {
        "name": name,
        "grade": grade,
        "class": klass,
        "passive_name": passive_name,
        "passive_desc": passive_desc,
        "values": {},
        "stats": {},
        "ego_name": ego_name,
        "ego_cost": 3,  # default; review against card@cost
        "ego_desc": ego_desc,
    }
    return entry


def _format_entry(res_id: int, entry: dict) -> str:
    lines = [f"    {res_id}: {{  # TODO: review passive_desc, values, stats, ego_cost, ego_desc"]
    for key in ("name", "grade", "class", "passive_name", "passive_desc",
                "values", "stats", "ego_name", "ego_cost", "ego_desc"):
        value = entry[key]
        lines.append(f"        {key!r}: {value!r},")
    lines.append("    },")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python scripts/extract_partner.py <output_dir> <res_id> [<res_id> ...]",
              file=sys.stderr)
        return 2
    output_dir = Path(argv[1])
    for raw in argv[2:]:
        res_id = int(raw)
        entry = extract(output_dir, res_id)
        print(_format_entry(res_id, entry))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
