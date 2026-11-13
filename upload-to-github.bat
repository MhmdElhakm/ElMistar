@echo off
setlocal
cd /d "%~dp0"
call "%~dp0push-to-github.bat"
exit /b %ERRORLEVEL%
