from pathlib import Path

root = Path(__file__).resolve().parent
header = (root / "LiquidGlassRenderer.h").read_text(encoding="utf-8")
parts = sorted(root.glob("LiquidGlassRenderer.part*.inc"))
cpp = "".join(p.read_text(encoding="utf-8") for p in parts) if parts else (root / "LiquidGlassRenderer.cpp").read_text(encoding="utf-8")
host = (root / "WinUIHost" / "MainWindow.xaml.cpp").read_text(encoding="utf-8")

# Preserve V7 optical/product architecture.
exec((root / "verify_v7.py").read_text(encoding="utf-8"), {"__file__": str(root / "verify_v7.py")})

checks = {
    "strict F2 capture gate": all(x in cpp for x in [
        "std::timed_mutex captureGate",
        "std::scoped_lock captureLock(captureGate)",
        "try_lock_for(std::chrono::milliseconds(250))",
    ]),
    "affinity fail-safe": all(x in cpp for x in [
        "affinityFailures.fetch_add(1)",
        "captureFrozen.store(true)",
        "bool LiquidGlassRenderer::SetScreenshotMode",
    ]),
    "F2 autorepeat filter": "(lParam & (1LL << 30)) == 0" in host,
    "capture drop/age metrics": all(x in cpp for x in [
        "droppedCaptureFrames",
        "lastCaptureFrameTickNs",
        "captureAgeMs",
    ]),
    "render health metrics": all(x in cpp for x in [
        "renderThreadAlive.store(true)",
        "renderThreadAlive.store(false)",
        "lastRenderHresult",
        "deviceRemovedEvents",
    ]),
    "cross-monitor observability": all(x in cpp for x in [
        "CountIntersectingMonitors",
        "publishedHostMonitorCount",
    ]),
    "coherent bounds snapshot": all(x in cpp for x in [
        "std::mutex boundsMutex",
        "desiredHostScreenRect",
        "desiredRasterizationScale",
    ]),
}

for name, passed in checks.items():
    assert passed, name
    print(f"{name}: PASS")

for forbidden in ["desiredLeft", "desiredTop", "desiredRight", "desiredBottom"]:
    assert forbidden not in cpp, forbidden

assert "droppedCaptureFrames" in header
assert "screenshotBarrierTimeouts" in header
assert "hostMonitorCount" in header
assert "renderThreadAlive" in header
print("V8 validation instrumentation: PASS")
