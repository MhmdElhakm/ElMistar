@echo off
cd /d "%~dp0"

echo ==============================
echo Preparing to push project to GitHub
echo ==============================

git status
if errorlevel 1 goto :error

git add .
if errorlevel 1 goto :error

git commit -m "Update project"
if errorlevel 1 goto :error

git push origin main
if errorlevel 1 (
  echo Trying master branch...
  git push origin master
)
if errorlevel 1 goto :error

echo.
echo Project uploaded successfully.
goto :end

:error
echo.
echo Git command failed. Please check Git installation and remote configuration.
exit /b 1

:end
