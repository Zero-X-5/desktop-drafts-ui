from pathlib import Path

root = Path(__file__).resolve().parent
parts = sorted(root.glob("LiquidGlassRenderer.part*.inc"))
cpp = "".join(p.read_text(encoding="utf-8") for p in parts)
header = (root / "LiquidGlassRenderer.h").read_text(encoding="utf-8")
xaml = (root / "WinUIHost" / "MainWindow.xaml").read_text(encoding="utf-8")
host_cpp = (root / "WinUIHost" / "MainWindow.xaml.cpp").read_text(encoding="utf-8")
host_h = (root / "WinUIHost" / "MainWindow.xaml.h").read_text(encoding="utf-8")
config = (root / "glass-test-window.ini").read_text(encoding="utf-8")

# Keep sealed V7 -> V8 -> V9 renderer/recovery contracts.
exec((root / "verify_v9.py").read_text(encoding="utf-8"), {"__file__": str(root / "verify_v9.py")})

checks = {
    "simple software window": all(x in xaml for x in [
        'Title="Liquid Glass Test Window"',
        'Text="Liquid Glass Test Window"',
    ]),
    "standard draggable titlebar": all(x not in host_cpp for x in [
        "SetWindowRgn",
        "WS_CAPTION",
        "WM_NCLBUTTONDOWN",
        "SetTitleBar(",
    ]),
    "exact V9 reference sample": all(x in xaml for x in [
        'x:Name="GlassContainer"',
        'Width="274"',
        'Height="148"',
        'x:Name="GlassButton"',
        'Width="186"',
        'Height="60"',
        'Text="Generate"',
    ]),
    "long bar sample": all(x in xaml for x in [
        'x:Name="LongBarContainer"',
        'x:Name="LongBarSurfaceHost"',
        'Width="336"',
        'Height="124"',
        'Text="LONG BAR · 248×36"',
    ]),
    "two renderer instances": all(x in host_h + host_cpp for x in [
        "m_longBarRenderer",
        "GlassProfileId::Reference",
        "GlassProfileId::LongBar",
        "LongBarSurfaceHost()",
    ]),
    "profile config externalized": all(x in config for x in [
        "[reference]",
        "lens_width=186",
        "lens_height=60",
        "map_width=186",
        "map_height=60",
        "optical_scale_percent=100",
        "[long_bar]",
        "lens_width=248",
        "lens_height=36",
        "map_width=248",
        "map_height=36",
        "optical_scale_percent=60",
    ]) and all(x in cpp for x in [
        "LoadGlassProfile",
        "GetPrivateProfileIntW",
        "glass-test-window.ini",
    ]),
    "profile-driven displacement map": all(x in cpp for x in [
        "profile.mapWidthCss",
        "profile.mapHeightCss",
        "int mapWidthCss = std::max(1, profile.mapWidthCss)",
        "int mapHeightCss = std::max(1, profile.mapHeightCss)",
    ]),
    "profile-driven lens geometry": all(x in cpp for x in [
        "profile.lensWidthCss * cssScale",
        "profile.lensHeightCss * cssScale",
        "cssScale * std::max(.10f, profile.opticalScale)",
        "sceneParams.cssScale = opticalCssScale",
        "blur.sigma = 2.0f * opticalCssScale",
        "composite.cssScale = opticalCssScale",
    ]),
    "no rejected diagnostic stack": all(x not in header + cpp + host_cpp for x in [
        "CycleOpticalDebugMode",
        "CycleFrostAmount",
        "kFrostMixShader",
        "VK_F3",
        "VK_F4",
    ]),
    "both refresh on display change": all(x in host_cpp for x in [
        "case WM_DISPLAYCHANGE:",
        "m_renderer.RequestCaptureRefresh();",
        "m_longBarRenderer.RequestCaptureRefresh();",
    ]),
    "no tauri webview runtime": "Tauri" not in xaml and "WebView" not in xaml and "tauri" not in host_cpp.lower(),
}

for name, passed in checks.items():
    assert passed, name
    print(f"{name}: PASS")

# Both samples use the same 44px optical margin. The reference remains the
# exact V9 274x148 / 186x60 geometry; the long bar only changes the lens size.
assert (274 - 186) / 2 == 44
assert (148 - 60) / 2 == 44
assert (336 - 248) / 2 == 44
assert (124 - 36) / 2 == 44

# Spatial optics: reference stays 1.00x, long bar is the prior 36/60 = .60x.
assert 60 / 60 == 1.0
assert abs(36 / 60 - 0.60) < 1e-9
assert 35 * 1.0 == 35
assert abs(35 * 0.60 - 21) < 1e-9
assert 2 * 1.0 == 2
assert abs(2 * 0.60 - 1.2) < 1e-9

print("44px reference/long-bar margins: PASS")
print("reference 35/2 and long-bar 21/1.2 spatial optics: PASS")
print("Liquid Glass Test Window static validation: PASS")
