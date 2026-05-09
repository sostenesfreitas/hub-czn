# tests/api/test_setup.py
import subprocess
from unittest.mock import patch, MagicMock
from pathlib import Path
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


def _write_pem_cert(tmp_path: Path) -> tuple[Path, str]:
    """Generate a self-signed cert in PEM format. Returns (path, expected_sha1_thumbprint_hex_uppercase)."""
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from datetime import datetime, timedelta, timezone

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test-ca")])
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    pem_path = tmp_path / "test-cert.cer"
    pem_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    expected = cert.fingerprint(hashes.SHA1()).hex().upper()
    return pem_path, expected


def test_thumbprint_matches_known_pem_cert(tmp_path):
    from api.capture.setup import get_certificate_thumbprint
    cert_path, expected = _write_pem_cert(tmp_path)
    assert get_certificate_thumbprint(cert_path) == expected


def test_thumbprint_returns_none_for_missing_file(tmp_path):
    from api.capture.setup import get_certificate_thumbprint
    assert get_certificate_thumbprint(tmp_path / "nope.cer") is None


def test_thumbprint_returns_none_for_garbage_file(tmp_path):
    from api.capture.setup import get_certificate_thumbprint
    p = tmp_path / "garbage.cer"
    p.write_bytes(b"not a certificate at all")
    assert get_certificate_thumbprint(p) is None


def test_is_trusted_false_when_thumbprint_unknown(tmp_path, monkeypatch):
    from api.capture.setup import is_certificate_trusted
    # Garbage file → thumbprint is None → must short-circuit to False without subprocess
    p = tmp_path / "garbage.cer"
    p.write_bytes(b"x")
    called = {"n": 0}
    def fake_run(*a, **kw):
        called["n"] += 1
        return subprocess.CompletedProcess(args=[], returncode=0)
    monkeypatch.setattr(subprocess, "run", fake_run)
    assert is_certificate_trusted(p) is False
    assert called["n"] == 0


def test_is_trusted_true_on_zero_exit(tmp_path, monkeypatch):
    from api.capture.setup import is_certificate_trusted
    cert_path, _ = _write_pem_cert(tmp_path)
    monkeypatch.setattr(
        subprocess, "run",
        lambda *a, **kw: subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
    )
    assert is_certificate_trusted(cert_path) is True


def test_is_trusted_false_on_nonzero_exit(tmp_path, monkeypatch):
    from api.capture.setup import is_certificate_trusted
    cert_path, _ = _write_pem_cert(tmp_path)
    monkeypatch.setattr(
        subprocess, "run",
        lambda *a, **kw: subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="not found")
    )
    assert is_certificate_trusted(cert_path) is False


def test_is_trusted_false_when_certutil_missing(tmp_path, monkeypatch):
    from api.capture.setup import is_certificate_trusted
    cert_path, _ = _write_pem_cert(tmp_path)
    def boom(*a, **kw):
        raise FileNotFoundError("certutil")
    monkeypatch.setattr(subprocess, "run", boom)
    assert is_certificate_trusted(cert_path) is False


def test_is_trusted_false_on_timeout(tmp_path, monkeypatch):
    from api.capture.setup import is_certificate_trusted
    cert_path, _ = _write_pem_cert(tmp_path)
    def boom(*a, **kw):
        raise subprocess.TimeoutExpired(cmd="certutil", timeout=5)
    monkeypatch.setattr(subprocess, "run", boom)
    assert is_certificate_trusted(cert_path) is False
