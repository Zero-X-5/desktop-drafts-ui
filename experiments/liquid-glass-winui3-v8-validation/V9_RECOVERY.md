# V9 Recovery Phase 1

V9 Phase 1 addresses the two concrete lifecycle gaps proven during V8 sandbox validation without changing the optical shader, F2 behavior, or the existing Tauri application.

## Scope

Implemented:

- subscribe to `GraphicsCaptureItem.Closed` and convert it into a render-thread recovery request;
- revoke the Closed handler before capture teardown;
- route capture-size changes and WGC drain exceptions through the same recovery path;
- add `LiquidGlassRenderer::RequestCaptureRefresh()`;
- handle `WM_DISPLAYCHANGE` with an unconditional capture refresh request even when host RECT/DPI are unchanged;
- retry capture recreation at most 3 times with 50ms / 100ms backoff;
- serialize recovery with the existing V8 `captureGate`, so F2 screenshot transitions cannot overlap WGC session recreation;
- preserve a recovery request while screenshot mode is frozen;
- use atomic `exchange(false)` when consuming a request so a concurrent Closed/DisplayChange request is not overwritten;
- keep true D3D device removal terminal and visible; Phase 1 does not rebuild D3D/Composition devices.

## New F1 health fields

- `closed`: number of `GraphicsCaptureItem.Closed` notifications;
- `recovery attempts/failures`;
- `rec-hr`: last capture recovery HRESULT.

Existing V8 fields remain unchanged.

## Recovery contract

Normal capture failure / Closed / display topology change:

```text
request restart
    -> render thread wakes
    -> acquire captureGate
    -> if F2 frozen: keep request pending
    -> atomically consume request
    -> recompute MonitorFromRect(current host rect)
    -> StartCapture
    -> up to 3 attempts
```

If all three capture-session attempts fail, the render thread remains alive and `rec-hr` exposes the failure. A future Closed/display-change/geometry event can request another bounded recovery cycle.

If `ID3D11Device::GetDeviceRemovedReason()` reports failure during recovery, V9 preserves V8 semantics: increment `device-removed`, publish the HRESULT, and terminate the render thread. Automatic D3D/Composition object reconstruction is intentionally deferred to Phase 2.

## Sandbox validation

The implementation was checked against V8 via branch diff: changes are limited to renderer recovery state, capture lifecycle, WinUI host display-change handling, stats, and verification code. Optical/HLSL files were not changed.

Platform-free recovery modeling passed:

- fail, fail, success -> 3 attempts / 2 failures / thread alive;
- three generic failures -> bounded at 3 / thread alive;
- request while F2 frozen -> zero attempts and request remains pending;
- F2 OFF -> pending recovery runs after exclusion is restored;
- device removal -> terminal render-thread state;
- 100,000 randomized Closed / display-change / F2 / recovery transitions preserved the fail-closed invariant.

Run `python verify_v9.py` in the source directory for static V7 -> V8 -> V9 regression checks.

## Still requires Windows validation

This Linux sandbox cannot prove Windows.Graphics.Capture or real display topology behavior. When a Windows machine is available, validate:

1. change resolution or scaling while the window remains stationary; recovery attempts should increment and capture age should return to normal;
2. disconnect/reconnect a secondary display; `closed` and/or recovery counters should move without permanent freeze;
3. repeat F2 during/around display changes; no recursive capture, affinity failure, or persistent screenshot state mismatch;
4. if an actual D3D device removal occurs, confirm `device-removed/hr/thread=DEAD` remains explicit.

Phase 2 is only justified if product requirements require automatic recovery from true D3D device removal.
