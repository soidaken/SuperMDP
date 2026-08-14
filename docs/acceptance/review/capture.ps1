# Best-effort screenshot of the SuperMDP window (reviewer acceptance evidence)
# Usage: pwsh -File capture.ps1 <outdir>
param([string]$OutDir = 'E:\superMDP\docs\acceptance\screenshots')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$exe = 'E:\superMDP\app\build\bin\app.exe'
$p = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 10   # executor: 冒烟启动 ~8s

$h = $p.MainWindowHandle
if ($h -eq [IntPtr]::Zero) {
  Write-Host "SCREENSHOT_FAIL: no main window handle (headless session?) pid=$($p.Id)"
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

[Win32]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
[Win32]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 800

$rect = New-Object Win32+RECT
[Win32]::GetWindowRect($h, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$ht = $rect.Bottom - $rect.Top
Write-Host "WINDOW rect=($($rect.Left),$($rect.Top)) ${w}x${ht}"

if ($w -le 0 -or $ht -le 0) {
  Write-Host "SCREENSHOT_FAIL: invalid window rect"
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

$bmp = New-Object System.Drawing.Bitmap($w, $ht)
$g = [System.Drawing.Graphics]::FromImage($bmp)
try {
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
  $path = Join-Path $OutDir 'app-empty-light.png'
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "SCREENSHOT_OK $path"

  # Try Ctrl+T to flip theme, capture dark
  $wshell = New-Object -ComObject WScript.Shell
  $wshell.AppActivate($p.Id) | Out-Null
  Start-Sleep -Milliseconds 300
  $wshell.SendKeys('^t')
  Start-Sleep -Milliseconds 1200
  [Win32]::GetWindowRect($h, [ref]$rect) | Out-Null
  $bmp2 = New-Object System.Drawing.Bitmap($w, $ht)
  $g2 = [System.Drawing.Graphics]::FromImage($bmp2)
  try {
    $g2.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp2.Size)
    $path2 = Join-Path $OutDir 'app-empty-dark.png'
    $bmp2.Save($path2, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "SCREENSHOT_OK $path2"
  } finally { $g2.Dispose(); $bmp2.Dispose() }
} finally {
  $g.Dispose(); $bmp.Dispose()
  $p.CloseMainWindow() | Out-Null
  Start-Sleep -Seconds 2
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
  Write-Host "SCREENSHOT_CLEANUP exited=$($p.HasExited)"
}
