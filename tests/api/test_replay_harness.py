"""Unit tests for ReplayHarness."""
import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from api.simulator.replay.capture_reader import CaptureEvent
from api.simulator.replay.dev_msg_parser import SkillEffFire
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
        CaptureEvent(ts="t0", seq=0, snapshot=_minimal_bw(), is_state_update=True,
                     skill_eff_fires=[SkillEffFire(skill_eff_id="c_1057_srt1_01", eff_type="SKILL_EFF_DMG")]),
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
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, is_state_update=True,
                     skill_eff_fires=[SkillEffFire(skill_eff_id="c_1057_srt1_01", eff_type="SKILL_EFF_DMG")]),
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
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, is_state_update=True,
                     skill_eff_fires=[SkillEffFire(skill_eff_id="unknown_id", eff_type="SKILL_EFF_DMG")]),
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
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot=bw, is_state_update=True,
                     skill_eff_fires=[SkillEffFire(skill_eff_id="c_x", eff_type="SKILL_EFF_DMG")]),
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
        CaptureEvent(ts="t0", seq=0, snapshot=bw1, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False,
                     skill_eff_fires=[SkillEffFire(skill_eff_id="c_x", eff_type="SKILL_EFF_DMG")]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw2, is_state_update=True, skill_eff_fires=[]),
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
        CaptureEvent(ts="t0", seq=0, snapshot=bw1, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False,
                     skill_eff_fires=[SkillEffFire(skill_eff_id="c_x", eff_type="SKILL_EFF_DMG")]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw2, is_state_update=True, skill_eff_fires=[]),
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


def test_harness_resolves_caster_from_fire_caster_id():
    """If SkillEffFire has caster_id matching a unit's id, the harness uses that
    unit as caster (not player_team[0])."""
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}
    runtime.apply = MagicMock(return_value=EffectResult(damage=100, target_id="79"))

    bw = _minimal_bw()
    # extend bw to have two chars; second one has id="2"
    bw["chars"].append({"id": 2, "res_id": "1062",
                        "status": {"info": {"S_ATK": 1500}}})
    fire = SkillEffFire(skill_eff_id="c_x", eff_type="SKILL_EFF_DMG", caster_id="2")
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False, skill_eff_fires=[fire]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    # the caster passed to runtime.apply should be the char with id="2"
    call_args = runtime.apply.call_args
    assert call_args is not None
    passed_caster = call_args.args[1] if len(call_args.args) > 1 else call_args.kwargs.get("caster")
    assert str(passed_caster.id) == "2"


def test_harness_falls_back_when_caster_id_not_in_state():
    """If SkillEffFire.caster_id doesn't match any unit, fall back to player_team[0]."""
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}
    runtime.apply = MagicMock(return_value=EffectResult(damage=100, target_id="79"))

    bw = _minimal_bw()
    fire = SkillEffFire(skill_eff_id="c_x", eff_type="SKILL_EFF_DMG", caster_id="999")
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False, skill_eff_fires=[fire]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert reports[0].status == "dispatched"
    # row records inferred_caster=True
    assert reports[0].inferred_caster is True


def test_harness_uses_fire_target_id_for_obs_lookup():
    """When SkillEffFire.target_id is set, obs_damage is read from that monster's lastDamageEvent."""
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}
    runtime.apply = MagicMock(return_value=EffectResult(damage=950, target_id=None))

    bw1 = _minimal_bw()
    bw2 = _minimal_bw()
    # second monster id 200, with lastDamageEvent.damage=1000
    bw2["monsters"].append({"id": 200, "res_id": "z", "state": "alive",
                            "status": {"info": {"S_HP": 9999, "S_DEF": 100, "S_CURRENT_HP": 9999}},
                            "lastDamageEvent": {"damage": 1000, "old_hp": 9999, "new_hp": 8999}})
    fire = SkillEffFire(skill_eff_id="c_x", eff_type="SKILL_EFF_DMG",
                        caster_id="1", target_id="200")
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw1, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False, skill_eff_fires=[fire]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw2, is_state_update=True, skill_eff_fires=[]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert reports[0].obs_damage == 1000  # read from monster id=200, not 79


