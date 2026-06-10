@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "RBX_FILEVIEW_EXE=%SCRIPT_DIR%..\rbx-fileview.exe"
if not exist "%RBX_FILEVIEW_EXE%" (
	set "RBX_FILEVIEW_EXE=%SCRIPT_DIR%..\rbx-fileview"
)
"%RBX_FILEVIEW_EXE%" dump "%~1"
