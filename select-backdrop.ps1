param([ValidateSet("mica", "acrylic", "transparent", "solid")][string]$Backdrop = "acrylic")

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMessage {
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
}
"@
$null = [NativeMessage]::SetProcessDpiAwarenessContext([IntPtr](-4))
$process = Get-Process -Name NativeGlassDemo | Select-Object -First 1
if (-not $process) { throw "NativeGlassDemo is not running" }
$window = $process.MainWindowHandle
if ($window -eq [IntPtr]::Zero) { throw "NativeGlassDemo window handle is unavailable" }
[NativeMessage]::SetForegroundWindow($window) | Out-Null
$scale = [NativeMessage]::GetDpiForWindow($window) / 96.0

$logicalPoint = switch ($Backdrop) {
  "mica" { @(90, 333) }
  "acrylic" { @(212, 333) }
  "transparent" { @(334, 333) }
  "solid" { @(334, 333) } # Backward-compatible alias.
}
$x = [int]($logicalPoint[0] * $scale)
$y = [int]($logicalPoint[1] * $scale)
$lParam = [IntPtr](($x -band 0xffff) -bor (($y -band 0xffff) -shl 16))
[NativeMessage]::SendMessage($window, 0x0201, [IntPtr]::Zero, $lParam) | Out-Null
[NativeMessage]::SendMessage($window, 0x0202, [IntPtr]::Zero, $lParam) | Out-Null
if ($Backdrop -eq "solid") { $Backdrop = "transparent" }
Write-Output "Selected: $Backdrop"
