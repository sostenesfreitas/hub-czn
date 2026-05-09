"""
Setup utilities for capture system prerequisites.
Handles mitmproxy installation, certificate generation, and prerequisite checking.
"""

import subprocess
import ctypes
import time
import os
import sys
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class CertificateInstallError(Exception):
    """Raised when certificate installation fails."""
    pass


def find_mitmdump() -> Optional[str]:
    """
    Find the mitmdump executable, checking multiple locations.

    When running from a bundled exe, mitmdump may not be on PATH.
    This function checks common installation locations.

    Returns:
        Path to mitmdump executable, or None if not found
    """
    # First try shutil.which (checks PATH)
    mitmdump_path = shutil.which("mitmdump")
    if mitmdump_path:
        return mitmdump_path

    # Common locations to check on Windows
    if sys.platform == "win32":
        locations_to_check = []

        # Check Python Scripts folders
        # When running bundled exe, sys.executable is the exe path
        # But we can still check common Python installation paths

        # User's Python Scripts folder
        user_scripts = Path.home() / "AppData" / "Local" / "Programs" / "Python"
        if user_scripts.exists():
            for python_dir in user_scripts.glob("Python*"):
                scripts_dir = python_dir / "Scripts"
                locations_to_check.append(scripts_dir / "mitmdump.exe")

        # System Python Scripts folders
        for base in [r"C:\Python", r"C:\Program Files\Python", r"C:\Program Files (x86)\Python"]:
            base_path = Path(base)
            if base_path.exists():
                for python_dir in base_path.glob("Python*"):
                    locations_to_check.append(python_dir / "Scripts" / "mitmdump.exe")

        # pyenv-win locations
        pyenv_root = Path.home() / ".pyenv" / "pyenv-win" / "versions"
        if pyenv_root.exists():
            for version_dir in pyenv_root.glob("*"):
                locations_to_check.append(version_dir / "Scripts" / "mitmdump.exe")

        # Check if running from bundled exe - look next to the exe
        if getattr(sys, 'frozen', False):
            exe_dir = Path(sys.executable).parent
            locations_to_check.append(exe_dir / "mitmdump.exe")

        # Try each location
        for path in locations_to_check:
            if path.exists():
                return str(path)

    return None


def get_certificate_thumbprint(cert_path: Path) -> Optional[str]:
    """
    Compute the SHA-1 thumbprint of a certificate file (uppercase hex).
    Handles both PEM (mitmproxy's default for .cer) and DER encodings.
    Returns None if the file is missing or cannot be parsed.
    """
    try:
        data = cert_path.read_bytes()
    except (FileNotFoundError, OSError):
        return None

    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes
        try:
            cert = x509.load_pem_x509_certificate(data)
        except ValueError:
            cert = x509.load_der_x509_certificate(data)
        return cert.fingerprint(hashes.SHA1()).hex().upper()
    except Exception:
        return None


