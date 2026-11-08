@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
set "OFFLINE_ROOT=%~dp0.."
for %%I in ("%OFFLINE_ROOT%") do set "OFFLINE_ROOT=%%~fI"
set "PS1=%OFFLINE_ROOT%\scripts\refresh-offline-snapshot.ps1"

echo ========================================================
echo  Doocard Offline — Refresh production snapshot
echo  Requires: internet + ssh doocard-prod reachable
echo  SAFETY: backs up current offline DB before switch
echo  NEVER auto-writes offline edits back to production
echo ========================================================
echo.
echo Run stop-offline.bat first if the app is running.
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
exit /b %ERRORLEVEL%
