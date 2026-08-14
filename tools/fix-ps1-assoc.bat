@echo off
rem ============================================================
rem  Fix .ps1 file association (SuperMDP tool)
rem  Double-click to run. When UAC prompt appears, click "Yes".
rem  Adds the missing open command for Microsoft.PowerShellScript.1
rem  so .ps1 files open with PowerShell 7 (no more "choose a program").
rem ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Fixing .ps1 file association...
reg add "HKLM\Software\Classes\Microsoft.PowerShellScript.1\shell\open\command" /ve /d "\"C:\Program Files\PowerShell\7\pwsh.exe\" -NoLogo -File \"%%1\"" /f

if %errorlevel%==0 (
    echo.
    echo [OK] Fixed! .ps1 will now open with PowerShell 7.
    echo      No more "how do you want to open this file" dialog.
) else (
    echo.
    echo [FAIL] Write failed. Retry and click "Yes" on the UAC prompt.
)
echo.
pause