def is_certificate_trusted(cert_path: Path) -> bool:
    """
    Check whether the certificate's SHA-1 thumbprint exists in the Windows
    LocalMachine\\Root store via 'certutil -verifystore Root <thumbprint>'.
    Returns False on any failure (missing file, missing certutil, timeout,
    non-zero exit). Never raises.
    """
    thumbprint = get_certificate_thumbprint(cert_path)
    if not thumbprint:
        return False
    try:
        result = subprocess.run(
            ["certutil", "-verifystore", "Root", thumbprint],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False
    return result.returncode == 0


def install_certificate(cert_path: Path) -> None:
    """
    Install the certificate into Windows LocalMachine\\Root via
    'certutil -addstore -f Root <path>'. Idempotent. Requires admin rights.
    Raises CertificateInstallError on any failure (missing file, missing certutil,
    non-zero exit) with the diagnostic message in the exception text.
    """
    if not cert_path.exists():
        raise CertificateInstallError(f"Certificate file not found: {cert_path}")
    try:
        result = subprocess.run(
            ["certutil", "-addstore", "-f", "Root", str(cert_path)],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except FileNotFoundError:
        raise CertificateInstallError("certutil.exe not found on PATH")
    except subprocess.TimeoutExpired:
        raise CertificateInstallError("certutil timed out installing the certificate")
    if result.returncode != 0:
        msg = (result.stderr or result.stdout or "unknown error").strip()
        raise CertificateInstallError(msg)


@dataclass
class PrerequisiteStatus:
    """Status of capture system prerequisites."""
    is_admin: bool
    has_mitmproxy: bool
    mitmproxy_version: Optional[str]
    has_certificate: bool
    certificate_path: Optional[Path]
    certificate_trusted: bool


def check_prerequisites() -> PrerequisiteStatus:
    """
    Check if all prerequisites for capture system are met.

    Returns:
        PrerequisiteStatus object with current status of all requirements
    """
    # Check admin privileges (Windows only) using TokenElevation.
    is_admin = False
    try:
        import ctypes.wintypes as wintypes
        OpenProcessToken = ctypes.windll.advapi32.OpenProcessToken
        OpenProcessToken.restype = wintypes.BOOL
        OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
        GetTokenInformation = ctypes.windll.advapi32.GetTokenInformation
        GetTokenInformation.restype = wintypes.BOOL
        GetTokenInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]

        hToken = wintypes.HANDLE()
        if OpenProcessToken(ctypes.windll.kernel32.GetCurrentProcess(), 0x0008, ctypes.byref(hToken)):
            try:
                elevated = wintypes.DWORD(0)
                size = wintypes.DWORD(0)
                if GetTokenInformation(hToken, 20, ctypes.byref(elevated), ctypes.sizeof(elevated), ctypes.byref(size)):
                    is_admin = bool(elevated.value)
            finally:
                ctypes.windll.kernel32.CloseHandle(hToken)
    except Exception:
        pass

    # Check mitmproxy installation
    has_mitmproxy = False
    mitmproxy_version = None
    mitmdump_path = find_mitmdump()
    if mitmdump_path:
        try:
            result = subprocess.run(
                [mitmdump_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                has_mitmproxy = True
                # Extract version from output (e.g., "Mitmproxy 10.1.1")
                mitmproxy_version = result.stdout.split()[1] if result.stdout else "unknown"
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

    # Check certificate
    cert_path = Path.home() / ".mitmproxy" / "mitmproxy-ca-cert.cer"
    has_certificate = cert_path.exists()
    certificate_trusted = is_certificate_trusted(cert_path) if has_certificate else False

    return PrerequisiteStatus(
        is_admin=is_admin,
        has_mitmproxy=has_mitmproxy,
        mitmproxy_version=mitmproxy_version,
        has_certificate=has_certificate,
        certificate_path=cert_path if has_certificate else None,
        certificate_trusted=certificate_trusted,
    )


def _find_python() -> Optional[str]:
    """Find a Python interpreter suitable for running pip.

    When the sidecar runs elevated via UAC, the user's PATH may not include
    Python Scripts directories. We search known install locations explicitly.
    """
    # If not frozen, use the current interpreter directly.
    if not getattr(sys, 'frozen', False):
        return sys.executable

    if sys.platform != "win32":
        return shutil.which("python3") or shutil.which("python")

    # On elevated processes, shutil.which may miss user-PATH entries,
    # but let's try — filter out Windows App Execution Aliases (stubs that
    # don't work elevated).
    for name in ("python", "python3"):
        path = shutil.which(name)
        if path and "WindowsApps" not in path:
            return path

    # Search user Python installations (most common for non-admin installs).
    user_root = Path.home() / "AppData" / "Local" / "Programs" / "Python"
    if user_root.exists():
        for python_dir in sorted(user_root.glob("Python3*"), reverse=True):
            exe = python_dir / "python.exe"
            if exe.exists():
                return str(exe)

    # Search system-wide Python installations.
    for base in (Path("C:\\"), Path("C:\\Program Files"), Path("C:\\Program Files (x86)")):
        for python_dir in sorted(base.glob("Python3*"), reverse=True):
            exe = python_dir / "python.exe"
            if exe.exists():
                return str(exe)

    return None


def install_mitmproxy(timeout: int = 120) -> bool:
    """Install mitmproxy, using the system Python interpreter even when elevated."""
    python = _find_python()
    if python:
        cmd = [python, "-m", "pip", "install", "mitmproxy"]
    else:
        # Last resort: rely on pip being on PATH.
        cmd = ["pip", "install", "mitmproxy"]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

    if result.returncode != 0:
        raise Exception(f"Installation failed: {result.stderr or result.stdout}")

    return True


def setup_certificate() -> Path:
    """
    Generate mitmproxy CA certificate by starting and stopping mitmdump.

    Returns:
        Path to the generated certificate

    Raises:
        FileNotFoundError: If mitmdump is not installed
        Exception: If certificate generation fails
    """
    mitmdump_path = find_mitmdump()
    if not mitmdump_path:
        raise FileNotFoundError("mitmdump not found. Please install mitmproxy.")

    # Start mitmdump briefly to generate certificate
    process = subprocess.Popen(
        [mitmdump_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Give it time to generate the certificate
    time.sleep(3)

    # Stop the process
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()

    # Verify certificate was created
    cert_path = Path.home() / ".mitmproxy" / "mitmproxy-ca-cert.cer"
    if not cert_path.exists():
        raise Exception("Certificate was not generated")

    return cert_path


def open_certificate(cert_path: Path) -> None:
    """
    Open certificate file in Windows (for manual installation).

    Args:
        cert_path: Path to certificate file

    Raises:
        Exception: If unable to open certificate
    """
    if not cert_path.exists():
        raise FileNotFoundError(f"Certificate not found: {cert_path}")

    try:
        os.startfile(str(cert_path))
    except Exception as e:
        raise Exception(f"Failed to open certificate: {e}")