"""Unit tests for ReplayHarness."""
import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from api.simulator.replay.capture_reader import CaptureEvent
from api.simulator.replay.harness import ReplayHarness, EventReport, ReplaySummary
from api.simulator.replay.reconstructor import StateReconstructor


class _FakeReader:
    """Stand-in for CaptureReader that yields prebuilt events."""
    def __init__(self, events: list[CaptureEvent]):
        self._events = events
    def events(self):
        return iter(self._events)
    def first_battle_wt(self) -> dict | None:
        return self._events[0].snapshot if self._events else None


def _minimal_bw():
    return {
        "chars": [{"id": 1, "res_id": "1057", "status": {"info": {"S_ATK": 1000}}}],
        "monsters": [{"id": 79, "res_id": "x", "state": "alive",
                      "status": {"info": {"S_HP": 5000, "S_DEF": 200, "S_DMG_DECREASE_RATE": 0.3, "S_CURRENT_HP": 5000}}}],
        "cardMap": {}, "csMap": {}, "used_cards": [],
    }


def test_first_event_is_baseline_no_dispatch():
    runtime = MagicMock()
    runtime.apply = MagicMock()
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=_minimal_bw(), skill_eff_ids=["c_1057_srt1_01"]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    # baseline frame doesn't dispatch
    runtime.apply.assert_not_called()
    assert summary.total_events == 0
    assert reports == []


def test_dispatch_records_event_report():
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    runtime.apply = MagicMock(return_value=EffectResult(damage=500, target_id="79"))
    bw = _minimal_bw()
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, skill_eff_ids=["c_1057_srt1_01"]),
    ])
    instances = MagicMock()
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    runtime._instances = instances
    instances.get = MagicMock(return_value=fake_inst)
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert summary.total_events == 1
    assert len(reports) == 1
    assert reports[0].seq == 1
    assert reports[0].skill_eff_id == "c_1057_srt1_01"
    assert reports[0].status in {"dispatched", "stub", "no_target"}


def test_runtime_keyerror_records_missing():
    runtime = MagicMock()
    runtime.apply = MagicMock(side_effect=KeyError("not in index"))
    instances = MagicMock()
    instances.get = MagicMock(side_effect=KeyError("not in index"))
    runtime._instances = instances
    bw = _minimal_bw()
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, skill_eff_ids=["unknown_id"]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert summary.missing_from_index == 1
    assert reports[0].status == "missing"


def test_runtime_unexpected_exception_records_crashed():
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime.apply = MagicMock(side_effect=RuntimeError("boom"))
    bw = _minimal_bw()
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, skill_eff_ids=["c_x"]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert summary.crashed == 1
    assert reports[0].status == "crashed"
    assert "boom" in reports[0].error
