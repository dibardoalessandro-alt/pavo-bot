@echo off
:: ============================================================================
:: PavoTweak Booster Edition — Windows CLI Launcher
:: Auto-elevates to Administrator if not already elevated
:: ============================================================================

title PavoTweak Booster Edition v2.6

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [PAVOTWEAK] Requesting Administrator Privileges...
    powershell -Command "Start-Process -Verb RunAs -FilePath '%~dpnx0'"
    exit /b
)

:: Set console codepage to UTF-8
chcp 65001 >nul

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PavoTweak.ps1"

pause
