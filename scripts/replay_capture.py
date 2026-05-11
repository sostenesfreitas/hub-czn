"""
Replay a captured battle through the Sprint 1 runtime and write a fidelity
report to docs/research/replay_report_<capture-id>.md.

Run:
  python scripts/replay_capture.py <path-to-capture.jsonl>

If no path is given, defaults to the most recent capture in the user's
%LOCALAPPDATA%\\hub-czn\\snapshots\\ directory.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.runtime import Runtime
from api.simulator.replay.capture_reader import CaptureReader
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.harness import ReplayHarness
from api.simulator.replay.report import render_report


CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG_PATH = REPO / "api" / "data" / "eff_type_catalog.json"
REPORT_DIR = REPO / "docs" / "research"


def _default_capture() -> Path | None:
    cap_dir = Path.home() / "AppData" / "Local" / "hub-czn" / "snapshots"
    if not cap_dir.exists():
        return None
    captures = sorted(cap_dir.glob("websocket_debug_*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    return captures[0] if captures else None


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        capture_path = Path(argv[1])
    else:
        capture_path = _default_capture()
        if capture_path is None:
            print("No capture path given and no default capture found.", file=sys.stderr)
            return 1

    if not capture_path.exists():
        print(f"Capture not found: {capture_path}", file=sys.stderr)
        return 1

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)
    runtime = Runtime(catalog=catalog, instances=instances)
    reconstructor = StateReconstructor()
    harness = ReplayHarness(runtime, reconstructor)
    reader = CaptureReader(capture_path)

    print(f"Replaying {capture_path.name} ...")
    summary, reports = harness.replay(reader)

    capture_id = capture_path.stem
    md = render_report(summary, reports, capture_id=capture_id)
    out_path = REPORT_DIR / f"replay_report_{capture_id}.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(md, encoding="utf-8")
    print(f"Total events: {summary.total_events}")
    print(f"  dispatched within ±5%: {summary.dispatched_dmg_within_5pct}")
    print(f"  dispatched outside ±5%: {summary.dispatched_dmg_outside_5pct}")
    print(f"  stub: {summary.stubbed}")
    print(f"  missing: {summary.missing_from_index}")
    print(f"  crashed: {summary.crashed}")
    print(f"  no_target: {summary.no_target}")
    print(f"Report -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
