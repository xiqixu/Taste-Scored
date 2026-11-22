@echo off
cd /d "%~dp0"
node preview.mjs
if errorlevel 1 pause
