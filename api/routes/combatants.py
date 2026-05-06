from __future__ import annotations

from pathlib import Path
import json

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

from fastapi import APIRouter, HTTPException

from api.state import state
import api.utils.game_db as game_db

try:
    from game_data.characters import CHARACTERS
    from game_data.constants import EQUIPMENT_SLOTS
except ImportError:
    CHARACTERS = {}
    EQUIPMENT_SLOTS = {}

router = APIRouter()

LOCAL_FACE = "/assets/game/faces/bookmark_face_character_map_{res_id}.png"

def _get_extracted_db() -> Path | None:
    if not state.loaded_file:
        return None
    p = Path(state.loaded_file).parent
    for _ in range(3):
        candidate = p / "db"
        if candidate.exists():
            return candidate
        p = p.parent
    return None


def _load_char_base_stats_from_folder(db_path: Path) -> dict[str, dict]:
    for f in db_path.iterdir():
        if f.name == "char_base@char_combatant.json":
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
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
            except Exception:
                return {}
    return {}


def _resolve_char_base() -> dict[str, dict]:
    bundled = game_db.get()
    if bundled.get("char_base"):
        return bundled["char_base"]
    db_path = _get_extracted_db()
    if db_path:
        return _load_char_base_stats_from_folder(db_path)
    return {}


def _char_extra(res_id: int) -> dict:
    c = CHARACTERS.get(res_id) or {}
    return {
        "attribute": c.get("attribute", "Unknown"),
        "class": c.get("class", "Unknown"),
    }


@router.get("/combatants")
def get_combatants():
    if not state.data_loaded:
        return []
    result = []
    for name, info in state.optimizer.character_info.items():
        gear = state.optimizer.characters.get(name, [])
        char_has_weights = (
            any(v != 0 for v in state.optimizer.priorities.values())
            or name in state.optimizer.char_weights
        )
        avg_score = (
            sum(f.priority_score for f in gear) / len(gear)
            if gear and char_has_weights
            else sum(f.gear_score for f in gear) / len(gear) if gear
            else 0.0
        )
        extra = _char_extra(info.res_id)
        result.append({
            "char_id": name,
            "name": name,
            "res_id": info.res_id,
            "level": info.level,
            "attribute": extra["attribute"],
            "class": extra["class"],
            "avg_gear_score": round(avg_score, 1),
            "portrait_url": LOCAL_FACE.format(res_id=info.res_id),
            "ego": info.limit_break,
            "partner_name": info.partner_name or None,
            "partner_res_id": info.partner_res_id or None,
        })
    result.sort(key=lambda c: -c["avg_gear_score"])
    return result


@router.get("/combatants/export")
def get_combatants_export():
    if not state.data_loaded:
        raise HTTPException(status_code=422, detail="No data loaded")
    result = []
    for name, info in state.optimizer.character_info.items():
        gear = state.optimizer.characters.get(name, [])
        gear_by_slot = {f.slot_num: f for f in gear}
        slots = []
        for slot_num in range(1, 7):
            slot_name = EQUIPMENT_SLOTS.get(slot_num, f"Slot {slot_num}")
            f = gear_by_slot.get(slot_num)
            slots.append({
                "slot": slot_name,
                "slot_num": slot_num,
                "set_name": f.set_name if f else None,
                "level": f.level if f else 0,
                "main_stat": (
                    f"{f.main_stat.name} {f.main_stat.format_value()}"
                    if f and f.main_stat else None
                ),
                "substats": [
                    {
                        "name": s.name,
                        "value": s.format_value(),
                        "roll_count": s.roll_count,
                        "efficiency": s.get_efficiency(),
                    }
                    for s in f.substats
                ] if f else [],
                "score": round(f.gear_score, 1) if f else None,
            })
        try:
            raw = state.optimizer.calculate_build_stats(gear, name)
        except Exception:
            raw = {}
        result.append({
            "char_id": name,
            "name": name,
            "res_id": info.res_id,
            "level": info.level,
            "gear_slots": slots,
            "final_stats": {
                "ATK": round(raw.get("ATK", 0)),
                "DEF": round(raw.get("DEF", 0)),
                "HP": round(raw.get("HP", 0)),
                "CRate": round(raw.get("CRate", 0), 1),
                "CDmg": round(raw.get("CDmg", 125), 1),
                "EHP": round(raw.get("EHP", 0)),
            },
        })
    return result


@router.get("/combatants/{char_id}/stats")
def get_combatant_stats(char_id: str):
    if not state.data_loaded:
        raise HTTPException(status_code=404, detail="No data loaded")
    if char_id not in state.optimizer.character_info:
        raise HTTPException(status_code=404, detail=f"Character not found: {char_id}")
    gear = state.optimizer.characters.get(char_id, [])
    gear_by_slot = {f.slot_num: f for f in gear}

    slots = []
    for slot_num in range(1, 7):
        slot_name = EQUIPMENT_SLOTS.get(slot_num, f"Slot {slot_num}")
        f = gear_by_slot.get(slot_num)
        if f is None:
            slots.append({
                "slot": slot_name, "slot_num": slot_num,
                "set_name": None, "set_id": None, "level": 0,
                "main_stat": None, "substats": [],
                "score": None, "priority_score": None,
                "potential_low": None, "potential_high": None,
                "equipped_to": None,
            })
        else:
            slots.append({
                "slot": slot_name, "slot_num": slot_num,
                "set_name": f.set_name, "set_id": f.set_id, "level": f.level,
                "main_stat": f"{f.main_stat.name} {f.main_stat.format_value()}" if f.main_stat else None,
                "substats": [
                    {"text": f"{s.name} {s.format_value()}", "name": s.name, "value": s.format_value(), "roll_count": s.roll_count, "efficiency": s.get_efficiency()}
                    for s in f.substats
                ],
                "score": round(f.gear_score, 1),
                "priority_score": round(f.priority_score, 1),
                "potential_low": round(f.potential_low, 1),
                "potential_high": round(f.potential_high, 1),
                "equipped_to": f.equipped_to,
            })

    raw = state.optimizer.calculate_build_stats(gear, char_id)
    final_stats = {
        "ATK": round(raw.get("ATK", 0)),
        "DEF": round(raw.get("DEF", 0)),
        "HP": round(raw.get("HP", 0)),
        "CRate": round(raw.get("CRate", 0), 1),
        "CDmg": round(raw.get("CDmg", 125), 1),
        "EHP": round(raw.get("EHP", 0)),
        "AvgDMG": round(raw.get("Avg DMG", 0)),
        "ExtraDMG": round(raw.get("Extra DMG%", 0), 1),
        "Ego": round(raw.get("Ego", 0)),
    }

    base_stats: dict | None = None
    info = state.optimizer.character_info[char_id]
    char_base = _resolve_char_base()
    entry = char_base.get(str(info.res_id))
    if entry:
        base_stats = entry

    return {"char_id": char_id, "gear_slots": slots, "final_stats": final_stats, "base_stats": base_stats}
