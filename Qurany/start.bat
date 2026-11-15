@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the local web server.
  echo Install Node.js, or open this folder in VS Code and use the Live Server extension.
  pause
  exit /b 1
)
node "%~dp0serve.js"
pause
