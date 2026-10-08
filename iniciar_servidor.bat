@echo off
title Calendario Nodex - Servidor Local
echo Iniciando servidor local...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
pause
