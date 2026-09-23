@echo off
title Pavo Tweak - Suite Launcher
echo ======================================================
echo STARTING PAVO LICENSE BACKEND & DISCORD BOT
echo ======================================================

echo [1/2] Starting License Backend API on port 5000...
start "Pavo License API" cmd /k "cd /d %~dp0backend && npm start"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Pavo Discord Bot on port 10000...
start "Pavo Discord Bot" cmd /k "cd /d %~dp0pavo-bot && npm start"

echo ======================================================
echo ALL SERVICES STARTED SUCCESSFULLY!
echo License API: http://localhost:5000
echo Discord Bot: Online
echo ======================================================
pause
