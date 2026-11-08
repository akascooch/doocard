@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "OFFLINE_ROOT=%~dp0.."
for %%I in ("%OFFLINE_ROOT%") do set "OFFLINE_ROOT=%%~fI"
set "LOG_DIR=%OFFLINE_ROOT%\logs"
set "RUNTIME=%OFFLINE_ROOT%\runtime"
set "REDIS_CLI=%OFFLINE_ROOT%\tools\redis\redis-cli.exe"

echo [INFO] Stopping only Doocard Offline windows/processes...
>> "%LOG_DIR%\launcher.log" echo [%DATE% %TIME%] STOP requested

rem Kill by window title started by launcher
taskkill /FI "WINDOWTITLE eq Doocard-Offline-Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Doocard-Offline-Frontend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Doocard-Offline-Redis*" /T /F >nul 2>&1

rem Also stop node processes whose command line is under Offline path (safe scoped)
powershell -NoProfile -Command ^
  "$root='%OFFLINE_ROOT%'.ToLower(); Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { $cl=($_.CommandLine); if($cl -and $cl.ToLower().Contains($root)){ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output ('stopped node PID '+$_.ProcessId) } }"

rem Stop redis-server only if its command line references Offline redis conf/dir
powershell -NoProfile -Command ^
  "$root='%OFFLINE_ROOT%'.ToLower(); Get-CimInstance Win32_Process -Filter \"Name='redis-server.exe'\" | ForEach-Object { $cl=($_.CommandLine); if($cl -and $cl.ToLower().Contains($root)){ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output ('stopped redis PID '+$_.ProcessId) } }"

if exist "%RUNTIME%\offline.lock" del /f /q "%RUNTIME%\offline.lock" >nul 2>&1
if exist "%RUNTIME%\backend.pid" del /f /q "%RUNTIME%\backend.pid" >nul 2>&1
if exist "%RUNTIME%\frontend.pid" del /f /q "%RUNTIME%\frontend.pid" >nul 2>&1

echo [OK] Offline processes stop attempted. PostgreSQL service left running.
echo Tip: Redis started by this launcher is stopped; system Redis (if any) untouched.
exit /b 0
