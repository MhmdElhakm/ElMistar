@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 exit /b 1

where git >nul 2>nul
if not errorlevel 1 goto :git_on_path
set "GIT_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
if exist "%GIT_EXE%" goto :git_ready
goto :git_missing

:git_on_path
set "GIT_EXE=git"

:git_ready

echo Current project changes:
"%GIT_EXE%" status --short --branch
if errorlevel 1 goto :error

set "HAS_CHANGES="
for /f "delims=" %%A in ('"%GIT_EXE%" status --porcelain') do set "HAS_CHANGES=1"
if not defined HAS_CHANGES goto :nothing_to_push

choice /C YN /M "Stage all listed project changes"
if errorlevel 2 goto :cancelled

"%GIT_EXE%" add -A
if errorlevel 1 goto :error

echo.
echo Files staged for commit:
"%GIT_EXE%" diff --cached --name-status
if errorlevel 1 goto :error

"%GIT_EXE%" diff --cached --check
if errorlevel 1 goto :error

choice /C YN /M "Commit and push these files to origin/main"
if errorlevel 2 goto :cancelled

"%GIT_EXE%" commit -m "Update project"
if errorlevel 1 goto :error

"%GIT_EXE%" push origin main
if errorlevel 1 goto :error

echo.
echo Project uploaded successfully to origin/main.
exit /b 0

:nothing_to_push
echo.
echo No changes to upload.
exit /b 0

:cancelled
echo.
echo Upload cancelled.
exit /b 0

:git_missing
echo Git was not found. Install Git or add it to PATH, then run this file again.
exit /b 1

:error
echo.
echo Git command failed. Please check Git installation and remote configuration.
exit /b 1
