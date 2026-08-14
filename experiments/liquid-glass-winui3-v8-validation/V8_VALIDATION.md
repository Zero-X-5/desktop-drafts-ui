# V8 validation scope

V8 validation is V7 plus lifecycle/diagnostic hardening. The optical shader and reference glass constants are intentionally unchanged.

## What changed

- F2 transitions are serialized against WGC frame draining with a timed capture gate.
  - ON: wait for any in-flight drain to finish -> freeze -> `WDA_NONE`.
  - OFF: while still frozen -> restore `WDA_EXCLUDEFROMCAPTURE` -> resume capture.
  - The UI waits at most 250 ms for the barrier. A timeout rejects the toggle instead of hanging the UI.
  - If restoring exclusion fails, capture stays frozen to avoid recursive self-capture.
- F2 keyboard autorepeat is ignored.
- Host bounds are published as one mutex-protected snapshot instead of five unrelated atomics.
- F1 detailed stats now include:
  - `dropped`: WGC frames dequeued but intentionally discarded because only the newest frame is copied.
  - `age`: milliseconds since the last successfully copied WGC frame.
  - `thread`: render-thread ALIVE/DEAD.
  - `affinity-fail`: failed `SetWindowDisplayAffinity` calls.
  - `barrier-timeout`: F2 transition could not acquire the capture gate within 250 ms.
  - `monitors`: number of monitors intersecting the glass host rectangle.
  - `device-removed` and `hr`: device-removal count and last render-thread HRESULT.
- `DXGI_ERROR_DEVICE_REMOVED` is surfaced as a render-thread failure instead of silently returning with stale FPS values.

## Windows validation matrix

### A. F2 transition stress

1. Start normally; enable F1.
2. Press F2 rapidly 50-100 times, ending with screenshot mode OFF.
3. Hold F2 for several seconds once; autorepeat should not cause repeated toggles.
4. Expected final state:
   - `self-excluded=YES`
   - `screenshot-mode=OFF`
   - `affinity-fail=0`
   - `barrier-timeout=0` under a healthy GPU
   - `thread=ALIVE`
5. Any nonzero `affinity-fail` is a correctness failure. A nonzero `barrier-timeout` is a scheduling/GPU-stall signal, not a recursive-capture failure.

### B. Cross-monitor / mixed-DPI stress

1. Put the window fully on monitor A: expect `monitors=1`.
2. Slowly move the glass control across the seam: `monitors=2` while it spans both monitors.
3. Repeat 30+ round trips between monitors of different DPI if available.
4. Watch `rebinds`, `dropped`, `age`, `thread`, and visual continuity.
5. Known V8 limitation: capture is still single-monitor. `monitors=2` explicitly marks the region where perfect two-monitor background sampling is not expected.

### C. Capture bandwidth / high-motion stress

1. Run a high-motion video/animation behind the glass.
2. Prefer a 4K/high-refresh monitor if available.
3. Drag/resize continuously for 2-5 minutes.
4. Healthy signs:
   - `thread=ALIVE`
   - `age` stays close to one/few frame intervals outside screenshot mode
   - `dropped` may rise under load, but visuals remain current rather than freezing
   - `R-FPS` and `WGC` recover after transient load
5. Record GPU usage separately in Task Manager/PIX if available; V8 `CPU` is still CPU-side optical-frame time, not GPU timestamp time.

### D. Display/device disruption

1. While F1 is visible, disconnect/reconnect a secondary monitor or change display mode/DPI.
2. Observe whether capture resumes and whether `rebinds` increments.
3. If a graphics-device reset occurs, V8 should expose it via `device-removed`, `hr`, and `thread=DEAD` rather than leaving stale healthy-looking FPS values.
4. Automatic D3D/Composition device recreation is intentionally not implemented in this validation build; a DEAD thread currently requires renderer/app restart.

## Real-machine results — 2026-08-14

The GitHub V8 renderer hardening was pulled from `agent/liquid-glass-v8-validation`, copied into the local prototype, adapted from the WinUI Composition host to the existing Win32 layered-window host, and built as a fully static Win32 executable. The renderer hardening itself was retained during that host adaptation.

Observed normal state before stress:

- `R-FPS 51`
- `WGC 51`
- `CPU 1.83ms`
- `cap 3200x2000`
- `frames=767`
- `drop=0`
- `age=15ms`
- `rebinds=1`
- `mon=1`
- `afail=0`
- `btimeout=0`
- `devrem=0`
- `hr=0x0`
- `thread=OK`
- `excl=YES`
- `shot=OFF`

