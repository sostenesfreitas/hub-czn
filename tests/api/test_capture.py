# tests/api/test_capture.py
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_capture_status_not_running():
    r = client.get("/api/capture/status")
    assert r.status_code == 200
    body = r.json()
    assert body["running"] is False
    assert "region" in body
    assert "admin" in body


def test_capture_start_no_admin():
    with patch("api.routes.capture._is_admin", return_value=False):
        r = client.post("/api/capture/start", json={"region": "global", "debug": False})
    assert r.status_code == 403


def test_capture_start_already_running():
    from api.state import state
    state.capture_running = True
    try:
        with patch("api.routes.capture._is_admin", return_value=True):
            r = client.post("/api/capture/start", json={"region": "global", "debug": False})
        assert r.status_code == 409
    finally:
        state.capture_running = False


def test_capture_stop_not_running():
    r = client.post("/api/capture/stop")
    assert r.status_code == 409


def test_set_region_valid():
    try:
        r = client.post("/api/capture/set-region", json={"region": "asia"})
        assert r.status_code == 200
        assert r.json()["region"] == "asia"
    finally:
        client.post("/api/capture/set-region", json={"region": "global"})


def test_set_region_invalid():
    r = client.post("/api/capture/set-region", json={"region": "europe"})
    assert r.status_code == 422


def test_capture_start_success():
    mock_mgr = MagicMock()
    mock_mgr.start_capture = MagicMock()
    with patch("api.routes.capture._is_admin", return_value=True), \
         patch("api.state.AppState.get_capture_manager", return_value=mock_mgr), \
         patch("threading.Thread") as mock_thread:
        mock_thread.return_value.start = MagicMock()
        r = client.post("/api/capture/start", json={"region": "global", "debug": False})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # cleanup
    from api.state import state
    state.capture_running = False
    state.reset_capture_manager()


def test_capture_start_propagates_region_to_manager():
    """Regression: /capture/start must call mgr.set_region(body.region) so the
    manager resolves hosts for the chosen server. Without this, picking Asia
    silently captured Global servers (no traffic intercepted)."""
    mock_mgr = MagicMock()
    with patch("api.routes.capture._is_admin", return_value=True), \
         patch("api.state.AppState.get_capture_manager", return_value=mock_mgr), \
         patch("threading.Thread") as mock_thread:
        mock_thread.return_value.start = MagicMock()
        r = client.post("/api/capture/start", json={"region": "asia", "debug": False})
    assert r.status_code == 200
    mock_mgr.set_region.assert_called_once_with("asia")
    # cleanup
    from api.state import state
    state.capture_running = False
    state.reset_capture_manager()


def test_capture_stop_success():
    from api.state import state
    state.capture_running = True
    mock_mgr = MagicMock()
    mock_mgr.stop_capture = MagicMock(return_value=("/path/capture.json", "global"))
    with patch("api.state.AppState.get_capture_manager", return_value=mock_mgr):
        r = client.post("/api/capture/stop")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["file_path"] == "/path/capture.json"
    assert state.capture_running is False
