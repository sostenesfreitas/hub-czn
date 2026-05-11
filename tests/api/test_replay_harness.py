"""Unit tests for ReplayHarness."""
import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from api.simulator.replay.capture_reader import CaptureEvent
from api.simulator.replay.harness import ReplayHarness, EventReport, ReplaySummary
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.report import render_report


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
        CaptureEvent(ts="t0", seq=0, snapshot=_minimal_bw(), is_state_update=True, skill_eff_ids=["c_1057_srt1_01"]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    # state is set on the first is_state_update event; skill_eff_ids are only
    # dispatched when state is ALREADY set (i.e. after the first baseline).
    # With only one event, skill fires but state was None when we checked,
    # so nothing dispatches.
    runtime.apply.assert_not_called()
    assert summary.total_events == 0
    assert reports == []


def test_dispatch_records_event_report():
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    runtime.apply = MagicMock(return_value=EffectResult(damage=500, target_id="79"))
    bw = _minimal_bw()
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, is_state_update=True, skill_eff_ids=["c_1057_srt1_01"]),
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
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, is_state_update=True, skill_eff_ids=["unknown_id"]),
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
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, is_state_update=True, skill_eff_ids=["c_x"]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert summary.crashed == 1
    assert reports[0].status == "crashed"
    assert "boom" in reports[0].error


def test_damage_within_5_percent_categorized_correctly():
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}
    runtime.apply = MagicMock(return_value=EffectResult(damage=950, target_id="79"))
    bw1 = _minimal_bw()
    bw2 = _minimal_bw()
    bw2["monsters"][0]["lastDamageEvent"] = {"damage": 1000, "old_hp": 5000, "new_hp": 4000}
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw1, is_state_update=True, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False, skill_eff_ids=["c_x"]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw2, is_state_update=True, skill_eff_ids=[]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert reports[0].status == "dispatched"
    assert reports[0].obs_damage == 1000
    assert reports[0].delta_pct is not None
    assert abs(reports[0].delta_pct) <= 0.05
    assert summary.dispatched_dmg_within_5pct == 1


def test_damage_outside_5_percent_counted_in_outliers():
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}
    runtime.apply = MagicMock(return_value=EffectResult(damage=500, target_id="79"))
    bw1 = _minimal_bw()
    bw2 = _minimal_bw()
    bw2["monsters"][0]["lastDamageEvent"] = {"damage": 1000, "old_hp": 5000, "new_hp": 4000}
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw1, is_state_update=True, skill_eff_ids=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False, skill_eff_ids=["c_x"]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw2, is_state_update=True, skill_eff_ids=[]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert summary.dispatched_dmg_outside_5pct == 1


def test_render_report_contains_summary_and_per_eff_type():
    summary = ReplaySummary(total_events=10, crashed=0,
                            dispatched_dmg_within_5pct=4, dispatched_dmg_outside_5pct=2,
                            stubbed=3, missing_from_index=1, no_target=0,
                            by_eff_type={
                                "SKILL_EFF_DMG": {"dispatched": 6, "stub": 0, "missing": 0, "crashed": 0, "no_target": 0},
                                "SKILL_EFF_NONE": {"dispatched": 0, "stub": 3, "missing": 0, "crashed": 0, "no_target": 0},
                            })
    reports = [
        EventReport(seq=5, skill_eff_id="c_a", eff_type="SKILL_EFF_DMG",
                    status="dispatched", sim_damage=1200, obs_damage=1000, delta_pct=0.20),
        EventReport(seq=6, skill_eff_id="c_b", eff_type="SKILL_EFF_DMG",
                    status="dispatched", sim_damage=950, obs_damage=1000, delta_pct=-0.05),
    ]
    md = render_report(summary, reports, capture_id="test_capture")
    assert "test_capture" in md
    assert "Total events: 10" in md
    assert "SKILL_EFF_DMG" in md
    assert "SKILL_EFF_NONE" in md
    # outliers section sorts by abs(delta_pct) desc
    assert md.index("c_a") < md.index("c_b")
