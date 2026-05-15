from __future__ import annotations

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

import asyncio
import json
from pathlib import Path
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
    stat_weights: dict[str, int] | None = None
    allow_wildcards: bool = False
    min_priority_substats: int = Field(default=0, ge=0, le=4)
    stat_constraints: dict[str, float] | None = None
    # Sprint 2f4: AvgDMG configuration knobs
    target_def: int = Field(default=500, ge=0)
    treat_target_as_weak: bool = False
    # Sprint 2h3: AoE / multi-target modeling
    # Sprint 2h9: 0 = auto-detect from char's best damage card's target_class
    target_count: int = Field(default=1, ge=0, le=5)
    # Sprint 2h6: DoT ticks knob
    dot_ticks: int = Field(default=3, ge=1, le=10)


def _format_results(results: list) -> list[dict]:
    formatted = []
    for rank, (gear_list, score, raw_stats) in enumerate(results, 1):
        gear_sorted = sorted(gear_list, key=lambda f: f.slot_num)
        gear_slots = [
            {
                "slot": EQUIPMENT_SLOTS.get(p.slot_num, f"Slot {p.slot_num}"),
                "slot_num": p.slot_num,
                "set_name": p.set_name,
                "set_id": p.set_id,
                "level": p.level,
                "main_stat": f"{p.main_stat.name} {p.main_stat.format_value()}" if p.main_stat else None,
                "substats": [
                    {"text": f"{s.name} {s.format_value()}", "name": s.name, "value": s.format_value(), "roll_count": s.roll_count, "efficiency": s.get_efficiency()}
                    for s in p.substats
                ],
                "score": round(p.gear_score, 1),
                "priority_score": round(p.priority_score, 1),
                "potential_low": round(p.potential_low, 1),
                "potential_high": round(p.potential_high, 1),
                "equipped_to": p.equipped_to,
            }
            for p in gear_sorted
        ]

        set_counts: dict[str, int] = {}
        for p in gear_sorted:
            if p.set_name:
                set_counts[p.set_name] = set_counts.get(p.set_name, 0) + 1
        set_summary = " + ".join(
            f"{cnt}×{name}"
            for name, cnt in sorted(set_counts.items(), key=lambda x: -x[1])
        )

        final_stats = {
            "ATK": round(raw_stats.get("ATK", 0)),
            "DEF": round(raw_stats.get("DEF", 0)),
            "HP": round(raw_stats.get("HP", 0)),
            "CRate": round(raw_stats.get("CRate", 0), 1),
            "CDmg": round(raw_stats.get("CDmg", 125), 1),
            "EHP": round(raw_stats.get("EHP", 0)),
            "AvgDMG": round(raw_stats.get("Avg DMG", 0)),
            "ExtraDMG": round(raw_stats.get("Extra DMG%", 0), 1),
            "Ego": round(raw_stats.get("Ego", 0)),
        }
        formatted.append({
            "rank": rank,
            "score": round(score, 1),
            "set_summary": set_summary,
            "gear_slots": gear_slots,
            "final_stats": final_stats,
        })
    return formatted


@router.get("/optimize/sets")
def optimize_sets():
    return sorted(
        [{"id": sid, "name": s["name"], "pieces": s["pieces"], "icon_path": s.get("icon_path")} for sid, s in SETS.items()],
        key=lambda x: x["name"],
    )


@router.get("/optimize/monster-catalog")
def optimize_monster_catalog():
    """Sprint 2h1: returns the static monster catalog for the Optimizer
    Monster Picker UI.

    Catalog is built offline by scripts/build_monster_catalog.py from
    client_db monster definitions. Returns a list of
    {id, name, def, has_weak} dicts (sorted by DEF then name).
    Returns an empty list when the catalog file is missing.
    """
    path = Path(__file__).resolve().parents[1] / "data" / "monster_catalog.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


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
        "stat_weights": body.stat_weights,
        "allow_wildcards": body.allow_wildcards,
        "min_priority_substats": body.min_priority_substats,
        "stat_constraints": body.stat_constraints,
        # Sprint 2f4: AvgDMG configuration knobs
        "target_def": body.target_def,
        "treat_target_as_weak": body.treat_target_as_weak,
        # Sprint 2h3: AoE / multi-target modeling
        "target_count": body.target_count,
        # Sprint 2h6: DoT ticks knob
        "dot_ticks": body.dot_ticks,
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
