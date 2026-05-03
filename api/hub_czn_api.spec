# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the Hub CZN FastAPI sidecar.
# Run from the repo root: pyinstaller api/hub_czn_api.spec --clean --noconfirm

from pathlib import Path

repo_root = Path(SPECPATH).parent  # SPECPATH = .../api; parent = repo root
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
        (str(repo_root / 'api' / 'assets'),  'assets'),
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
        'pyautogui',
        'pynput',
        'pynput.mouse',
        'pynput.keyboard',
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
