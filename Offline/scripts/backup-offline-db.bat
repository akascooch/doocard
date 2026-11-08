@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
set "OFFLINE_ROOT=%~dp0.."
for %%I in ("%OFFLINE_ROOT%") do set "OFFLINE_ROOT=%%~fI"
set "PG_DUMP=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
set "OUT_DIR=%OFFLINE_ROOT%\data\backups"
set "PASS_FILE=%OFFLINE_ROOT%\runtime\db_role_password.txt"
set "META=%OUT_DIR%\LAST_LOCAL_BACKUP.txt"

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
for /f "usebackq delims=" %%P in ("%PASS_FILE%") do set "PGPASSWORD=%%P"
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%T"
set "OUT=%OUT_DIR%\doocard_offline_local_%TS%.dump"

echo [INFO] Backing up offline DB doocard_offline_20261105 ...
"%PG_DUMP%" -U doocard_offline -h 127.0.0.1 -p 5432 -Fc -b -d doocard_offline_20261105 -f "%OUT%"
if errorlevel 1 (
  echo [ERROR] pg_dump failed
  exit /b 1
)
for /f %%H in ('powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 '%OUT%').Hash.ToLower()"') do set "HASH=%%H"
> "%META%" echo last_local_backup_utc=%DATE% %TIME%
>> "%META%" echo file=%OUT%
>> "%META%" echo sha256=%HASH%
>> "%META%" echo note=Local offline work export. Do NOT auto-push to production.
echo [OK] Backup written: %OUT%
echo SHA256=%HASH%
exit /b 0
