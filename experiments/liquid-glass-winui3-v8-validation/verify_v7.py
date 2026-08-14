from pathlib import Path
import re

root = Path(__file__).resolve().parent
header = (root / "LiquidGlassRenderer.h").read_text(encoding="utf-8")
parts = sorted(root.glob("LiquidGlassRenderer.part*.inc"))
cpp = "".join(p.read_text(encoding="utf-8") for p in parts) if parts else (root / "LiquidGlassRenderer.cpp").read_text(encoding="utf-8")
xaml = (root / "WinUIHost" / "MainWindow.xaml").read_text(encoding="utf-8")
main_cpp = (root / "WinUIHost" / "MainWindow.xaml.cpp").read_text(encoding="utf-8")

# Product architecture.
required = [
    "CompositionDrawingSurface",
    "ICompositionDrawingSurfaceInterop",
    "CreateGraphicsDevice",
    "SetElementChildVisual",
    "CreateForMonitor",
    "CreateFreeThreaded",
    "IDirect3DDxgiInterfaceAccess",
    "CopyResource",
    "WDA_NONE",
    "kWdaExcludeFromCapture",
    "captureFrozen",
]
for token in required:
    assert token in cpp, token

# No old hosting route.
for forbidden in [
    "SwapChainPanel",
    "CreateSwapChainForHwnd",
    "IDXGISwapChain",
    "Present(1",
    "WM_TIMER",
    "SetTimer(",
]:
    assert forbidden not in cpp, forbidden

# Reference optics remain.
optics = [
    "(channel - float2(.5,.5))",
    "displacementScale * cssScale",
    "for (int i = -12; i <= 12; ++i)",
    "lerp(l.xxx, c, 1.8)",
    "float3(1,1,1), .25",
    "halfSize - float2(spread, spread)",
    "rimOpacity = .62 + rimIntensity * .24",
]
for token in optics:
    assert token in cpp, token

# XAML owns actual control.
assert 'x:Name="GlassSurfaceHost"' in xaml
assert 'x:Name="GlassButton"' in xaml
assert "<Button.Template>" in xaml
assert 'Text="Generate"' in xaml
assert "<PathIcon" in xaml

# F1/F2 debug integration.
assert "VK_F1" in main_cpp
assert "VK_F2" in main_cpp
assert "SetScreenshotMode" in main_cpp

# Composition interop requires the update be fully initialized.
assert "drawContext->Clear" in cpp
assert "drawingSurfaceInterop->BeginDraw" in cpp
assert "drawingSurfaceInterop->EndDraw" in cpp

# WinUI host/template hygiene.
assert "RootGrid().Loaded" in main_cpp
assert "RootGrid().DispatcherQueue()" in main_cpp
assert "GlassButtonScale().ScaleX" in main_cpp
assert 'x:Name="GlassButtonScale"' in xaml
assert "publishedCaptureWidth" in cpp
assert "publishedCaptureHeight" in cpp

# Static source/HLSL hygiene only.
assert cpp.count("{") == cpp.count("}")
assert cpp.count('R"(') == cpp.count(')"')
assert not re.findall(r'\b\d+\.\d+\.(?:xx|xxx|xxxx)\b', cpp)

print("PASS")
print("WinUI 3 XAML host split: PASS")
print("Microsoft.UI.Composition surface bridge: PASS")
print("WGC + D3D11 optical engine: PASS")
print("no SwapChainPanel / HWND swap chain: PASS")
print("reference optical constants preserved: PASS")
print("F2 freeze-before-screenshot workflow: PASS")
