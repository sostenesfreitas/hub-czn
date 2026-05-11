"""Level 3 regression: real capture must replay without any crash."""
import json
from pathlib import Path

import pytest

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.runtime import Runtime
from api.simulator.replay.capture_reader import CaptureReader
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.harness import ReplayHarness


REPO = Path(__file__).resolve().parents[2]
CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG_PATH = REPO / "api" / "data" / "eff_type_catalog.json"
CAPTURE_PATH = (
    Path.home()
    / "AppData" / "Local" / "hub-czn" / "snapshots"
    / "websocket_debug_20260510_154057.jsonl"
)


@pytest.mark.slow
def test_real_capture_replays_without_crash():
    if not CAPTURE_PATH.exists():
        pytest.skip(f"capture not present at {CAPTURE_PATH}")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)
    runtime = Runtime(catalog=catalog, instances=instances)
    harness = ReplayHarness(runtime, StateReconstructor())
    summary, reports = harness.replay(CaptureReader(CAPTURE_PATH))

    assert summary.total_events >= 10, (
        f"capture parsed only {summary.total_events} events — expected at least 10"
    )
    assert summary.crashed == 0, (
        f"{summary.crashed} crashed events. First 5: "
        + str([(r.seq, r.skill_eff_id, r.error) for r in reports if r.status == 'crashed'][:5])
    )
