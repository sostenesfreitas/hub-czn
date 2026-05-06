from __future__ import annotations

import sys
from pathlib import Path
import json


def _resolve_bundled_path() -> Path:
    # In PyInstaller frozen mode, data files live under sys._MEIPASS.
    # __file__ parent-walking is unreliable for frozen modules.
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "data" / "game_db.json"  # type: ignore[attr-defined]
    return Path(__file__).parent.parent / "data" / "game_db.json"


_BUNDLED_PATH = _resolve_bundled_path()
_cache: dict | None = None


def get() -> dict:
    """Return the bundled game_db dict, loading it lazily on first call."""
    global _cache
    if _cache is None:
        if _BUNDLED_PATH.exists():
            try:
                _cache = json.loads(_BUNDLED_PATH.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                _cache = {}
        else:
            _cache = {}
    return _cache


def invalidate() -> None:
    """Force reload on next get() call."""
    global _cache
    _cache = None
