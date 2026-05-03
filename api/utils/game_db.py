from __future__ import annotations

from pathlib import Path
import json

_BUNDLED_PATH = Path(__file__).parent.parent / "data" / "game_db.json"
_cache: dict | None = None


def get() -> dict:
    """Return the bundled game_db dict, loading it lazily on first call."""
    global _cache
    if _cache is None:
        if _BUNDLED_PATH.exists():
            try:
                _cache = json.loads(_BUNDLED_PATH.read_text(encoding="utf-8"))
            except Exception:
                _cache = {}
        else:
            _cache = {}
    return _cache
