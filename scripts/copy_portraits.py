#!/usr/bin/env python3
"""Copy character portrait PNGs from desktop project to Android assets."""
import os
import shutil

SRC = os.path.join(os.path.dirname(__file__), "..", "api", "assets", "game", "faces")
DST = os.path.join(os.path.dirname(__file__), "..", "android-app", "app", "src", "main", "assets", "faces")

os.makedirs(DST, exist_ok=True)
copied = 0
for fname in os.listdir(SRC):
    if fname.endswith(".png"):
        shutil.copy2(os.path.join(SRC, fname), os.path.join(DST, fname))
        copied += 1

print(f"Copied {copied} portrait files to {DST}")
