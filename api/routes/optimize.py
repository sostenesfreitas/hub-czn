from __future__ import annotations

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

import asyncio
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    from game_data.sets import SETS
    from game_data.constants import EQUIPMENT_SLOTS
except ImportError:
    SETS = {}
    EQUIPMENT_SLOTS = {}

from api.state import state
from api.routes.ws import manager

router = APIRouter()


class OptimizeStartRequest(BaseModel):
    char_name: str
    four_piece_sets: list[int] = Field(default_factory=list)
    two_piece_sets: list[int] = Field(default_factory=list)
    main_stat_4: str | None = None
    main_stat_5: str | None = None
    main_stat_6: str | None = None
    top_percent: int = Field(default=100, ge=1, le=100)
    include_equipped: bool = True
    excluded_heroes: list[str] = Field(default_factory=list)
    max_results: int = Field(default=10, ge=1, le=50)


def _format_results(results: list) -> list[dict]:
    formatted = []
    for rank, (gear_list, score, raw_stats) in enumerate(results, 1):
        gear_sorted = sorted(gear_list, key=lambda f: f.slot_num)
        gear_slots = [
            {
                "slot": EQUIPMENT_SLOTS.get(p.slot_num, f"Slot {p.slot_num}"),
                "main_stat": f"{p.main_stat.name} {p.main_stat.format_value()}" if p.main_stat else None,
                "substats": [f"{s.name} {s.format_value()}" for s in p.substats],
                "score": round(p.gear_score, 1),
            }
            for p in gear_sorted
        ]
        final_stats = {
            "ATK": round(raw_stats.get("ATK", 0)),
            "DEF": round(raw_stats.get("DEF", 0)),
            "HP": round(raw_stats.get("HP", 0)),
            "CRate": round(raw_stats.get("CRate", 0), 1),
            "CDmg": round(raw_stats.get("CDmg", 125), 1),
            "EHP": round(raw_stats.get("EHP", 0)),
            "AvgDMG": round(raw_stats.get("Avg DMG", 0)),
        }
        formatted.append({
            "rank": rank,
            "score": round(score, 1),
            "gear_slots": gear_slots,
            "final_stats": final_stats,
        })
    return formatted


@router.get("/optimize/sets")
def optimize_sets():
    return sorted(
        [{"id": sid, "name": s["name"], "pieces": s["pieces"]} for sid, s in SETS.items()],
        key=lambda x: x["name"],
    )


@router.post("/optimize/start")
async def optimize_start(body: OptimizeStartRequest):
    if not state.data_loaded:
        raise HTTPException(status_code=422, detail="No data loaded")
    if body.char_name not in state.optimizer.character_info:
        raise HTTPException(status_code=422, detail=f"Unknown character: {body.char_name}")
    if state.job_id is not None:
        raise HTTPException(status_code=409, detail="A job is already running")

    job_id = str(uuid4())
    state.job_id = job_id
    state.cancel_flag = [False]

    settings = {
        "four_piece_sets": body.four_piece_sets,
        "two_piece_sets": body.two_piece_sets,
        "main_stat_4": [body.main_stat_4] if body.main_stat_4 else [],
        "main_stat_5": [body.main_stat_5] if body.main_stat_5 else [],
        "main_stat_6": [body.main_stat_6] if body.main_stat_6 else [],
        "top_percent": body.top_percent,
        "include_equipped": body.include_equipped,
        "excluded_heroes": body.excluded_heroes,
        "max_results": body.max_results,
    }

    loop = asyncio.get_running_loop()

    async def _run() -> None:
        try:
            def progress_cb(checked: int, total: int, found: int) -> None:
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({
                        "type": "optimize.progress",
                        "checked": checked,
                        "total": total,
                        "found": found,
                    }),
                    loop,
                )

            results = await loop.run_in_executor(
                None,
                lambda: state.optimizer.optimize(
                    body.char_name, settings, progress_cb, state.cancel_flag
                ),
            )

            if state.cancel_flag[0]:
                await manager.broadcast({"type": "optimize.cancelled"})
            else:
                await manager.broadcast({
                    "type": "optimize.done",
                    "results": _format_results(results),
                })
        except Exception as exc:
            await manager.broadcast({"type": "optimize.error", "message": str(exc)})
        finally:
            state.job_id = None

    asyncio.create_task(_run())
    return {"job_id": job_id}


@router.post("/optimize/cancel")
async def optimize_cancel():
    if state.job_id is None:
        return {"cancelled": False}
    state.cancel_flag[0] = True
    return {"cancelled": True}
