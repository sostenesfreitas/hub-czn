from __future__ import annotations

import os
import sys

from fastapi import APIRouter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

try:
    from version import __version__
except ImportError:
    __version__ = "unknown"

router = APIRouter()

_GITHUB_REPO = "sostenesfreitas/hub-czn"


@router.get("/about")
def get_about():
    return {
        "version": __version__,
        "github_url": f"https://github.com/{_GITHUB_REPO}",
        "releases_url": f"https://github.com/{_GITHUB_REPO}/releases",
        "issues_url": f"https://github.com/{_GITHUB_REPO}/issues",
    }
