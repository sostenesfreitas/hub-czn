# tests/api/test_rescue.py
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

FAKE_RESCUE = [
    {
        "gacha_id": "pickup_combatant_season1",
        "reward": json.dumps([1003, 1004, 1005]),
        "prism": json.dumps([False, True, False]),
        "createAt": "1714300000",
    }
]


def test_rescue_records_no_file():
    with patch("api.routes.rescue._latest_rescue_file", return_value=None):
        r = client.get("/api/rescue/records")
    assert r.status_code == 200
    assert r.json() == []


def test_rescue_records_with_file():
    import os
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(FAKE_RESCUE, f)
        path = Path(f.name)

    try:
        with patch("api.routes.rescue._latest_rescue_file", return_value=path):
            r = client.get("/api/rescue/records")

        assert r.status_code == 200
        body = r.json()
        assert len(body) >= 1
        banner = body[0]
        assert "banner_name" in banner
        assert "pulls" in banner
        assert "stats" in banner
        assert banner["stats"]["total"] == 3
    finally:
        os.unlink(path)
