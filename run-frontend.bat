@echo off
setlocal
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
cd /d "%FRONTEND%"

echo [Doocard] Starting frontend (Next.js dev on port 3000)...
call npm run dev
endlocal
