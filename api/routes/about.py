from __future__ import annotations

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

from fastapi import APIRouter

try:
    from hub_czn_version import __version__
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
