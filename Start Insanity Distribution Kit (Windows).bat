@echo off
rem Double-click launcher for Insanity Distribution Kit (Windows)
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js isn't installed yet.
  echo   1. Go to  https://nodejs.org  and download the LTS version
  echo   2. Run the installer ^(keep clicking Next^)
  echo   3. Double-click this file again
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run - downloading components ^(one time, ~2 min^)...
  call npm install
  if errorlevel 1 (
    echo Install failed - check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo Starting Insanity Distribution Kit...
call npm start
