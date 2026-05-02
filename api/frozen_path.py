from __future__ import annotations

import os
import sys


def add_vribbels_to_path() -> None:
    """Add Vribbels/ to sys.path, handling both dev and PyInstaller frozen mode."""
    if getattr(sys, 'frozen', False):
        # PyInstaller one-dir: _MEIPASS is the bundle root; game_data etc. are at top level
        vribbels_path = sys._MEIPASS  # type: ignore[attr-defined]
    else:
        # Dev: api/ is one level below the repo root; Vribbels/ is a sibling of api/
        vribbels_path = os.path.normpath(
            os.path.join(os.path.dirname(__file__), '..', 'Vribbels')
        )
    if vribbels_path not in sys.path:
        sys.path.insert(0, vribbels_path)
