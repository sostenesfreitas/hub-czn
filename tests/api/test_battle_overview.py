from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

MOCK_SNAPSHOTS = "api.routes.battle._snapshots_dir"


def _write_battle(d: Path, name: str, data: dict, mtime: float | None = None) -> Path:
    p = d / name
    p.write_text(json.dumps(data), encoding="utf-8")
    if mtime is not None:
        os.utime(p, (mtime, mtime))
    return p


def _base_battle(**overrides) -> dict:
    base = {
        "capture_time": "2026-05-04T12:00:00",
        "enemy_def": 500.0,
        "enemy_atk": 300.0,
        "enemy_dmg_decrease": 0.0,
        "battle_result": "CLEAR",
        "mvp_res_id": "1060",
        "char_dpt": {"1060": 1000.0},
        "player_chars": [
            {"res_id": 1060, "atk": 1200, "def": 100, "cri": 60.0, "cri_dmg": 180.0}
        ],
    }
    base.update(overrides)
    return base


def test_overview_404_when_no_data(tmp_path):
    with patch(MOCK_SNAPSHOTS, return_value=tmp_path):
        r = client.get("/api/battle/overview")
    assert r.status_code == 404


def test_overview_200_with_data(tmp_path):
    _write_battle(tmp_path, "battle_001.json", _base_battle(), mtime=1000.0)
    _write_battle(tmp_path, "battle_002.json", _base_battle(), mtime=1001.0)
    with patch(MOCK_SNAPSHOTS, return_value=tmp_path):
        r = client.get("/api/battle/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["total"] == 2
    assert "insights" in body
    assert "chars" in body
    assert "recent" in body


def test_insight_crate_below_breakeven(tmp_path):
    # CRate=38, CDmg=245 → breakeven_delta = 245 - (2*38+100) = 69 > 30 → urgent
    char = {"res_id": 1060, "atk": 1200, "def": 100, "cri": 38.0, "cri_dmg": 245.0}
    battle = _base_battle(player_chars=[char])
    _write_battle(tmp_path, "battle_001.json", battle, mtime=1000.0)
    _write_battle(tmp_path, "battle_002.json", battle, mtime=1001.0)
    with patch(MOCK_SNAPSHOTS, return_value=tmp_path):
        r = client.get("/api/battle/overview")
    assert r.status_code == 200
    urgent = [i for i in r.json()["insights"] if i["level"] == "urgent"]
    assert len(urgent) >= 1


def test_insight_carry_dependency(tmp_path):
    # char 1060: 1000 DPT, char 1061: 100 DPT → 1000/1100 ≈ 90.9% > 55%
    char1 = {"res_id": 1060, "atk": 1200, "def": 100, "cri": 60.0, "cri_dmg": 180.0}
    char2 = {"res_id": 1061, "atk": 800, "def": 100, "cri": 60.0, "cri_dmg": 180.0}
    battle = _base_battle(
        player_chars=[char1, char2],
        char_dpt={"1060": 1000.0, "1061": 100.0},
    )
    _write_battle(tmp_path, "battle_001.json", battle, mtime=1000.0)
    _write_battle(tmp_path, "battle_002.json", battle, mtime=1001.0)
    with patch(MOCK_SNAPSHOTS, return_value=tmp_path):
        r = client.get("/api/battle/overview")
    assert r.status_code == 200
    insights = r.json()["insights"]
    assert any(i["level"] == "warning" and "carry" in i["title"].lower() for i in insights)


def test_char_trend_requires_two_battles(tmp_path):
    _write_battle(tmp_path, "battle_001.json", _base_battle(), mtime=1000.0)
    with patch(MOCK_SNAPSHOTS, return_value=tmp_path):
        r = client.get("/api/battle/overview")
    assert r.status_code == 200
    chars = r.json()["chars"]
    assert len(chars) == 0


def test_dpt_trend_pct_calculation(tmp_path):
    # DPT values [100, 100, 200, 200] → first_half_avg=100, second_half_avg=200 → +100%
    char = {"res_id": 1060, "atk": 1200, "def": 100, "cri": 60.0, "cri_dmg": 180.0}
    for i, dpt in enumerate([100.0, 100.0, 200.0, 200.0]):
        battle = _base_battle(player_chars=[char], char_dpt={"1060": dpt})
        _write_battle(tmp_path, f"battle_{i:03d}.json", battle, mtime=float(1000 + i))
    with patch(MOCK_SNAPSHOTS, return_value=tmp_path):
        r = client.get("/api/battle/overview")
    assert r.status_code == 200
    chars = r.json()["chars"]
    assert len(chars) == 1
    assert chars[0]["dpt_trend_pct"] == pytest.approx(100.0, abs=1.0)


def test_sparkline_normalized(tmp_path):
    char = {"res_id": 1060, "atk": 1200, "def": 100, "cri": 60.0, "cri_dmg": 180.0}
    for i, dpt in enumerate([50.0, 100.0, 75.0, 200.0]):
        battle = _base_battle(player_chars=[char], char_dpt={"1060": dpt})
        _write_battle(tmp_path, f"battle_{i:03d}.json", battle, mtime=float(1000 + i))
    with patch(MOCK_SNAPSHOTS, return_value=tmp_path):
        r = client.get("/api/battle/overview")
    assert r.status_code == 200
    chars = r.json()["chars"]
    assert len(chars) == 1
    sparkline = chars[0]["dpt_sparkline"]
    assert len(sparkline) > 0
    assert all(0.0 <= v <= 1.0 for v in sparkline)
    assert max(sparkline) == pytest.approx(1.0)
