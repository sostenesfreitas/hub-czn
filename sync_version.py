"""
Sync version from tauri.conf.json to hub_czn_version.py and Cargo.toml.
Called by build.bat before PyInstaller runs so the sidecar always embeds
the correct version. Only tauri.conf.json needs to be edited for releases.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent

conf = ROOT / "src-tauri" / "tauri.conf.json"
version = json.loads(conf.read_text(encoding="utf-8"))["version"]

py_file = ROOT / "api" / "hub_czn_version.py"
py_file.write_text(f'__version__ = "{version}"\n', encoding="utf-8")

cargo_file = ROOT / "src-tauri" / "Cargo.toml"
cargo = cargo_file.read_text(encoding="utf-8")
cargo = re.sub(r'^version = "[\d.]+"', f'version = "{version}"', cargo, count=1, flags=re.MULTILINE)
cargo_file.write_text(cargo, encoding="utf-8")

print(f"[sync_version] {version} synced to hub_czn_version.py and Cargo.toml")
