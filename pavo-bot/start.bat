@echo off
title Pavo Bot - Complete Suite
cd /d "%~dp0"
echo ========================================================
echo               AVVIO DI PAVO BOT
echo ========================================================
echo.
echo Installazione/Controllo dipendenze...
if not exist node_modules (
    npm install
)

echo.
echo Registrazione comandi slash in corso...
node deploy-commands.js

echo.
echo Avvio Pavo Bot...
node index.js
pause
