"""
One-shot compiler: reads extracted CZN client JSONs and emits pre-computed
scaling tables for the optimizer.

Inputs (from C:\\Users\\soste\\Downloads\\output\\db):
  - char_base@combatant_level.json
  - char_base@combatant_ascend.json
  - char_base@char_combatant.json

Outputs (to api/data/):
  - level_scaling.json     {group_id: {level_str: {ATK, DEF, HP}}}
  - ascend_scaling.json    {group_id: [ {ATK, DEF, HP} CUMULATIVE per ascend 0..N ]}
  - char_base_l1.json      {combatant_id: {atk, def, hp, cri, cri_dmg, level_group, ascend_group, limit_break_group, friendship_group}}

Note: ascend_scaling stores CUMULATIVE bonuses. Index N = sum of per-tier deltas 0..N.
For example, dev_ascend with per-tier delta ATK=16 for tiers 1..5 yields:
  index 0: ATK=0, index 1: ATK=16, index 2: ATK=32, index 3: ATK=48, index 4: ATK=64, index 5: ATK=80

Run when client data is updated. Read-only on inputs.
"""
import json
from pathlib import Path
from collections import defaultdict

CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
OUTPUT_DIR = Path(__file__).parent.parent / "api" / "data"


def build_level_scaling() -> dict:
    """Cumulative ATK/DEF/HP deltas per group, per level."""
    raw = json.loads((CLIENT_DB / "char_base@combatant_level.json").read_text(encoding="utf-8"))
    by_group = defaultdict(list)
    for row in raw:
        by_group[row["group"]].append(row)

    out = {}
    for group, rows in by_group.items():
        rows.sort(key=lambda r: int(r["level"]))
        cum_atk, cum_def, cum_hp = 0, 0, 0
        out[group] = {}
        for r in rows:
            cum_atk += int(r["stat1_value"])
            cum_def += int(r["stat2_value"])
            cum_hp += int(r["stat3_value"])
            out[group][r["level"]] = {"ATK": cum_atk, "DEF": cum_def, "HP": cum_hp}
    return out


def build_ascend_scaling() -> dict:
    """Cumulative ATK/DEF/HP bonus per ascend index (0..N).

    Each row in char_base@combatant_ascend.json stores a per-tier DELTA.
    This function converts those deltas to cumulative sums so that
    ascend_scaling[group][N] gives the total bonus for ascend level N.
    """
    raw = json.loads((CLIENT_DB / "char_base@combatant_ascend.json").read_text(encoding="utf-8"))
    by_group = defaultdict(list)
    for row in raw:
        by_group[row["group"]].append(row)

    out = {}
    for group, rows in by_group.items():
        rows.sort(key=lambda r: int(r["ascend"]))
        cum_atk, cum_def, cum_hp = 0, 0, 0
        out[group] = []
        for r in rows:
            cum_atk += int(r["stat1_value"])
            cum_def += int(r["stat2_value"])
            cum_hp += int(r["stat3_value"])
            out[group].append({"ATK": cum_atk, "DEF": cum_def, "HP": cum_hp})
    return out


def build_char_base() -> dict:
    """L1 base stats + scaling group references for every combatant."""
    raw = json.loads((CLIENT_DB / "char_base@char_combatant.json").read_text(encoding="utf-8"))
    out = {}
    for row in raw:
        out[row["id"]] = {
            "atk": int(row["s_atk"]),
            "def": int(row["s_def"]),
            "hp": int(row["s_hp"]),
            "cri": float(row["s_cri"]),
            "cri_dmg": float(row["s_cri_dmg_rate"]),
            "level_group": row["link_combatant_level_group"],
            "ascend_group": row["link_combatant_ascend_group"],
            "limit_break_group": row["link_combatant_limit_break_group"],
            "friendship_group": row["link_combatant_friendship_bonus_group"],
        }
    return out


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "level_scaling.json").write_text(
        json.dumps(build_level_scaling(), indent=2), encoding="utf-8"
    )
    (OUTPUT_DIR / "ascend_scaling.json").write_text(
        json.dumps(build_ascend_scaling(), indent=2), encoding="utf-8"
    )
    (OUTPUT_DIR / "char_base_l1.json").write_text(
        json.dumps(build_char_base(), indent=2), encoding="utf-8"
    )
    print("Wrote level_scaling.json, ascend_scaling.json, char_base_l1.json to", OUTPUT_DIR)


if __name__ == "__main__":
    main()