def test_render_report_includes_char_names_in_outlier_table():
    from api.simulator.replay.char_resolver import CharResolver

    summary = ReplaySummary(total_events=2, dispatched_dmg_within_5pct=0,
                            dispatched_dmg_outside_5pct=1,
                            by_eff_type={
                                "SKILL_EFF_DMG": {"dispatched": 1, "stub": 0, "missing": 0,
                                                  "crashed": 0, "no_target": 0},
                            })
    reports = [
        EventReport(seq=11, skill_eff_id="c_30093_uni4_lbk_mut1_01",
                    eff_type="SKILL_EFF_DMG", status="dispatched",
                    sim_damage=12227, obs_damage=300, delta_pct=39.76,
                    target_id="79"),
    ]
    md = render_report(summary, reports, capture_id="test", char_resolver=CharResolver())
    # caster char id 30093 → Heidemarie should appear in the outliers table
    assert "Heidemarie" in md


def test_extract_obs_skips_auto_attack_last_damage_event():
    """lastDamageEvent with is_auto=true represents an auto-attack tick,
    not a player skill hit. Treat as no observation."""
    snapshot = {
        "monsters": [{
            "id": 38,
            "lastDamageEvent": {
                "damage": 30, "is_auto": True,
                "type": ["DMG_ATTR_FIX", "DMG_ATTR_AUTO"],
                "old_hp": 1100, "new_hp": 1070,
            },
        }],
    }
    obs = ReplayHarness._extract_observed_damage_from_snapshot(snapshot, "38")
    assert obs is None  # auto-attack tick is filtered out


def test_extract_obs_returns_damage_for_real_skill_hit():
    """A non-auto lastDamageEvent IS a player skill hit — return its damage."""
    snapshot = {
        "monsters": [{
            "id": 38,
            "lastDamageEvent": {
                "damage": 543, "is_auto": False,
                "type": ["DMG_ATTR_BASE_ON_DEF"],
                "old_hp": 1100, "new_hp": 557,
            },
        }],
    }
    obs = ReplayHarness._extract_observed_damage_from_snapshot(snapshot, "38")
    assert obs == 543


def test_harness_resolves_caster_via_skill_eff_id_prefix():
    """When dev_msg has no caster_id but skill_eff_id encodes a char_res_id,
    the harness resolves via res_id prefix match."""
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}
    runtime.apply = MagicMock(return_value=EffectResult(damage=100, target_id="38"))

    bw = _minimal_bw()
    bw["chars"][0]["res_id"] = "30093"  # Heidemarie's res_id
    # caster_id absent, but skill_eff_id encodes char 30093
    fire = SkillEffFire(skill_eff_id="c_30093_uni4_lbk_mut1_01",
                        eff_type="SKILL_EFF_DMG", caster_id=None)
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False, skill_eff_fires=[fire]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    assert reports[0].inferred_caster is False


def test_harness_resolves_caster_via_card_owner_lookup():
    """When SkillEffFire.caster_id is a card-instance-id (not a unit id),
    the harness translates via state.card_owner_lookup."""
    from api.simulator.result import EffectResult
    runtime = MagicMock()
    instances = MagicMock()
    runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    instances.get = MagicMock(return_value=fake_inst)
    runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}
    runtime.apply = MagicMock(return_value=EffectResult(damage=100, target_id="79"))

    bw = _minimal_bw()
    bw["chars"].append({"id": 2, "res_id": "1062",
                        "status": {"info": {"S_ATK": 1500}}})
    bw["cardMap"] = {
        "54": {"id": 54, "res_id": "card_x", "char_id": 2, "cost": 1,
               "card_place": "CARD_PLACE_HAND", "skill_eff_ids": ["card_x_01"],
               "r_spark": "none", "curEgo": 0, "interruptOutline": False},
    }
    fire = SkillEffFire(skill_eff_id="card_x_01", eff_type="SKILL_EFF_DMG", caster_id="54")
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False, skill_eff_fires=[fire]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw, is_state_update=True, skill_eff_fires=[]),
    ])
    summary, reports = ReplayHarness(runtime, StateReconstructor()).replay(reader)
    call_args = runtime.apply.call_args
    passed_caster = call_args.args[1] if len(call_args.args) > 1 else call_args.kwargs.get("caster")
    assert str(passed_caster.id) == "2"
    assert reports[0].inferred_caster is False


