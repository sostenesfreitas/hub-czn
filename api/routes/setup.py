# api/routes/setup.py
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

from fastapi import APIRouter, HTTPException
from capture.setup import check_prerequisites, install_mitmproxy, setup_certificate, open_certificate

router = APIRouter()


@router.get("/setup/status")
def get_setup_status():
    s = check_prerequisites()
    return {
        "admin": s.is_admin,
        "mitmproxy": s.has_mitmproxy,
        "mitmproxy_version": s.mitmproxy_version,
        "certificate": s.has_certificate,
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
