from __future__ import annotations
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Annotated

from api.state import state

try:
    from game_data.constants import ALL_STAT_NAMES
except ImportError:
    ALL_STAT_NAMES = []

router = APIRouter()

WeightValue = Annotated[int, Field(ge=0, le=10)]


class ScoringPrioritiesRequest(BaseModel):
    weights: dict[str, WeightValue]


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
