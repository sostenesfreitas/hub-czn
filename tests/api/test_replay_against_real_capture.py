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


@pytest.mark.slow
def test_real_capture_caster_resolution_rate_above_80_pct():
    """Sprint 2b success criterion #2: At least 80% of dispatched events in
    the real capture must have inferred_caster=False (i.e., caster_id was
    resolved from dev_msg via 'unit_id used card' pattern, not fallback to
    player_team[0]).

    BLOCKER: Current dev_msg format in available captures does not encode
    unit-to-skill mappings in the expected 'X used card Y' format.  Instead,
    recent captures use 'skill_triggered : SEQ_ID:SKILL_ID' which uses
    internal sequence numbers that don't match reconstructed game state unit
    IDs (1, 2, 3, 38).  The parser correctly extracts what's available, but
    the data is missing or uses incompatible ID schemes.  Resolve by either:
    (a) enhancing dev_msg parser to handle new format with proper unit mapping,
    (b) finding captures that include the expected 'X used card Y' format, or
    (c) extracting caster information from battle_wt state directly.
    """
    sprint2b_capture = (
        Path(__file__).resolve().parents[2] / "api" / "snapshots"
        / "websocket_debug_20260511_100845.jsonl"
    )
    if not sprint2b_capture.exists():
        pytest.skip("Sprint 2b primary capture not present")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)
    runtime = Runtime(catalog=catalog, instances=instances)
    harness = ReplayHarness(runtime, StateReconstructor())
    summary, reports = harness.replay(CaptureReader(sprint2b_capture))
    dispatched = [r for r in reports if r.status == "dispatched"]
    if not dispatched:
        pytest.skip("no dispatched events in this capture")
    resolved = [r for r in dispatched if not r.inferred_caster]
    rate = len(resolved) / len(dispatched)
    assert rate >= 0.80, (
        f"caster resolution rate {rate:.1%} below 80% ({len(resolved)}/{len(dispatched)})"
    )
