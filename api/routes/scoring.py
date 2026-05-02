from __future__ import annotations

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Annotated

from api.state import state

try:
    from game_data.constants import ALL_STAT_NAMES
except ImportError:
    ALL_STAT_NAMES = []

try:
    from game_data.char_presets import get_char_preset
except ImportError:
    def get_char_preset(_id: int):
        return None

router = APIRouter()

WeightValue = Annotated[int, Field(ge=0, le=10)]


class ScoringPrioritiesRequest(BaseModel):
    weights: dict[str, WeightValue]


def _persist_char_weights() -> None:
    try:
        from capture.constants import OUTPUT_DIR
        path = Path(OUTPUT_DIR) / "char_weights.json"
        path.write_text(json.dumps(state.optimizer.char_weights, indent=2), encoding="utf-8")
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to persist char_weights.json: %s", exc)


@router.get("/scoring/priorities")
def get_scoring_priorities():
    return {"weights": dict(state.optimizer.priorities)}


@router.post("/scoring/priorities")
def save_scoring_priorities(body: ScoringPrioritiesRequest):
    unknown = [k for k in body.weights if k not in ALL_STAT_NAMES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown stat names: {unknown}")
    state.optimizer.priorities.update(body.weights)
    if state.data_loaded:
        state.optimizer.recalculate_scores()
    return {"weights": dict(state.optimizer.priorities)}


@router.get("/scoring/char-preset/{char_id}")
def get_char_scoring_preset(char_id: int):
    preset = get_char_preset(char_id)
    if preset is None:
        raise HTTPException(status_code=404, detail=f"No preset for char_id {char_id}")
    return preset


@router.get("/scoring/char-weights/{char_id}")
def get_char_weights(char_id: str):
    if '/' in char_id or '\\' in char_id:
        raise HTTPException(status_code=400, detail="Invalid char_id")
    weights = state.optimizer.char_weights.get(char_id)
    if weights is None:
        raise HTTPException(status_code=404, detail=f"No override for {char_id}")
    return {"weights": weights}


@router.post("/scoring/char-weights/{char_id}")
def save_char_weights(char_id: str, body: ScoringPrioritiesRequest):
    if '/' in char_id or '\\' in char_id:
        raise HTTPException(status_code=400, detail="Invalid char_id")
    unknown = [k for k in body.weights if k not in ALL_STAT_NAMES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown stat names: {unknown}")
    state.optimizer.char_weights[char_id] = dict(body.weights)
    _persist_char_weights()
    if state.data_loaded:
        state.optimizer.recalculate_scores()
    return {"weights": state.optimizer.char_weights[char_id]}


@router.delete("/scoring/char-weights/{char_id}")
def delete_char_weights(char_id: str):
    if '/' in char_id or '\\' in char_id:
        raise HTTPException(status_code=400, detail="Invalid char_id")
    state.optimizer.char_weights.pop(char_id, None)
    _persist_char_weights()
    if state.data_loaded:
        state.optimizer.recalculate_scores()
    return {"ok": True}