F2 functional check also passed: ON produced `excl=NO / shot=ON` with capture age increasing while frozen; OFF restored `excl=YES / shot=OFF`, and capture age returned to 28 ms.

### A. F2 transition stress — PASS

Executed 80 rapid F2 presses plus 12 long-press attempts.

Final/observed results:

- `afail=0` throughout.
- `btimeout=0` throughout; the 250 ms capture barrier did not time out.
- `thread=OK` throughout.
- Final state correctly returned to `excl=YES / shot=OFF`.
- `drop` accumulated 38 frames during repeated freeze/resume transitions, then stopped increasing after normal capture resumed.

Interpretation: the strict capture gate and fail-closed affinity ordering survived repeated state transitions without deadlock, affinity failure, persistent screenshot-state mismatch, or continued capture backlog. The 38 dropped frames are treated as bounded transition-time coalescing rather than a sustained throughput failure because the counter stopped growing after recovery.

### Additional in-monitor movement stress — PASS

Executed 40 rapid drags, including screen corners and edges.

Results:

- `rebinds=1` remained stable; no rebind storm.
- `drop=0` during movement.
- `thread=OK` remained stable.
- `mon` could briefly become `0` while the host rectangle was partially/fully outside all monitor rectangles at a screen edge. This is a valid geometry-observability state, not by itself a capture failure.

This test validates high-frequency bounds updates and ordinary same-monitor movement. It does **not** replace matrix B, because a true monitor-A -> monitor-B capture-source rebind was not exercised here.

### C. Capture bandwidth / high-motion stress — PASS for tested hardware/workload

Ran an Edge full-screen high-motion animation/scroll workload for three minutes with a 3200x2000 WGC source.

| Time | R-FPS | WGC | CPU | drop | age |
|---|---:|---:|---:|---:|---:|
| t0 | 55 | 55 | 2.11 ms | 0 | 5 ms |
| t60s | 55 | 55 | 2.31 ms | 0 | 12 ms |
| t120s | 55 | 55 | 2.48 ms | 0 | 12 ms |
| t180s | 55 | 55 | 2.28 ms | 0 | 3 ms |

Final cumulative capture count: `frames=10175`.

Interpretation:

- `drop=0` for the complete sustained run.
- `age` stayed below 15 ms and showed no upward trend.
- Renderer and WGC rates remained at roughly 55 FPS.
- CPU optical-frame time fluctuated in a narrow ~2.1-2.5 ms range and did not show sustained degradation.
- The full-screen 3200x2000 `CopyResource` path is therefore not a demonstrated bottleneck on this tested single-renderer hardware/workload.

This result does not claim unlimited capacity for 4K/5K, very high refresh rates, integrated GPUs, battery-saving modes, HDR, or multiple independent renderer instances.

### B. Cross-monitor / mixed-DPI stress — PENDING

The completed movement test did not perform repeated true monitor-source transitions. Still required:

- full monitor A -> monitor B transitions;
- preferably different DPI/scaling between A and B;
- confirm expected `rebinds` increments once per source transition rather than forming a rebind storm;
- confirm `age` returns to normal and `thread=OK` remains stable after every rebind;
- observe the known `monitors=2` single-source sampling limitation while straddling the seam.

### D. Display/device disruption — PENDING

Still required:

- disconnect/reconnect a secondary monitor;
- display resolution/scaling/mode changes;
- observe capture recovery/rebind behavior;
- if a graphics reset/device removal occurs, confirm `devrem/hr/thread` exposes the failure unambiguously.

Automatic device reconstruction remains outside V8.

## Current pass gate before architecture convergence

Passed on real hardware:

- F2 stress: PASS.
- F2 affinity/barrier fail-safe observability: PASS.
- High-frequency same-monitor movement/bounds updates: PASS.
- Sustained 3200x2000 high-motion single-renderer capture: PASS.

Still open:

- Mixed-DPI true cross-monitor round trips.
- Display/device disruption and recovery observability.
- Dual-monitor stitching is still an intentionally missing capability rather than a failed test.
- HDR and shared capture for multiple Liquid Glass controls remain productization work.

Do not create a stability-only V9 based solely on the already-passed A/C tests. First finish B/D; only implement V9 if those tests expose a concrete lifecycle defect, or move to architecture convergence/shared capture once the remaining validation gate is satisfied.
