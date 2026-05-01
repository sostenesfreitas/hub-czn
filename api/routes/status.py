from fastapi import APIRouter
from api.state import state

router = APIRouter()


@router.get("/api/status")
def get_status():
    return {
        "ok": True,
        "data_loaded": state.data_loaded,
        "fragments": len(state.optimizer.fragments) if state.data_loaded else 0,
        "combatants": len(state.optimizer.character_info) if state.data_loaded else 0,
        "loaded_file": state.loaded_file,
    }
