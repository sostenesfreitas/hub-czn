"""Unit tests for CaptureReader."""
import json
from pathlib import Path

import pytest

from api.simulator.replay.capture_reader import CaptureReader, CaptureEvent


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


def test_skips_s2c_frames_without_battle_wt(tmp_path):
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
