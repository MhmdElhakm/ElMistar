@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 exit /b 1

where git >nul 2>nul
if not errorlevel 1 goto :git_on_path
set "GIT_EXE=%ProgramFiles%\Git\cmd\git.exe"
if exist "%GIT_EXE%" goto :git_ready
set "GIT_EXE=%LocalAppData%\Programs\Git\cmd\git.exe"
if exist "%GIT_EXE%" goto :git_ready
set "GIT_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
if exist "%GIT_EXE%" goto :git_ready
goto :git_missing

:git_on_path
set "GIT_EXE=git"

:git_ready
"%GIT_EXE%" rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto :not_repository

"%GIT_EXE%" remote get-url origin >nul 2>nul
if errorlevel 1 goto :missing_origin

"%GIT_EXE%" config user.name >nul 2>nul
if errorlevel 1 goto :missing_identity
"%GIT_EXE%" config user.email >nul 2>nul
if errorlevel 1 goto :missing_identity

echo Current project changes:
"%GIT_EXE%" status --short --branch
if errorlevel 1 goto :error

set "HAS_CHANGES="
for /f "delims=" %%A in ('"%GIT_EXE%" status --porcelain') do set "HAS_CHANGES=1"
if not defined HAS_CHANGES goto :nothing_to_push

choice /C YN /M "Stage all project changes (including deletions)"
if errorlevel 2 goto :cancelled

"%GIT_EXE%" add -A
if errorlevel 1 goto :error

echo.
echo Files staged for commit:
"%GIT_EXE%" diff --cached --name-status
if errorlevel 1 goto :error

"%GIT_EXE%" diff --cached --check
if errorlevel 1 goto :error

choice /C YN /M "Commit and push these files to the current branch"
if errorlevel 2 goto :cancelled

"%GIT_EXE%" commit -m "Update project"
if errorlevel 1 goto :error

"%GIT_EXE%" push
if errorlevel 1 goto :error

echo.
echo Project uploaded successfully.
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

:not_repository
echo This folder is not a Git repository. Clone the GitHub project into this folder first.
exit /b 1

:missing_origin
echo No origin remote is configured for this repository.
exit /b 1

:missing_identity
echo Configure your Git commit identity before uploading:
echo   git config --global user.name "Your Name"
echo   git config --global user.email "you@example.com"
exit /b 1

:error
echo.
echo Git command failed. Check the error above, then try again.
exit /b 1
