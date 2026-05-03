from __future__ import annotations

from pathlib import Path
import json
import threading

_cache: dict[str, str] = {}
_loaded_from: str | None = None
_lock = threading.Lock()


def load_from(text_json: Path) -> None:
    global _cache, _loaded_from
    key = str(text_json)
    if _loaded_from == key:
        return
    with _lock:
        if _loaded_from == key:
            return
        try:
            data = json.loads(text_json.read_text(encoding="utf-8"))
            _cache = {e["id"]: e["text"] for e in data if "id" in e and "text" in e}
            _loaded_from = key
        except Exception:
            pass


def get(key: str, default: str = "") -> str:
    return _cache.get(key, default)
