@echo off
if exist "%~dp0release\BREKTRA-Windows-x64\STOP BREKTRA.cmd" (
  call "%~dp0release\BREKTRA-Windows-x64\STOP BREKTRA.cmd"
) else (
  echo There is no portable BREKTRA instance to stop.
)
