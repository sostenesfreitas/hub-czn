"""Sprint 2f5 Feature 2 — DR formula sign investigation."""
import json
from pathlib import Path

CAP = Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260510_154057.jsonl")
seen = {}
for line in CAP.open("r", encoding="utf-8"):
    try:
        raw = json.loads(line)
    except json.JSONDecodeError:
        continue
    data = raw.get("data", {})
    if not isinstance(data, dict):
        continue
    bw = (data.get("snapshot") or {}).get("cache", {}).get("battle_wt")
    if not isinstance(bw, dict):
        continue
    for m in bw.get("monsters", []):
        info = m.get("status", {}).get("info", {})
        mid = m.get("id")
        dr = info.get("S_DMG_DECREASE_RATE", 0)
        defn = info.get("S_DEF", 0)
        if mid not in seen and defn > 0:
            seen[mid] = (defn, dr)
print("monster_id: (DEF, DR_actual, DR_formula_268/(def+503))")
for k, (d, r) in sorted(seen.items())[:15]:
    formula = 268.0 / (d + 503.0)
    match = "MATCH" if abs(r - formula) < 0.05 else "MISMATCH"
    print(f"  {k}: DEF={d} DR={r} formula={formula:.4f} {match}")
