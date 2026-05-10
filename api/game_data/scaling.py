"""
Stat scaling lookup using compiled tables from api/data/.

Public API:
  get_char_base_stats(combatant_id: str, level: int, ascend: int) -> dict

Returns a dict with keys: ATK, DEF, HP, CRate, CDmg.

Note: tables are loaded once via lru_cache and cached for the process lifetime.
If api/data/ JSONs are regenerated while the API process is running, call
_load_char_base.cache_clear() / _load_level_scaling.cache_clear() /
_load_ascend_scaling.cache_clear() / _load_max_levels.cache_clear()
to force a reload.
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


@lru_cache(maxsize=1)
def _load_max_levels() -> dict:
    """Pre-computed max level per group_id from level_scaling.json."""
    return {
        group: max(int(k) for k in levels.keys()) if levels else 1
        for group, levels in _load_level_scaling().items()
    }


def get_char_base_stats(combatant_id: str, level: int, ascend: int) -> dict:
    """Return ATK/DEF/HP/CRate/CDmg for combatant at given level/ascend.

    Raises KeyError if combatant_id is unknown.
    Level is clamped to [1, max_level] from the level_scaling table.
    Ascend is clamped to [0, max_ascend] from the ascend_scaling table.
    """
    char = _load_char_base()[combatant_id]
    level_table = _load_level_scaling().get(char["level_group"], {})
    ascend_table = _load_ascend_scaling().get(char["ascend_group"], [])

    max_level = _load_max_levels().get(char["level_group"], 1)
    effective_level = max(1, min(level, max_level))

    level_bonus = level_table.get(str(effective_level), {"ATK": 0, "DEF": 0, "HP": 0})

    if ascend_table:
        effective_ascend = max(0, min(ascend, len(ascend_table) - 1))
        ascend_bonus = ascend_table[effective_ascend]
    else:
        ascend_bonus = {"ATK": 0, "DEF": 0, "HP": 0}

    return {
        "ATK": char["atk"] + level_bonus["ATK"] + ascend_bonus["ATK"],
        "DEF": char["def"] + level_bonus["DEF"] + ascend_bonus["DEF"],
        "HP": char["hp"] + level_bonus["HP"] + ascend_bonus["HP"],
        "CRate": char["cri"],
        "CDmg": char["cri_dmg"],
    }
