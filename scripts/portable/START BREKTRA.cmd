@echo off
title BREKTRA
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-Brektra.ps1"
if errorlevel 1 pause
