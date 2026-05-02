# Build Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Tkinter build pipeline with a 3-step pipeline that produces a shippable Tauri MSI: (1) PyInstaller bundles the FastAPI sidecar into a single `.exe`, (2) Vite builds the React frontend, (3) `cargo tauri build` packages everything into the MSI installer.

**Architecture:** PyInstaller's `--onedir` mode bundles `api/main.py` and all Vribbels modules into `dist/hub-czn-api/hub-czn-api.exe`. A post-build copy step places the exe at `src-tauri/binaries/hub-czn-api-x86_64-pc-windows-msvc.exe` (Tauri's required sidecar naming convention). `tauri.conf.json` declares the sidecar in `bundle.externalBin`. A new `build.bat` orchestrates all three steps. The route files' `sys.path.insert` calls are replaced with a frozen-aware helper so imports work both in dev and in the bundled exe.

**Tech Stack:** Python 3.13 + PyInstaller · Vite + npm · Rust + Tauri v2 · Batch scripting

---

## File Map

**New files:**
- `api/frozen_path.py` — single helper function `add_vribbels_to_path()` used by route files
- `api/hub_czn_api.spec` — PyInstaller spec for the sidecar

**Modified files:**
- `requirements.txt` — add `fastapi`, `uvicorn[standard]`, `mitmproxy`, `python-multipart`, `websockets`
- `api/state.py` — use `frozen_path.add_vribbels_to_path()` instead of inline `sys.path.insert`
- `api/routes/combatants.py` — same
- `api/routes/data.py` — same
- `api/routes/optimize.py` — same
- `api/routes/rescue.py` — same
- `api/routes/scoring.py` — same
- `src-tauri/tauri.conf.json` — add `bundle.externalBin`
- `build.bat` — full rewrite for the new 3-step pipeline

---

## Task 1: Frozen-aware sys.path helper

The route files all do `sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))`. In a PyInstaller one-dir bundle, `__file__` resolves to a temp `_MEIPASS` path and the relative `../..` prefix won't find Vribbels. This task replaces the duplicated inline logic with a single helper that handles both cases.

**Files:**
- Create: `api/frozen_path.py`
- Modify: `api/state.py`
- Modify: `api/routes/combatants.py`, `api/routes/data.py`, `api/routes/optimize.py`, `api/routes/rescue.py`, `api/routes/scoring.py`

- [ ] **Step 1: Create `api/frozen_path.py`**

```python
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
```

- [ ] **Step 2: Update `api/state.py`**

Replace lines 1–8:
```python
import sys
import os
import queue
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Vribbels'))
```

with:
```python
import queue
import time

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()
```

- [ ] **Step 3: Update `api/routes/combatants.py`**

Find the block at the top of the file that reads:
```python
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))
```

Replace it with:
```python
from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()
```

- [ ] **Step 4: Update `api/routes/data.py`**

Same pattern — find and replace the `sys.path.insert` block at the top with:
```python
from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()
```

Note: `data.py` may not have an explicit `sys.path.insert` if it relied on `state.py` importing first — check if the block exists; only add the helper if it does.

- [ ] **Step 5: Update `api/routes/optimize.py`**

Same pattern:
```python
from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()
```

Remove the `import os`, `import sys`, and `sys.path.insert(...)` lines that are replaced.

- [ ] **Step 6: Update `api/routes/rescue.py`**

Same pattern.

- [ ] **Step 7: Update `api/routes/scoring.py`**

Same pattern.

- [ ] **Step 8: Run the test suite to confirm nothing broke**

```
python -m pytest tests/ -q
```

Expected: all existing tests PASS (same count as before).

- [ ] **Step 9: Commit**

```bash
git add api/frozen_path.py api/state.py api/routes/combatants.py api/routes/data.py api/routes/optimize.py api/routes/rescue.py api/routes/scoring.py
git commit -m "refactor: centralise sys.path Vribbels import in frozen_path helper"
```

---

## Task 2: Update `requirements.txt`

The FastAPI sidecar needs several packages that the old Tkinter requirements file didn't include. This task adds them.

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Replace `requirements.txt` with the full list**

```
# Runtime dependencies for the FastAPI sidecar
fastapi
uvicorn[standard]
mitmproxy
python-multipart
websockets
pillow
packaging
requests
zstandard

# Build tooling (not bundled into the sidecar)
pyinstaller
```

- [ ] **Step 2: Install to verify the list is correct**

```
pip install -r requirements.txt
```

Expected: all packages install without errors. Mitmproxy may take a moment on first install.

- [ ] **Step 3: Verify the API still starts**

```
python -m api.main
```

Expected: prints `PORT:7842` (or next available port) and keeps running. Stop with Ctrl+C.

