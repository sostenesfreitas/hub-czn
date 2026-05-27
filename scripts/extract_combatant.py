"""Auto-extract a combatant entry for api/game_data/characters.py::CHARACTERS.

Reads from the unpacked client (output/):
  - db/char_base@char_base.json — display class, attribute, grade (authoritative)
  - db/char_base@char_combatant.json — base stats (authoritative)
  - db/char_base@combatant_level.json — per-level ATK/DEF/HP deltas
  - db/char_base@combatant_ascend.json — per-ascend ATK/DEF/HP deltas
  - db/potential_node@potential_node_effect.json — node_50 / node_60 stat types
  - text/en/text.json — English combatant name

Stats are reported at level=60, ascend=5 to match the convention used in
CHARACTERS (the same convention used by build_scaling_tables.py / scaling.py).

Usage:
    python scripts/extract_combatant.py <output_dir> <res_id> [<res_id> ...]

Example:
    python scripts/extract_combatant.py C:/Users/soste/Downloads/output 1055
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# link_char_growth_material_id is "c_{class_key}_{color_key}".
GROWTH_CLASS_TO_CLASS = {
    "controller": "Controller",
    "knight": "Vanguard",
    "striker": "Striker",
    "ranger": "Ranger",
    "hunter": "Hunter",
    "psionic": "Psionic",
}

GROWTH_COLOR_TO_ATTRIBUTE = {
    "orange": "Instinct",
    "blue": "Justice",
    "purple": "Void",
    "red": "Passion",
    "green": "Order",
}

RARITY_TO_GRADE = {
    "RARITY_SSR": 5,
    "RARITY_SR": 4,
    "RARITY_R": 3,
}

NODE_STAT_TYPE_TO_LABEL = {
    "hp_rate": "HP%",
    "atk_rate": "ATK%",
    "def_rate": "DEF%",
    "cri": "CRate",
    "cri_dmg_rate": "CDmg",
}

# Stats in CHARACTERS are stored at this level/ascend (matches scaling.py / optimizer).
_CANONICAL_LEVEL = 60
_CANONICAL_ASCEND = 5


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


def _parse_growth_material(growth_id: str) -> tuple[str, str]:
    parts = growth_id.split("_")
    if len(parts) != 3 or parts[0] != "c":
        raise ValueError(f"unexpected link_char_growth_material_id: {growth_id!r}")
    klass = GROWTH_CLASS_TO_CLASS.get(parts[1])
    if klass is None:
        raise ValueError(f"unmapped class key in {growth_id!r}: {parts[1]!r}")
    attr = GROWTH_COLOR_TO_ATTRIBUTE.get(parts[2])
    if attr is None:
        raise ValueError(f"unmapped color key in {growth_id!r}: {parts[2]!r}")
    return klass, attr


def _resolve_node(node_effects: list[dict], res_id: int, node_num: int) -> str | None:
    prefix = f"{res_id}{node_num:02d}"
    for row in node_effects:
        nid = str(row.get("id", ""))
        if not nid.startswith(prefix):
            continue
        stat_type = row.get("stat_type") or row.get("stat_key") or ""
        label = NODE_STAT_TYPE_TO_LABEL.get(stat_type.lower())
        if label:
            return label
    return None


def _build_level_scaling(level_rows: list[dict]) -> dict[str, dict[str, dict]]:
    """Return {group: {level_str: {ATK, DEF, HP}}} with cumulative deltas."""
    from collections import defaultdict
    by_group: dict[str, list] = defaultdict(list)
    for row in level_rows:
        by_group[row["group"]].append(row)
    out: dict[str, dict[str, dict]] = {}
    for group, rows in by_group.items():
        rows.sort(key=lambda r: int(r["level"]))
        cum_atk = cum_def = cum_hp = 0
        out[group] = {}
        for r in rows:
            cum_atk += int(r["stat1_value"])
            cum_def += int(r["stat2_value"])
            cum_hp += int(r["stat3_value"])
            out[group][r["level"]] = {"ATK": cum_atk, "DEF": cum_def, "HP": cum_hp}
    return out


def _build_ascend_scaling(ascend_rows: list[dict]) -> dict[str, list[dict]]:
    """Return {group: [cumulative {ATK, DEF, HP} per ascend index 0..N]}."""
    from collections import defaultdict
    by_group: dict[str, list] = defaultdict(list)
    for row in ascend_rows:
        by_group[row["group"]].append(row)
    out: dict[str, list[dict]] = {}
    for group, rows in by_group.items():
        rows.sort(key=lambda r: int(r["ascend"]))
        cum_atk = cum_def = cum_hp = 0
        out[group] = []
        for r in rows:
            cum_atk += int(r["stat1_value"])
            cum_def += int(r["stat2_value"])
            cum_hp += int(r["stat3_value"])
            out[group].append({"ATK": cum_atk, "DEF": cum_def, "HP": cum_hp})
    return out


def _scale_stats(
    base_atk: int, base_def: int, base_hp: int,
    level_group: str, ascend_group: str,
    level_scaling: dict, ascend_scaling: dict,
    level: int = _CANONICAL_LEVEL,
    ascend: int = _CANONICAL_ASCEND,
) -> tuple[int, int, int]:
    """Return (atk, def, hp) scaled to the requested level/ascend."""
    lvl_table = level_scaling.get(level_group, {})
    lvl_bonus = lvl_table.get(str(level), {"ATK": 0, "DEF": 0, "HP": 0})

    asc_table = ascend_scaling.get(ascend_group, [])
    if asc_table:
        eff_ascend = max(0, min(ascend, len(asc_table) - 1))
        asc_bonus = asc_table[eff_ascend]
    else:
        asc_bonus = {"ATK": 0, "DEF": 0, "HP": 0}

    return (
        base_atk + lvl_bonus["ATK"] + asc_bonus["ATK"],
        base_def + lvl_bonus["DEF"] + asc_bonus["DEF"],
        base_hp + lvl_bonus["HP"] + asc_bonus["HP"],
    )


def extract(output_dir: Path, res_id: int) -> dict:
    db = output_dir / "db"
    text_json = output_dir / "text" / "en" / "text.json"

    char_base = _index_by_id(_load_json(db / "char_base@char_base.json"))
    combatants = _index_by_id(_load_json(db / "char_base@char_combatant.json"))
    text_rows = _load_json(text_json)
    node_effects = _load_json(db / "potential_node@potential_node_effect.json")
    level_scaling = _build_level_scaling(_load_json(db / "char_base@combatant_level.json"))
    ascend_scaling = _build_ascend_scaling(_load_json(db / "char_base@combatant_ascend.json"))

    base_row = char_base.get(str(res_id))
    if base_row is None:
        raise KeyError(f"res_id {res_id} not found in char_base@char_base.json")
    stat_row = combatants.get(str(res_id))
    if stat_row is None:
        raise KeyError(f"res_id {res_id} not found in char_base@char_combatant.json")

    name = _name_from_text_json(text_rows, res_id)
    if name is None:
        raise KeyError(f"no English name for res_id {res_id} in text.json")

    klass, attribute = _parse_growth_material(base_row["link_char_growth_material_id"])

    grade = RARITY_TO_GRADE.get(base_row["rarity"])
    if grade is None:
        raise ValueError(f"unmapped rarity: {base_row['rarity']!r}")

    raw_atk = int(stat_row["s_atk"])
    raw_def = int(stat_row["s_def"])
    raw_hp = int(stat_row["s_hp"])
    level_group = stat_row["link_combatant_level_group"]
    ascend_group = stat_row["link_combatant_ascend_group"]

    scaled_atk, scaled_def, scaled_hp = _scale_stats(
        raw_atk, raw_def, raw_hp,
        level_group, ascend_group,
        level_scaling, ascend_scaling,
    )

    entry = {
        "name": name,
        "grade": grade,
        "attribute": attribute,
        "class": klass,
        "base_atk": scaled_atk,
        "base_def": scaled_def,
        "base_hp": scaled_hp,
        "base_crit_rate": float(stat_row["s_cri"]),
        "base_crit_dmg": float(stat_row["s_cri_dmg_rate"]),
        "base_weak_ego_dmg_rate": float(stat_row["s_weak_ego_dmg_rate"]),
        "node_50": _resolve_node(node_effects, res_id, 50),
        "node_60": _resolve_node(node_effects, res_id, 60),
    }
    return entry


def _format_entry(res_id: int, entry: dict) -> str:
    lines = [f"    {res_id}: {{"]
    for key in ("name", "grade", "attribute", "class", "base_atk", "base_def",
                "base_hp", "base_crit_rate", "base_crit_dmg",
                "base_weak_ego_dmg_rate", "node_50", "node_60"):
        value = entry[key]
        lines.append(f"        {key!r}: {value!r},")
    lines.append("    },")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python scripts/extract_combatant.py <output_dir> <res_id> [<res_id> ...]",
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
