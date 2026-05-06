# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the Hub CZN FastAPI sidecar.
# Run from the repo root: pyinstaller api/hub_czn_api.spec --clean --noconfirm

import sys
import os
from pathlib import Path

repo_root = Path(SPECPATH).parent  # SPECPATH = .../api; parent = repo root
api_dir = repo_root / 'api'

# PyInstaller does not always auto-include the versioned Python DLL on Windows.
# Collect both python3.dll (stable ABI stub) and pythonXYZ.dll explicitly.
_py_home = os.path.dirname(sys.executable)
_py_dlls = []
for _name in (
    f'python{sys.version_info.major}{sys.version_info.minor}.dll',
    f'python{sys.version_info.major}.dll',
):
    _p = os.path.join(_py_home, _name)
    if os.path.exists(_p):
        _py_dlls.append((_p, '.'))

a = Analysis(
    [str(repo_root / 'api' / 'main.py')],
    pathex=[
        str(repo_root),
        str(api_dir),
    ],
    binaries=_py_dlls,
    datas=[
        (str(api_dir / 'game_data'),           'game_data'),
        (str(api_dir / 'data'),                'data'),
        (str(api_dir / 'zstd_dictionary.bin'), '.'),
        (str(api_dir / 'assets'),              'assets'),
    ],
    hiddenimports=[
        'hub_czn_version',
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
        'pyautogui',
        'pynput',
        'pynput.mouse',
        'pynput.keyboard',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'cv2', 'numpy', 'matplotlib', 'scipy'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
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
    uac_admin=True,  # embed requireAdministrator so the sidecar is always elevated on Windows 10/11
)
