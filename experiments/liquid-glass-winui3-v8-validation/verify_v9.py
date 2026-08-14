from pathlib import Path

root = Path(__file__).resolve().parent
header = (root / "LiquidGlassRenderer.h").read_text(encoding="utf-8")
parts = sorted(root.glob("LiquidGlassRenderer.part*.inc"))
cpp = "".join(p.read_text(encoding="utf-8") for p in parts) if parts else (root / "LiquidGlassRenderer.cpp").read_text(encoding="utf-8")
host = (root / "WinUIHost" / "MainWindow.xaml.cpp").read_text(encoding="utf-8")

# V9 must preserve every V8 architecture/safety invariant.
exec((root / "verify_v8.py").read_text(encoding="utf-8"), {"__file__": str(root / "verify_v8.py")})

checks = {
    "capture item Closed subscription": all(x in cpp for x in [
        "captureItem.Closed(",
        "captureClosedEvents.fetch_add(1)",
        "RequestCaptureRestart();",
    ]),
    "Closed handler revoked before teardown": "captureItem.Closed(captureItemClosedToken);" in cpp,
    "bounded capture recovery": all(x in cpp for x in [
        "kMaxRecoveryAttempts = 3",
        "captureRecoveryAttempts.fetch_add(1)",
        "captureRecoveryFailures.fetch_add(1)",
        "std::chrono::milliseconds(50 * (attempt + 1))",
    ]),
    "recovery deferred while screenshot frozen": "captureRestartRequested.load() || captureFrozen.load()" in cpp,
    "frame size change uses recovery queue": all(x in cpp for x in [
        "contentSize.Width) != captureWidth",
        "latest.Close();\n                    RequestCaptureRestart();",
    ]),
    "drain errors use recovery queue": "catch (winrt::hresult_error const&)\n            {\n                RequestCaptureRestart();" in cpp,
    "device removal remains terminal/visible": all(x in cpp for x in [
        "GetDeviceRemovedReason()",
        "deviceRemovedEvents.fetch_add(1)",
        "winrt::throw_hresult(deviceReason)",
    ]),
    "explicit display refresh API": "void RequestCaptureRefresh();" in header and "LiquidGlassRenderer::RequestCaptureRefresh()" in cpp,
    "WM_DISPLAYCHANGE forces capture refresh": all(x in host for x in [
        "case WM_DISPLAYCHANGE:",
        "m_renderer.RequestCaptureRefresh();",
        "UpdateGlassScreenRect();",
    ]),
    "V9 recovery stats exposed": all(x in header for x in [
        "captureClosedEvents",
        "captureRecoveryAttempts",
        "captureRecoveryFailures",
        "lastCaptureRecoveryHresult",
    ]),
}

for name, passed in checks.items():
    assert passed, name
    print(f"{name}: PASS")

# Small deterministic model for the recovery contract. This is not a WGC
# integration test; it checks the intended bounded/frozen/terminal semantics.
def recover(outcomes, frozen=False, device_removed=False):
    pending = True
    attempts = 0
    failures = 0
    alive = True
    if frozen:
        return pending, attempts, failures, alive
    pending = False
    for ok in outcomes[:3]:
        attempts += 1
        if device_removed:
            alive = False
            break
        if ok:
            return pending, attempts, failures, alive
        failures += 1
    return pending, attempts, failures, alive

assert recover([False, False, True]) == (False, 3, 2, True)
assert recover([False, False, False, True]) == (False, 3, 3, True)
assert recover([True], frozen=True) == (True, 0, 0, True)
assert recover([False], device_removed=True) == (False, 1, 0, False)
print("V9 bounded recovery state model: PASS")
print("V9 capture-session recovery: PASS")
