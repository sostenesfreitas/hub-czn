@echo off
echo ============================================
echo  Vribbels CZN Optimizer - Build Script
echo ============================================
echo.

echo [1/2] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Building executable...
pyinstaller Vribbels_CZN_Optimizer.spec --clean --noconfirm
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Build complete!
echo  Output: dist\Vribbels_CZN_Optimizer\
echo ============================================
pause
