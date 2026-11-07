@echo off
setlocal
cd /d "%~dp0"
echo Uncharted Waters II - startup diagnostics
echo Extract the entire ZIP before running START.cmd.
set "UW2_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%UW2_PS%" goto missing
"%UW2_PS%" -NoLogo -NoProfile -NoExit -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"
echo.
echo PowerShell closed. Any startup error should be in startup.log.
pause
exit /b
:missing
echo Windows PowerShell was not found on this computer.
pause
exit /b 1
