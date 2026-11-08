@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-offline.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Start failed. See ..\logs\launcher.log and backend/frontend logs.
  pause
  exit /b 1
)
exit /b 0
