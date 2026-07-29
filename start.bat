@echo off
:: ═══════════════════════════════════════════════════════
:: LoreOS — start.bat (Windows)
:: Double-click this file to launch LoreOS locally.
:: Automatically downloads or updates to the latest
:: release from GitHub, then starts a local server.
:: ═══════════════════════════════════════════════════════

setlocal enabledelayedexpansion
set REPO=bumyann/LoreOS-Universal-Editor
set ASSET_URL=https://github.com/%REPO%/releases/latest/download/LoreOS.zip
set RELEASE_API=https://api.github.com/repos/%REPO%/releases/latest
set PORT=8080
set DIR=%~dp0
set VERSION_FILE=%DIR%version.txt

echo.
echo   LoreOS // Universal Editor
echo   ----------------------------

:: ── Check Python ──
python --version >nul 2>&1
if errorlevel 1 (
  echo   X Python not found.
  echo     Install Python from https://python.org and try again.
  pause
  exit /b 1
)

:: ── Check curl (available on Windows 10+ by default) ──
curl --version >nul 2>&1
if errorlevel 1 (
  echo   X curl not found. Please update Windows or install curl manually.
  pause
  exit /b 1
)

:: ── Read local version ──
set LOCAL_VERSION=
if exist "%VERSION_FILE%" set /p LOCAL_VERSION=<"%VERSION_FILE%"

:: ── Fetch latest version tag ──
echo   Checking for updates...
set LATEST=
for /f "tokens=2 delims=:, " %%a in ('curl -sf "%RELEASE_API%" ^| findstr "tag_name"') do (
  if not defined LATEST set LATEST=%%~a
)

if "%LATEST%"=="" (
  echo   ! Could not reach GitHub ^(offline?^). Starting with local files.
) else if "%LATEST%"=="%LOCAL_VERSION%" (
  echo   OK Already up to date ^(%LOCAL_VERSION%^)
) else (
  echo   Updating %LOCAL_VERSION% to %LATEST%...
  curl -sL "%ASSET_URL%" -o "%TEMP%\LoreOS.zip"
  if errorlevel 1 (
    echo   X Download failed. Starting with local files.
  ) else (
    powershell -Command "Expand-Archive -Force '%TEMP%\LoreOS.zip' '%DIR%..'" 
    echo %LATEST%>"%VERSION_FILE%"
    echo   OK Updated to %LATEST%
    del "%TEMP%\LoreOS.zip"
  )
)

:: ── Start server ──
echo.
echo   Starting server at http://localhost:%PORT%
echo   Close this window to stop.
echo.

start "" "http://localhost:%PORT%"
cd /d "%DIR%"
python -m http.server %PORT%
