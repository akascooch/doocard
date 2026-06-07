@echo off
setlocal
cd /d "%~dp0backend"
echo [Doocard] Starting backend (NestJS dev on port 3001)...
call npm run start:dev
endlocal