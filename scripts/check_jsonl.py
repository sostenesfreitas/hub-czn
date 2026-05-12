"""Diagnostic script: inspect what data keys are in capture JSONL files."""
import json
from pathlib import Path

snapshot_dir = Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots")

for fn in sorted(snapshot_dir.glob("websocket_debug_*.jsonl")):
    total = 0
    has_chars = 0
    has_equipped = 0
    has_status_info = 0
    all_data_keys = {}
    with fn.open("r", encoding="utf-8") as f:
        for line in f:
            total += 1
            try:
                obj = json.loads(line)
            except Exception:
                continue
            d = obj.get("data") or {}
            if not isinstance(d, dict):
                continue
            for k in list(d.keys())[:5]:
                all_data_keys[k] = all_data_keys.get(k, 0) + 1
            chars = d.get("chars")
            if isinstance(chars, list):
                has_chars += 1
                for ch in chars:
                    if isinstance(ch, dict) and ch.get("equipped_pieces"):
                        has_equipped += 1
                    if isinstance(ch, dict) and isinstance(ch.get("status"), dict) and ch["status"].get("info"):
                        has_status_info += 1

    top_keys = sorted(all_data_keys.items(), key=lambda x: -x[1])[:10]
    print(f"\n{fn.name}")
    print(f"  total lines: {total}")
    print(f"  lines with 'chars' key: {has_chars}")
    print(f"  chars with equipped_pieces: {has_equipped}")
    print(f"  chars with status.info: {has_status_info}")
    print(f"  top data keys: {top_keys}")
