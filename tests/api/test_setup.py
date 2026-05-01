# tests/api/test_setup.py
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_setup_status_returns_expected_shape():
    mock_status = MagicMock(
        is_admin=False,
        has_mitmproxy=True,
        mitmproxy_version="10.1.1",
        has_certificate=False,
        certificate_path=None,
    )
    with patch("api.routes.setup.check_prerequisites", return_value=mock_status):
        r = client.get("/api/setup/status")
    assert r.status_code == 200
    body = r.json()
    assert body["admin"] is False
    assert body["mitmproxy"] is True
    assert body["mitmproxy_version"] == "10.1.1"
    assert body["certificate"] is False


def test_install_mitmproxy_success():
    with patch("api.routes.setup.install_mitmproxy", return_value=True):
        r = client.post("/api/setup/install-mitmproxy")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_install_mitmproxy_failure():
    with patch("api.routes.setup.install_mitmproxy", side_effect=Exception("pip failed")):
        r = client.post("/api/setup/install-mitmproxy")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert "pip failed" in body["error"]


def test_generate_cert_success():
    from pathlib import Path
    with patch("api.routes.setup.setup_certificate", return_value=Path("/fake/cert.cer")):
        r = client.post("/api/setup/generate-cert")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_open_cert_no_certificate():
    mock_status = MagicMock(has_certificate=False, certificate_path=None)
    with patch("api.routes.setup.check_prerequisites", return_value=mock_status):
        r = client.post("/api/setup/open-cert")
    assert r.status_code == 404


def test_generate_cert_failure():
    with patch("api.routes.setup.setup_certificate", side_effect=Exception("mitmdump not found")):
        r = client.post("/api/setup/generate-cert")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert "mitmdump not found" in body["error"]
