@echo off
title Kroma Leads Global Pro v1.6 v1.5
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao foi encontrado.
  echo Instale Node.js 18 ou superior em https://nodejs.org/
  echo Depois feche e abra o terminal novamente.
  echo.
  pause
  exit /b 1
)
echo.
echo Iniciando Kroma Leads Global Pro v1.6 v1.5...
node server.js
pause
