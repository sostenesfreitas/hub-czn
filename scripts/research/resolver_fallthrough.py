"""Sprint 2g1: aggregate path_num distribution across all available captures.
Identifies which skill_eff_id patterns dominate the path-5 fallback (inferred).

Usage: python scripts/research/resolver_fallthrough.py
"""
import json
import sys
import re
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.runtime import Runtime
from api.simulator.replay.capture_reader import CaptureReader
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.harness import ReplayHarness

CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG = REPO / "api" / "data" / "eff_type_catalog.json"

CAPTURES = [
    REPO / "api" / "snapshots" / "websocket_debug_20260511_100845.jsonl",
    Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260510_154057.jsonl"),
    Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260509_111039.jsonl"),
    Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260505_104037.jsonl"),
]

# Pattern extractor: classify skill_eff_id by prefix
def classify(seid: str) -> str:
    if seid.startswith("c_"):
        m = re.match(r"^c_(\d+)_", seid)
        return f"c_<charid>_*  (char id={m.group(1)})" if m else "c_*"
    if seid.startswith("cs0"):
        m = re.match(r"^(cs\d{2}_\d{4})", seid)
        return f"cs-prefix ({m.group(1)}*)" if m else "cs*"
    if seid.startswith("eq_"):
        m = re.match(r"^(eq_[a-z]+)", seid)
        return f"eq-prefix ({m.group(1)}*)" if m else "eq_*"
    if seid.startswith("add_r_spark"):
        return "add_r_spark_*"
    if seid.startswith("p_"):
        return "p_* (partner?)"
    if re.match(r"^\d{5,}_", seid):
        return f"monster_prefix ({seid.split('_')[0]}*)"
    return "other"


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)

    overall_paths = Counter()
    fallthrough_patterns = Counter()
    fallthrough_eff_types = Counter()
    per_capture = {}

    for cap_path in CAPTURES:
        if not cap_path.exists():
            print(f"MISSING: {cap_path.name}")
            continue
        runtime = Runtime(catalog=catalog, instances=instances)
        harness = ReplayHarness(runtime, StateReconstructor())
        summary, reports = harness.replay(CaptureReader(cap_path))
        dispatched = [r for r in reports if r.status == "dispatched"]
        cap_paths = Counter(r.resolution_path for r in dispatched)
        resolved = sum(c for p, c in cap_paths.items() if p != 5)
        per_capture[cap_path.name] = (len(dispatched), cap_paths, resolved)
        for r in dispatched:
            overall_paths[r.resolution_path] += 1
            if r.resolution_path == 5:
                fallthrough_patterns[classify(r.skill_eff_id)] += 1
                fallthrough_eff_types[r.eff_type or "?"] += 1

    print("=" * 70)
    print("Per-capture path distribution:")
    all_paths = (1, 2, 3, 4, 5, 6)
    for name, (total, paths, resolved) in per_capture.items():
        pct = resolved / total * 100 if total else 0
        print(f"  {name}: dispatched={total} resolved={resolved} ({pct:.1f}%)")
        for p in all_paths:
            print(f"    path {p}: {paths.get(p, 0)}")
    print()
    print("=" * 70)
    print(f"Overall path totals: {dict(overall_paths)}")
    total = sum(overall_paths.values())
    if total:
        for p in all_paths:
            n = overall_paths.get(p, 0)
            print(f"  path {p}: {n} ({n/total*100:.1f}%)")
    print()
    print("=" * 70)
    print("Top path-5 (fallback) skill_eff_id patterns:")
    for pattern, count in fallthrough_patterns.most_common(20):
        print(f"  {count:5d}  {pattern}")
    print()
    print("Top path-5 eff_types:")
    for eff_type, count in fallthrough_eff_types.most_common(15):
        print(f"  {count:5d}  {eff_type}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
