@echo off
title Stop BREKTRA
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-Brektra.ps1"
if errorlevel 1 pause
