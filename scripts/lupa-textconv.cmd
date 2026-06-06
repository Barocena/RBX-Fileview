@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "LUPA_EXE=%SCRIPT_DIR%..\lupa.exe"
if not exist "%LUPA_EXE%" (
	set "LUPA_EXE=%SCRIPT_DIR%..\lupa"
)
"%LUPA_EXE%" dump "%~1"
