@echo off
title Pavo Bot - Server Setup
cd /d "%~dp0"
echo ========================================================
echo        PAVO BOT - SETUP COMPLETO DEL SERVER DISCORD
echo ========================================================
echo.
echo Avvio creazione di tutte le Categorie, Canali, Ruoli, Regole e Ticket...
node setup-server.js %1
echo.
echo Operazione completata!
pause
