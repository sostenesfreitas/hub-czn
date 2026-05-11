"""Unit tests for CaptureReader."""
import json
from pathlib import Path

import pytest

from api.simulator.replay.capture_reader import CaptureReader, CaptureEvent
from api.simulator.replay.dev_msg_parser import SkillEffFire
from api.simulator.replay.event_parser import UsedCardEvent, SkillEffEvent


def _write_jsonl(tmp_path: Path, frames: list[dict]) -> Path:
    p = tmp_path / "cap.jsonl"
    with p.open("w", encoding="utf-8") as f:
        for fr in frames:
            f.write(json.dumps(fr) + "\n")
    return p


def test_skips_non_s2c_frames(tmp_path):
    cap = _write_jsonl(tmp_path, [
        {"ts": "t0", "dir": "http_req", "method": "GET", "url": "u", "size": 0, "data": None},
        {"ts": "t1", "dir": "http_resp", "method": "GET", "url": "u", "size": 0, "data": None},
        {"ts": "t2", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {"battle_wt": {"foo": 1}}}}},
    ])
    events = list(CaptureReader(cap).events())
    assert len(events) == 1
    assert events[0].snapshot == {"foo": 1}


def test_skips_s2c_frames_without_battle_wt_and_without_skill_eff(tmp_path):
    """Frames with no battle_wt AND no SkillEff lines are silently skipped."""
    cap = _write_jsonl(tmp_path, [
        {"ts": "t0", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {}}}},
        {"ts": "t1", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {"battle_wt": {"foo": 1}}}}},
    ])
    events = list(CaptureReader(cap).events())
    assert len(events) == 1


def test_parses_skill_eff_lines_from_dev_msg(tmp_path):
    dev_msg = "**battle log : Battle Start\n**battle log : SkillEff 3:c_1057_srt1_01:SKILL_EFF_DMG\n**battle log : SkillEff 4:c_1057_srt1_02:SKILL_EFF_CS_SET_ADD\n"
    cap = _write_jsonl(tmp_path, [{
        "ts": "t0", "dir": "s2c", "size": 1,
        "data": {"snapshot": {"cache": {"battle_wt": {"foo": 1}}}, "dev_msg": dev_msg},
    }])
    events = list(CaptureReader(cap).events())
    assert len(events) == 1
    assert events[0].skill_eff_ids == ["c_1057_srt1_01", "c_1057_srt1_02"]


def test_first_battle_wt_returns_initial_snapshot(tmp_path):
    cap = _write_jsonl(tmp_path, [
        {"ts": "t0", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {"battle_wt": {"x": 1}}}}},
        {"ts": "t1", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {"battle_wt": {"x": 2}}}}},
    ])
    bw = CaptureReader(cap).first_battle_wt()
    assert bw == {"x": 1}


def test_seq_is_zero_indexed(tmp_path):
    cap = _write_jsonl(tmp_path, [
        {"ts": "t0", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {"battle_wt": {"a": 1}}}}},
        {"ts": "t1", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {"battle_wt": {"b": 2}}}}},
    ])
    events = list(CaptureReader(cap).events())
    assert events[0].seq == 0
    assert events[1].seq == 1


def test_yields_skill_eff_frame_without_battle_wt(tmp_path):
    """SkillEff frame may arrive without battle_wt in the same s2c frame."""
    dev_msg = "**battle log : SkillEff 3:c_x_01:SKILL_EFF_DMG\n"
    cap = _write_jsonl(tmp_path, [{
        "ts": "t0", "dir": "s2c", "size": 1,
        "data": {"dev_msg": dev_msg},  # no snapshot at all
    }])
    events = list(CaptureReader(cap).events())
    assert len(events) == 1
    assert events[0].is_state_update is False
    assert events[0].snapshot == {}
    assert events[0].skill_eff_ids == ["c_x_01"]


def test_state_update_frame_sets_flag(tmp_path):
    cap = _write_jsonl(tmp_path, [
        {"ts": "t0", "dir": "s2c", "size": 1, "data": {"snapshot": {"cache": {"battle_wt": {"foo": 1}}}}},
    ])
    events = list(CaptureReader(cap).events())
    assert events[0].is_state_update is True
    assert events[0].snapshot == {"foo": 1}


def test_capture_event_exposes_skill_eff_fires_with_caster(tmp_path):
    dev_msg = (
        "**battle log : --------card_use-start--------\n"
        "**battle log : 103 used card 1006005_01_pt2_10\n"
        "**battle log : SkillEff 5:1006005_01_pt2_10_01:SKILL_EFF_DMG\n"
    )
    cap = _write_jsonl(tmp_path, [{
        "ts": "t0", "dir": "s2c", "size": 1,
        "data": {"dev_msg": dev_msg},
    }])
    events = list(CaptureReader(cap).events())
    assert len(events) == 1
    assert len(events[0].skill_eff_fires) == 1
    fire = events[0].skill_eff_fires[0]
    assert isinstance(fire, SkillEffFire)
    assert fire.caster_id == "103"
    # backwards compat: skill_eff_ids still resolves via property
    assert events[0].skill_eff_ids == ["1006005_01_pt2_10_01"]


def test_capture_event_populates_parsed_events(tmp_path):
    dev_msg = (
        "**battle log : --------card_use-start--------\n"
        "**battle log : 103 used card 1006005_01_pt2_10\n"
        "**battle log : SkillEff 5:1006005_01_pt2_10_01:SKILL_EFF_DMG\n"
    )
    cap = _write_jsonl(tmp_path, [{
        "ts": "t0", "dir": "s2c", "size": 1,
        "data": {"dev_msg": dev_msg},
    }])
    events = list(CaptureReader(cap).events())
    assert len(events) == 1
    parsed = events[0].parsed_events
    assert len(parsed) == 3  # segment_start + used_card + skill_eff
    types = [type(e).__name__ for e in parsed]
    assert "SegmentStartEvent" in types
    assert "UsedCardEvent" in types
    assert "SkillEffEvent" in types
    # Backwards-compat: skill_eff_fires still populated
    assert len(events[0].skill_eff_fires) == 1
