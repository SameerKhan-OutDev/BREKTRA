@echo off
if exist "%~dp0release\BREKTRA-Windows-x64\START BREKTRA.cmd" (
  call "%~dp0release\BREKTRA-Windows-x64\START BREKTRA.cmd"
) else (
  echo The portable app has not been built yet. See README.md.
  pause
)