def test_harness_populates_dva_stacks_on_dispatched_events():
    """When the accumulator has stacks on target before a SkillEff fires,
    EventReport.dva_stacks_observed reflects them via state.dva_stacks."""
    from api.simulator.result import EffectResult
    from api.simulator.replay.event_parser import StackAddEvent, SkillEffEvent

    fake_runtime = MagicMock()
    instances = MagicMock()
    fake_runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    fake_inst.link_cs_id = ["cs_91"]
    instances.get = MagicMock(return_value=fake_inst)
    fake_runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}

    def fake_apply(skill_eff_id, caster, state):
        dva = getattr(state, "dva_stacks", None)
        target_stacks = dva.get("38", {}) if dva else {}
        observed = {cs_id: target_stacks.get(cs_id, 0) for cs_id in ["cs_91"]}
        return EffectResult(damage=100, target_id="38",
                             dva_stacks_observed=observed)
    fake_runtime.apply = fake_apply

    bw = _minimal_bw()
    stack_add_ev = StackAddEvent(seq=0, raw_line="", actor_id="1",
                                  target_id="38", target_role="monster",
                                  cs_id="cs_91", value=3, sign="MATHSIGN_ADD")
    skill_eff_ev = SkillEffEvent(seq=1, raw_line="", skill_eff_id="c_x_01",
                                  eff_type="SKILL_EFF_DMG", seq_num=1)
    fire = SkillEffFire(skill_eff_id="c_x_01", eff_type="SKILL_EFF_DMG",
                       caster_id="1")
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True,
                     skill_eff_fires=[], parsed_events=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False,
                     skill_eff_fires=[fire],
                     parsed_events=[stack_add_ev, skill_eff_ev]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw, is_state_update=True,
                     skill_eff_fires=[], parsed_events=[]),
    ])
    summary, reports = ReplayHarness(fake_runtime, StateReconstructor()).replay(reader)
    assert reports[0].dva_stacks_observed == {"cs_91": 3}


def test_render_report_includes_stacks_column_for_dispatched_events():
    """Outlier rows for dispatched DMG events with observed stacks show a
    'stacks' column listing 'cs_id=count' joined by commas."""
    summary = ReplaySummary(
        total_events=1, dispatched_dmg_within_5pct=0,
        dispatched_dmg_outside_5pct=1,
        by_eff_type={"SKILL_EFF_DMG": {
            "dispatched": 1, "stub": 0, "missing": 0, "crashed": 0, "no_target": 0,
        }},
    )
    reports = [
        EventReport(
            seq=11, skill_eff_id="c_30093_uni4_lbk_mut1_01",
            eff_type="SKILL_EFF_DMG", status="dispatched",
            sim_damage=12227, obs_damage=300, delta_pct=39.76,
            target_id="79",
            dva_stacks_observed={"cs_91": 3, "cs_112": 1},
        ),
    ]
    md = render_report(summary, reports, capture_id="test")
    assert "cs_91=3" in md
    assert "cs_112=1" in md


