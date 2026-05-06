from __future__ import annotations

import sys


def add_vribbels_to_path() -> None:
    """In PyInstaller frozen mode, add _MEIPASS to sys.path so bundled packages are importable."""
    if getattr(sys, 'frozen', False):
        vribbels_path = sys._MEIPASS  # type: ignore[attr-defined]
        if vribbels_path not in sys.path:
            sys.path.insert(0, vribbels_path)
