from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_autoscroll_start_capture_not_running():
    r = client.post("/api/autoscroll/start")
    assert r.status_code == 422


def test_autoscroll_start_already_running():
    from api.state import state
    state.capture_running = True
    state.autoscroll_running = True
    try:
        r = client.post("/api/autoscroll/start")
        assert r.status_code == 409
    finally:
        state.capture_running = False
        state.autoscroll_running = False


def test_autoscroll_start_success():
    from api.state import state
    state.capture_running = True
    try:
        with patch("api.routes.autoscroll.threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            r = client.post("/api/autoscroll/start")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert state.autoscroll_running is True
    finally:
        state.capture_running = False
        state.autoscroll_running = False


def test_autoscroll_stop():
    from api.state import state
    state.autoscroll_running = True
    try:
        r = client.post("/api/autoscroll/stop")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert state.autoscroll_running is False
    finally:
        state.autoscroll_running = False
