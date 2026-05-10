"""
Stat scaling lookup using compiled tables from api/data/.

Public API:
  get_char_base_stats(combatant_id: str, level: int, ascend: int) -> dict

Returns a dict with keys: ATK, DEF, HP, CRate, CDmg.
"""
import json
from functools import lru_cache
from pathlib import Path

_DATA_DIR = Path(__file__).parent.parent / "data"


@lru_cache(maxsize=1)
def _load_char_base() -> dict:
    return json.loads((_DATA_DIR / "char_base_l1.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _load_level_scaling() -> dict:
    return json.loads((_DATA_DIR / "level_scaling.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _load_ascend_scaling() -> dict:
    return json.loads((_DATA_DIR / "ascend_scaling.json").read_text(encoding="utf-8"))


def get_char_base_stats(combatant_id: str, level: int, ascend: int) -> dict:
    """Return ATK/DEF/HP/CRate/CDmg for combatant at given level/ascend.

    Raises KeyError if combatant_id is unknown.
    Level is clamped to the maximum available in the level_scaling table.
    """
    char = _load_char_base()[combatant_id]
    level_table = _load_level_scaling().get(char["level_group"], {})
    ascend_table = _load_ascend_scaling().get(char["ascend_group"], [])

    available_levels = [int(k) for k in level_table.keys()]
    max_level = max(available_levels) if available_levels else 1
    effective_level = min(level, max_level)

    level_bonus = level_table.get(str(effective_level), {"ATK": 0, "DEF": 0, "HP": 0})
    ascend_bonus = (
        ascend_table[ascend]
        if 0 <= ascend < len(ascend_table)
        else {"ATK": 0, "DEF": 0, "HP": 0}
    )

    return {
        "ATK": char["atk"] + level_bonus["ATK"] + ascend_bonus["ATK"],
        "DEF": char["def"] + level_bonus["DEF"] + ascend_bonus["DEF"],
        "HP": char["hp"] + level_bonus["HP"] + ascend_bonus["HP"],
        "CRate": char["cri"],
        "CDmg": char["cri_dmg"],
    }
