from __future__ import annotations

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

from fastapi import APIRouter, HTTPException

from api.state import state

try:
    from game_data.characters import CHARACTERS
    from game_data.constants import EQUIPMENT_SLOTS
except ImportError:
    CHARACTERS = {}
    EQUIPMENT_SLOTS = {}

router = APIRouter()

CDN_BASE = "https://cdn.czndecksmeta.com/face/character/portrait_character_{res_id}.webp"


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
        has_weights = (
            any(v != 0 for v in state.optimizer.priorities.values())
            or bool(state.optimizer.char_weights)
        )
        avg_score = (
            sum(f.priority_score for f in gear) / len(gear)
            if gear and has_weights
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
            "portrait_url": CDN_BASE.format(res_id=info.res_id),
        })
    result.sort(key=lambda c: -c["avg_gear_score"])
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
            slots.append({"slot": slot_name, "main_stat": None, "substats": [], "score": None})
        else:
            slots.append({
                "slot": slot_name,
                "main_stat": f"{f.main_stat.name} {f.main_stat.format_value()}" if f.main_stat else None,
                "substats": [f"{s.name} {s.format_value()}" for s in f.substats],
                "score": round(f.gear_score, 1),
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
    }

    return {"char_id": char_id, "gear_slots": slots, "final_stats": final_stats}
