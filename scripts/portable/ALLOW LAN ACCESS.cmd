@echo off
title BREKTRA LAN access
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Allow-Lan.ps1"
if errorlevel 1 pause
