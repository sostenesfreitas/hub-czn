# tests/api/test_capture.py
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def _mock_manager(running=False):
    m = MagicMock()
    m.start_capture = MagicMock()
    m.stop_capture = MagicMock(return_value=("/path/capture.json", "global"))
    return m


def test_capture_status_not_running():
    r = client.get("/api/capture/status")
    assert r.status_code == 200
    body = r.json()
    assert body["running"] is False
    assert "region" in body
    assert "admin" in body


def test_capture_start_no_admin():
    with patch("api.routes.capture.ctypes") as mock_ctypes:
        mock_ctypes.windll.shell32.IsUserAnAdmin.return_value = 0
        r = client.post("/api/capture/start", json={"region": "global", "debug": False})
    assert r.status_code == 403


def test_capture_start_already_running():
    from api.state import state
    state.capture_running = True
    r = client.post("/api/capture/start", json={"region": "global", "debug": False})
    assert r.status_code == 409
    state.capture_running = False


def test_capture_stop_not_running():
    r = client.post("/api/capture/stop")
    assert r.status_code == 409


def test_set_region_valid():
    r = client.post("/api/capture/set-region", json={"region": "asia"})
    assert r.status_code == 200
    assert r.json()["region"] == "asia"
    # reset
    client.post("/api/capture/set-region", json={"region": "global"})


def test_set_region_invalid():
    r = client.post("/api/capture/set-region", json={"region": "europe"})
    assert r.status_code == 422
