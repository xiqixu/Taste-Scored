@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Use Node.js, VS Code Live Server or GitHub Pages to open this website.
  pause
  exit /b 1
)
node preview.mjs --pre
if errorlevel 1 pause
