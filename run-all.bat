@echo off
setlocal
set "ROOT=%~dp0"

start "Doocard Backend" cmd /k "cd /d "%ROOT%" && run-backend.bat"
timeout /t 5 /nobreak >nul
start "Doocard Frontend" cmd /k "cd /d "%ROOT%" && run-frontend.bat"

endlocal