- [ ] **Step 4: Run tests**

```
python -m pytest tests/ -q
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt
git commit -m "chore: add fastapi, uvicorn, mitmproxy and other runtime deps to requirements.txt"
```

---

## Task 3: Create the PyInstaller spec for the sidecar

**Files:**
- Create: `api/hub_czn_api.spec`

- [ ] **Step 1: Create `api/hub_czn_api.spec`**

```python
# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the Hub CZN FastAPI sidecar.
# Run from the repo root: pyinstaller api/hub_czn_api.spec --clean --noconfirm

import os
from pathlib import Path

repo_root = Path(os.getcwd())
vribbels = repo_root / 'Vribbels'

a = Analysis(
    [str(repo_root / 'api' / 'main.py')],
    pathex=[
        str(repo_root),
        str(repo_root / 'api'),
        str(vribbels),
    ],
    binaries=[],
    datas=[
        (str(vribbels / 'game_data'),        'game_data'),
        (str(vribbels / 'images'),           'images'),
        (str(vribbels / 'zstd_dictionary.bin'), '.'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'starlette',
        'anyio',
        'anyio._backends._asyncio',
        'zstandard',
        'PIL._tkinter_finder',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='hub-czn-api',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # Must be True — Tauri reads PORT:xxxx from stdout
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='hub-czn-api',
)
```

- [ ] **Step 2: Test the spec by doing a dry-run analysis**

```
pyinstaller api/hub_czn_api.spec --clean --noconfirm
```

Expected: creates `dist/hub-czn-api/hub-czn-api.exe`. If PyInstaller reports missing modules, add them to `hiddenimports` in the spec.

- [ ] **Step 3: Verify the built exe starts**

```
dist\hub-czn-api\hub-czn-api.exe
```

Expected: prints `PORT:7842` (or similar) and stays running. Stop with Ctrl+C. If it crashes, check the terminal for the traceback and add any missing imports.

- [ ] **Step 4: Commit**

```bash
git add api/hub_czn_api.spec
git commit -m "build: add PyInstaller spec for the FastAPI sidecar"
```

---

## Task 4: Update `tauri.conf.json` and `build.bat`

This wires the sidecar into the Tauri build and replaces the legacy `build.bat`.

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `build.bat`

- [ ] **Step 1: Declare the sidecar in `src-tauri/tauri.conf.json`**

Current `bundle` section:
```json
"bundle": {
    "active": true,
    "targets": "all",
    "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
    ]
}
```

Replace with:
```json
"bundle": {
    "active": true,
    "targets": "all",
    "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
    ],
    "externalBin": [
        "binaries/hub-czn-api"
    ]
}
```

- [ ] **Step 2: Create the binaries directory**

```bash
mkdir -p src-tauri/binaries
echo "# Compiled sidecar goes here" > src-tauri/binaries/.gitkeep
```

Add to `.gitignore`:
```
src-tauri/binaries/*.exe
```

- [ ] **Step 3: Rewrite `build.bat`**

```bat
@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  Hub CZN - Build Script
echo ============================================
echo.

:: ---- Step 1: Python sidecar ----
echo [1/3] Building Python sidecar...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed.
    pause & exit /b 1
)

pyinstaller api/hub_czn_api.spec --clean --noconfirm
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    pause & exit /b 1
)

:: Tauri expects the sidecar at src-tauri/binaries/<name>-<target-triple>.exe
set TARGET_TRIPLE=x86_64-pc-windows-msvc
copy /Y "dist\hub-czn-api\hub-czn-api.exe" "src-tauri\binaries\hub-czn-api-%TARGET_TRIPLE%.exe"
if errorlevel 1 (
    echo ERROR: Failed to copy sidecar binary.
    pause & exit /b 1
)

:: ---- Step 2: Frontend ----
echo.
echo [2/3] Building frontend...
npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause & exit /b 1
)

npm run build
if errorlevel 1 (
    echo ERROR: npm run build failed.
    pause & exit /b 1
)

:: ---- Step 3: Tauri bundle ----
echo.
echo [3/3] Building Tauri MSI...
cargo tauri build
if errorlevel 1 (
    echo ERROR: cargo tauri build failed.
    pause & exit /b 1
)

echo.
echo ============================================
echo  Build complete!
echo  Output: src-tauri\target\release\bundle\msi\
echo ============================================
pause
```

- [ ] **Step 4: Update `.gitignore`**

Open `.gitignore` and ensure the following lines are present (add if missing):

```
# Build outputs
dist/
build/
src-tauri/target/
src-tauri/binaries/*.exe
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/binaries/.gitkeep build.bat .gitignore
git commit -m "build: configure Tauri sidecar and rewrite build.bat for 3-step pipeline"
```
