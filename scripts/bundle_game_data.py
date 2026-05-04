"""
Bundle relevant game DB data into api/data/game_db.json.

Usage:
    python scripts/bundle_game_data.py <path_to_output_folder>

Example:
    python scripts/bundle_game_data.py "C:/Users/soste/Downloads/output"

The output folder must contain:
    db/          — game database JSON files
    text/en/text.json — localisation strings
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def _parse_list(raw: str) -> list[str]:
    raw = raw.strip()
    if raw in ("[]", "none", ""):
        return []
    return [x.strip() for x in raw.strip("[]").split(",") if x.strip()]


def load_card_data(db: Path) -> tuple[dict, dict, dict]:
    cards: dict = {}
    effects: dict = {}
    rsparks: dict = {}

    card_re = re.compile(r"card\([^)]+\)@card\.json$")
    eff_re = re.compile(r"card\([^)]+\)@skill_eff\.json$")
    rspark_re = re.compile(r"card\([^)]+\)@card_r_spark\.json$")

    for f in db.iterdir():
        if f.suffix != ".json":
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                continue
        except Exception:
            continue

        name = f.name
        if card_re.match(name):
            for e in data:
                cid = e.get("id")
                if cid:
                    sct = e.get("sct_name", "")
                    spine = e.get("spine_model", "")
                    image_ref = (sct if sct and sct != "none" else None) or (spine if spine and spine != "none" else None)
                    cards[cid] = {
                        "cost": int(e.get("cost", 0)),
                        "link_skill_eff_id": _parse_list(e.get("link_skill_eff_id", "[]")),
                        "sort": e.get("sort", ""),
                        "sct_name": image_ref,
                    }
        elif eff_re.match(name):
            for e in data:
                eid = e.get("id")
                if eid:
                    effects[eid] = {
                        "eff": e.get("eff", ""),
                        "eff_value": int(float(e.get("eff_value", 0))),
                        "eff_count_value": int(float(e.get("eff_count_value", 1))),
                    }
        elif rspark_re.match(name):
            for e in data:
                rid = e.get("id")
                if rid:
                    rsparks[rid] = e.get("change_link_card_id", "")

    return cards, effects, rsparks


def load_char_base(db: Path) -> dict:
    path = db / "char_base@char_combatant.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {
            str(e["id"]): {
                "s_atk": int(e.get("s_atk", 0)),
                "s_def": int(e.get("s_def", 0)),
                "s_hp": int(e.get("s_hp", 0)),
                "s_cri": int(e.get("s_cri", 0)),
                "s_cri_dmg_rate": int(e.get("s_cri_dmg_rate", 125)),
            }
            for e in data if "id" in e
        }
    except Exception as exc:
        print(f"  [warn] could not read char_combatant: {exc}")
        return {}


def load_names(text_json: Path, card_ids: set[str], char_ids: set[str]) -> dict[str, str]:
    """Extract only the entries we need from the 14 MB text.json."""
    wanted_prefixes = ("card@name@", "char_base@name@", "monster@name@")
    names: dict[str, str] = {}
    try:
        data = json.loads(text_json.read_text(encoding="utf-8"))
        for e in data:
            key = e.get("id", "")
            if any(key.startswith(p) for p in wanted_prefixes):
                text = e.get("text", "").strip()
                if text:
                    names[key] = text
    except Exception as exc:
        print(f"  [warn] could not read text.json: {exc}")
    return names


def load_node_effects(db: Path) -> dict:
    """Load potential node effects relevant to card damage simulation."""
    p = db / "potential_node@potential_node_effect.json"
    if not p.exists():
        print("  [warn] potential_node@potential_node_effect.json not found")
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  [warn] could not read node effects: {exc}")
        return {}

    relevant = {
        "NODE_CARD_R_SPARK", "NODE_REINFORCE_CARD_START",
        "NODE_REINFORCE_CARD_NEUTRAL", "NODE_REINFORCE_CARD_UNIQUE",
        "NODE_STAT_ADD_SKILL_EFF_VALUE",
    }
    result: dict = {}
    for e in data:
        ntype = e.get("node_type", "")
        if ntype not in relevant:
            continue
        nid = e.get("id", "")
        if not nid:
            continue
        check_raw = e.get("check_link_stat_list_id", "none")
        result[nid] = {
            "type": ntype,
            "cards": _parse_list(e.get("link_card_id", "[]")),
            "val": int(float(e.get("value", 0))),
            "limit": int(e.get("stat_add_limit", 0)),
            "check": check_raw if check_raw != "none" else None,
            "thresh": int(e.get("stat_check_threshold", 0)),
            "excess": e.get("stat_check_use_excess", "FALSE") == "TRUE",
        }
    return result


def main(output_dir: str) -> None:
    output = Path(output_dir)
    db = output / "db"
    text_json = output / "text" / "en" / "text.json"

    if not db.exists():
        sys.exit(f"ERROR: db/ folder not found at {db}")

    print("Loading card data…")
    cards, effects, rsparks = load_card_data(db)
    print(f"  {len(cards)} cards, {len(effects)} effects, {len(rsparks)} rsparks")

    print("Loading character base stats…")
    char_base = load_char_base(db)
    print(f"  {len(char_base)} characters")

    card_ids = set(cards.keys())
    char_ids = set(char_base.keys())

    print("Loading localisation names…")
    if text_json.exists():
        names = load_names(text_json, card_ids, char_ids)
        print(f"  {len(names)} name entries")
    else:
        names = {}
        print("  [warn] text.json not found — no names bundled")

    print("Loading potential node effects…")
    node_effects = load_node_effects(db)
    print(f"  {len(node_effects)} relevant node effects")

    out_path = Path(__file__).parent.parent / "api" / "data" / "game_db.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    bundle = {
        "version": 2,
        "cards": cards,
        "effects": effects,
        "rsparks": rsparks,
        "char_base": char_base,
        "names": names,
        "node_effects": node_effects,
    }

    out_path.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_mb = out_path.stat().st_size / 1_048_576
    print(f"\nWrote {out_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/bundle_game_data.py <path_to_output_folder>")
    main(sys.argv[1])
