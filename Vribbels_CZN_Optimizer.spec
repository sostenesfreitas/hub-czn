# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path

src = Path('Vribbels')

a = Analysis(
    [str(src / 'czn_optimizer_gui.py')],
    pathex=[str(src)],
    binaries=[],
    datas=[
        (str(src / 'images'),          'images'),
        (str(src / 'zstd_dictionary.bin'), '.'),
    ],
    hiddenimports=[
        'PIL._tkinter_finder',
        'PIL.Image',
        'PIL.ImageTk',
        'PIL.ImageDraw',
        'PIL.ImageFont',
        'packaging.version',
        'requests',
        'zstandard',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Hub_CZN_Optimizer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,          # no black console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(src / 'images' / 'app_icon.ico'),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Hub_CZN_Optimizer',
)
