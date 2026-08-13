$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $root "NativeGlassDemo.cpp"
$bin = Join-Path $root "bin"
$object = Join-Path $bin "NativeGlassDemo.obj"
$exe = Join-Path $bin "NativeGlassDemo.exe"
$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$sdk = "C:\Program Files (x86)\Windows Kits\10"
$sdkVersion = "10.0.26100.0"
$clPath = Get-ChildItem -Path "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" -Recurse -Filter cl.exe | Where-Object { $_.FullName -like "*Hostx64*x64*" } | Select-Object -First 1

if (-not (Test-Path -LiteralPath $vcvars)) {
  throw "Visual Studio C++ environment not found: $vcvars"
}
if (-not (Test-Path -LiteralPath (Join-Path $sdk "Include\$sdkVersion\um\windows.h"))) {
  throw "Windows SDK $sdkVersion was not found under $sdk"
}
if (-not $clPath) {
  throw "MSVC x64 compiler was not found"
}

$msvcRoot = $clPath.Directory.Parent.Parent.Parent.FullName
$msvcInclude = Join-Path $msvcRoot "include"
$msvcAuxInclude = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\VS\include"
$msvcLib = Join-Path $msvcRoot "lib\x64"

New-Item -ItemType Directory -Force -Path $bin | Out-Null

$include = "$msvcInclude;$msvcAuxInclude;$sdk\Include\$sdkVersion\shared;$sdk\Include\$sdkVersion\ucrt;$sdk\Include\$sdkVersion\um;$sdk\Include\$sdkVersion\winrt"
$lib = "$msvcLib;$sdk\Lib\$sdkVersion\ucrt\x64;$sdk\Lib\$sdkVersion\um\x64"
$command = "call `"$vcvars`" && set `"INCLUDE=$include`" && set `"LIB=$lib`" && cl.exe /nologo /std:c++17 /utf-8 /EHsc /W4 /DUNICODE /D_UNICODE `"$source`" /Fe:`"$exe`" /Fo:`"$object`" user32.lib gdi32.lib dwmapi.lib"
& $env:ComSpec /d /s /c $command
if ($LASTEXITCODE -ne 0) {
  throw "Native Glass Demo build failed with exit code $LASTEXITCODE"
}

Write-Output "Built: $exe"
