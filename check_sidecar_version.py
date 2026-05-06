"""
Guard script — called by beforeBuildCommand in tauri.conf.json.

Compares modification times:
  - hub_czn_version.py  (written by sync_version.py when version changes)
  - sidecar binary      (written by PyInstaller)

If the sidecar is OLDER than hub_czn_version.py it means sync_version.py
ran (version was bumped) but PyInstaller was NOT re-run, so the sidecar
still has the old version baked in.  The build is aborted immediately.

How to fix the error:
  Run build.bat instead of `npm run tauri build` directly.
  build.bat runs sync_version.py + PyInstaller + npm build + tauri bundle
  in the correct order, guaranteeing the sidecar always matches the version.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent

conf_path = ROOT / "src-tauri" / "tauri.conf.json"
expected = json.loads(conf_path.read_text(encoding="utf-8"))["version"]

version_file = ROOT / "api" / "hub_czn_version.py"
sidecar     = ROOT / "src-tauri" / "binaries" / "hub-czn-api-x86_64-pc-windows-msvc.exe"

if not sidecar.exists():
    print("[check_sidecar] sidecar not found — skipping version check")
    sys.exit(0)

if not version_file.exists():
    print("[check_sidecar] hub_czn_version.py not found — skipping")
    sys.exit(0)

sidecar_mtime  = os.path.getmtime(sidecar)
version_mtime  = os.path.getmtime(version_file)

# Also verify the version file actually contains the expected version.
version_content = version_file.read_text(encoding="utf-8").strip()
expected_line   = f'__version__ = "{expected}"'

if version_content != expected_line:
    print()
    print("=" * 60)
    print("  BUILD ABORTED — hub_czn_version.py is out of sync")
    print(f"  Expected : {expected_line}")
    print(f"  Found    : {version_content}")
    print()
    print("  Run sync_version.py first, or use build.bat.")
    print("=" * 60)
    sys.exit(1)

if sidecar_mtime < version_mtime:
    print()
    print("=" * 60)
    print("  BUILD ABORTED — sidecar was not rebuilt after version bump")
    print(f"  Version expected : {expected}")
    print(f"  hub_czn_version.py modified : {version_mtime:.0f}")
    print(f"  sidecar binary   modified   : {sidecar_mtime:.0f}")
    print()
    print("  PyInstaller must run after every version bump.")
    print("  Use build.bat instead of 'npm run tauri build' directly.")
    print("=" * 60)
    sys.exit(1)

print(f"[check_sidecar] version {expected} OK (sidecar is up to date)")
