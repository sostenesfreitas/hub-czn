# api/routes/setup.py
from __future__ import annotations

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

from fastapi import APIRouter, HTTPException
from api.capture.setup import (
    check_prerequisites,
    install_mitmproxy,
    setup_certificate,
    open_certificate,
    install_certificate,
    CertificateInstallError,
)

router = APIRouter()


@router.get("/setup/status")
def get_setup_status():
    s = check_prerequisites()
    return {
        "admin": s.is_admin,
        "mitmproxy": s.has_mitmproxy,
        "mitmproxy_version": s.mitmproxy_version,
        "certificate": s.has_certificate,
        "certificate_trusted": s.certificate_trusted,
        "can_write_hosts": s.can_write_hosts,
        "hosts_block_reason": s.hosts_block_reason,
    }


@router.post("/setup/install-mitmproxy")
def post_install_mitmproxy():
    try:
        install_mitmproxy()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@router.post("/setup/generate-cert")
def post_generate_cert():
    try:
        setup_certificate()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@router.post("/setup/open-cert")
def post_open_cert():
    s = check_prerequisites()
    if not s.has_certificate or s.certificate_path is None:
        raise HTTPException(status_code=404, detail="Certificate not found. Generate it first.")
    try:
        open_certificate(s.certificate_path)
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/setup/install-certificate")
def post_install_certificate():
    s = check_prerequisites()
    if not s.is_admin:
        raise HTTPException(status_code=403, detail="Administrator privileges required.")
    if not s.has_certificate or s.certificate_path is None:
        raise HTTPException(status_code=404, detail="Certificate not found. Generate it first.")
    try:
        install_certificate(s.certificate_path)
        return {"ok": True}
    except CertificateInstallError as exc:
        return {"ok": False, "error": str(exc)}
