from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from api.state import state

router = APIRouter()


class LoadRequest(BaseModel):
    path: str


@router.post("/load")
def load_data(body: LoadRequest):
    try:
        state.optimizer.load_data(body.path)
        state.data_loaded = True
        state.loaded_file = body.path
        return {
            "ok": True,
            "fragments": len(state.optimizer.fragments),
            "combatants": len(state.optimizer.character_info),
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {body.path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fragments")
def get_fragments(
    slot: Optional[int] = None,
    set_id: Optional[int] = None,
    unequipped: Optional[bool] = None,
):
    if not state.data_loaded:
        raise HTTPException(status_code=400, detail="No data loaded. Call /api/load first.")

    frags = state.optimizer.fragments

    if slot is not None:
        frags = [f for f in frags if f.slot_num == slot]
    if set_id is not None:
        frags = [f for f in frags if f.set_id == set_id]
    if unequipped is True:
        frags = [f for f in frags if f.equipped_to is None]

    return [_to_dict(f) for f in frags]


def _stat_dict(s) -> dict:
    return {
        "name": s.name,
        "value": s.value,
        "formatted": s.format_value(),
        "is_percentage": s.is_percentage,
        "roll_count": s.roll_count,
    }


def _to_dict(f) -> dict:
    return {
        "id": f.id,
        "slot_num": f.slot_num,
        "slot_name": f.slot_name,
        "set_id": f.set_id,
        "set_name": f.set_name,
        "rarity_num": f.rarity_num,
        "rarity": f.rarity,
        "level": f.level,
        "locked": f.locked,
        "equipped_to": f.equipped_to,
        "gear_score": f.gear_score,
        "priority_score": f.priority_score,
        "potential_low": f.potential_low,
        "potential_high": f.potential_high,
        "main_stat": _stat_dict(f.main_stat) if f.main_stat else None,
        "substats": [_stat_dict(s) for s in f.substats],
    }


@router.get("/game-data")
def get_game_data():
    from game_data.sets import SETS
    from game_data.constants import STATS
    from game_data.characters import CHARACTERS
    return {"sets": SETS, "stats": STATS, "characters": CHARACTERS}
