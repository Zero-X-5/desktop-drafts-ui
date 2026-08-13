$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $root "bin\NativeGlassDemo.exe"

if (-not (Test-Path -LiteralPath $exe)) {
  & (Join-Path $root "build.ps1")
}

$existing = Get-Process -Name "NativeGlassDemo" -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $exe }
if ($existing) {
  $existing | Stop-Process -Force
  Start-Sleep -Milliseconds 150
}

$process = Start-Process -FilePath $exe -WorkingDirectory $root -PassThru
$deadline = (Get-Date).AddSeconds(3)
while ($process.MainWindowHandle -eq 0 -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 100
  $process.Refresh()
}

if ($process.MainWindowHandle -eq 0) {
  throw "NativeGlassDemo started without a visible window"
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeGlassActivation {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
}
"@
[NativeGlassActivation]::ShowWindowAsync($process.MainWindowHandle, 5) | Out-Null
[NativeGlassActivation]::SwitchToThisWindow($process.MainWindowHandle, $true)
[NativeGlassActivation]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Write-Output "Started and activated: $exe"