def test_harness_sets_cs_multiplier_index_on_state():
    """When the harness populates state.dva_stacks, it should also set
    state.cs_multiplier_index so the formula can compose multipliers."""
    from api.simulator.result import EffectResult
    from api.simulator.replay.event_parser import StackAddEvent, SkillEffEvent

    captured_state_attrs = []

    fake_runtime = MagicMock()
    instances = MagicMock()
    fake_runtime._instances = instances
    fake_inst = MagicMock()
    fake_inst.eff_type = "SKILL_EFF_DMG"
    fake_inst.link_cs_id = []
    instances.get = MagicMock(return_value=fake_inst)
    fake_runtime._catalog = {"SKILL_EFF_DMG": {"effect": {"formula_ref": "F_BASE_DMG"}}}

    def fake_apply(skill_eff_id, caster, state):
        captured_state_attrs.append(getattr(state, "cs_multiplier_index", None))
        return EffectResult(damage=100, target_id="38")

    fake_runtime.apply = fake_apply

    bw = _minimal_bw()
    stack_add_ev = StackAddEvent(
        seq=0, raw_line="", actor_id="1", target_id="38",
        target_role="monster", cs_id="cs_91", value=3, sign="MATHSIGN_ADD",
    )
    skill_eff_ev = SkillEffEvent(
        seq=1, raw_line="", skill_eff_id="c_x_01",
        eff_type="SKILL_EFF_DMG", seq_num=1,
    )
    fire = SkillEffFire(skill_eff_id="c_x_01", eff_type="SKILL_EFF_DMG", caster_id="1")
    reader = _FakeReader([
        CaptureEvent(ts="t0", seq=0, snapshot=bw, is_state_update=True,
                     skill_eff_fires=[], parsed_events=[]),
        CaptureEvent(ts="t1", seq=1, snapshot={}, is_state_update=False,
                     skill_eff_fires=[fire],
                     parsed_events=[stack_add_ev, skill_eff_ev]),
        CaptureEvent(ts="t2", seq=2, snapshot=bw, is_state_update=True,
                     skill_eff_fires=[], parsed_events=[]),
    ])
    summary, reports = ReplayHarness(fake_runtime, StateReconstructor()).replay(reader)
    # Harness should have set state.cs_multiplier_index before fake_apply was called
    assert len(captured_state_attrs) == 1
    assert captured_state_attrs[0] is not None


# ---------------------------------------------------------------------------
# Sprint 2f5 — chain caster resolution via accumulator.caster_at (path 4)
# ---------------------------------------------------------------------------


def _make_state_for_resolve():
    """Build a minimal BattleState with two player chars and one enemy
    suitable for _resolve_caster() direct tests."""
    bw = _minimal_bw()
    bw["chars"].append({"id": 2, "res_id": "1062",
                        "status": {"info": {"S_ATK": 1500}}})
    return StateReconstructor().reconstruct(bw)


def test_resolve_caster_uses_segment_caster_when_paths_1_to_3_fail():
    """When direct match (1), card_owner_lookup (2), and prefix (3) all
    miss, the segment_caster (path 4) must be consulted before the
    player_team[0] fallback. A chain SkillEff like 'cs01_0473_01' has
    no player-prefix and no caster_id; without path 4 it falls back to
    player_team[0] with inferred=True."""
    state = _make_state_for_resolve()
    # caster_id=None (no direct/lookup), skill_eff_id is a chain effect
    # whose prefix doesn't match any char res_id => paths 1-3 all miss.
    unit, inferred = ReplayHarness._resolve_caster(
        None, state, skill_eff_id="cs01_0473_01", segment_caster="2",
    )
    assert unit is not None
    assert str(unit.id) == "2"
    assert inferred is False, "segment_caster is authoritative, not inferred"


def test_resolve_caster_prefix_match_preferred_over_segment_caster():
    """Path 3 (skill_eff_id prefix) must run BEFORE path 4 (segment_caster):
    if the skill encodes a real char res_id, trust that — segment_caster
    may belong to a different actor."""
    state = _make_state_for_resolve()
    # state.chars: id=1 res_id=1057, id=2 res_id=1062
    # skill_eff_id encodes char 1057 (player_team[0]), segment_caster says "2"
    unit, inferred = ReplayHarness._resolve_caster(
        None, state, skill_eff_id="c_1057_srt1_01", segment_caster="2",
    )
    assert str(unit.id) == "1"
    assert inferred is False


def test_resolve_caster_falls_back_when_segment_caster_does_not_match():
    """If segment_caster is set but doesn't match any unit in
    player_team or enemies, path 4 falls through to path 5 (player_team[0]
    with inferred=True). This guards against stale segment_caster values."""
    state = _make_state_for_resolve()
    unit, inferred = ReplayHarness._resolve_caster(
        None, state, skill_eff_id="cs01_0473_01", segment_caster="999",
    )
    assert str(unit.id) == "1"  # player_team[0]
    assert inferred is True


def test_resolve_caster_segment_caster_none_falls_through():
    """When segment_caster is None (no active UsedCardEvent), path 4
    is a no-op and we fall through to player_team[0] fallback."""
    state = _make_state_for_resolve()
    unit, inferred = ReplayHarness._resolve_caster(
        None, state, skill_eff_id="cs01_0473_01", segment_caster=None,
    )
    assert str(unit.id) == "1"
    assert inferred is True
