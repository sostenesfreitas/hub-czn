"""Copy all portrait/icon assets needed by the optimizer for given res_ids.

The frontend uses four distinct filename patterns under `/assets/game/`,
each backed by a different folder in the unpacked client. Missing any one
of them leaves visible empty silhouettes or grey rectangles.

Usage:
    python scripts/extract_portraits.py <output_dir> <res_id> [<res_id> ...]

Example:
    python scripts/extract_portraits.py C:/Users/soste/Downloads/output 1055 30095

After running, call `scripts/copy_portraits.py` to mirror the bookmark
files into the Android assets directory.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DST_BASE = REPO_ROOT / "api" / "assets" / "game"

# (source-relative-dir, filename-template, destination-subdir, required)
# `{res_id}` is substituted. Multiple entries with the same dst form variants.
PATTERNS = [
    ("face/character",            "bookmark_face_character_map_{res_id}.png", "faces",    True),
    ("tp_skill",                  "battle_icon_tp_skill_{res_id}.png",        "tp_skill", True),
    ("collapse/collapse_illustration", "collapse_{res_id}_01.png",            "collapse", False),
    ("collapse/collapse_illustration", "collapse_{res_id}_02.png",            "collapse", False),
]


def copy_for(res_id: int, output_dir: Path) -> tuple[int, list[str]]:
    copied = 0
    missing: list[str] = []
    for src_subdir, template, dst_subdir, required in PATTERNS:
        fname = template.format(res_id=res_id)
        src = output_dir / src_subdir / fname
        if not src.exists():
            if required:
                missing.append(f"{src_subdir}/{fname}")
            continue
        dst_dir = DST_BASE / dst_subdir
        dst_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst_dir / fname)
        copied += 1
    return copied, missing


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python scripts/extract_portraits.py <output_dir> <res_id> [<res_id> ...]",
              file=sys.stderr)
        return 2
    output_dir = Path(argv[1])
    if not output_dir.exists():
        print(f"output_dir not found: {output_dir}", file=sys.stderr)
        return 2

    overall_missing: list[str] = []
    for raw in argv[2:]:
        res_id = int(raw)
        copied, missing = copy_for(res_id, output_dir)
        print(f"  {res_id}: copied {copied} files" + (f", missing {len(missing)} required" if missing else ""))
        for m in missing:
            print(f"    [MISSING] {m}")
        overall_missing.extend(missing)

    if overall_missing:
        print(f"\nWARNING: {len(overall_missing)} required source file(s) missing — frontend will fall back to empty placeholders for those slots.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
