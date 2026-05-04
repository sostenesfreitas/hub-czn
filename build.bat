@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  Hub CZN - Build Script
echo ============================================
echo.

:: ---- Step 0: Sync version from tauri.conf.json ----
echo [0/4] Syncing version...
python sync_version.py
if errorlevel 1 (
    echo ERROR: sync_version.py failed.
    pause & exit /b 1
)

:: ---- Step 1: Python sidecar ----
echo [1/4] Building Python sidecar...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed.
    pause & exit /b 1
)

pyinstaller api/hub_czn_api.spec --clean --noconfirm
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    pause & exit /b 1
)

:: Tauri expects the sidecar at src-tauri/binaries/<name>-<target-triple>.exe
set TARGET_TRIPLE=x86_64-pc-windows-msvc
copy /Y "dist\hub-czn-api.exe" "src-tauri\binaries\hub-czn-api-%TARGET_TRIPLE%.exe"
if errorlevel 1 (
    echo ERROR: Failed to copy sidecar binary.
    pause & exit /b 1
)

:: ---- Step 2: Frontend ----
echo.
echo [2/4] Building frontend...
npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause & exit /b 1
)

npm run build
if errorlevel 1 (
    echo ERROR: npm run build failed.
    pause & exit /b 1
)

:: ---- Step 3: Tauri bundle ----
echo.
echo [3/4] Building Tauri app...
npm run tauri build
if errorlevel 1 (
    echo ERROR: npm run tauri build failed.
    pause & exit /b 1
)

echo.
echo ============================================
echo  Build complete!
echo  Output: src-tauri\target\release\bundle\msi\
echo ============================================
pause
