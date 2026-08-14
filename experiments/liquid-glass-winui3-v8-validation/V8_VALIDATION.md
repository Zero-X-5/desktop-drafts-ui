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

## Pass gate before architecture convergence

- F2 stress: no recursive self-capture, no affinity failures, no persistent screenshot state mismatch.
- Mixed-DPI round trips: no render-thread death and no permanent capture freeze.
- Sustained high-motion load: frame age returns to normal after stress; dropped frames are measurable rather than hidden.
- Display disruption: failure/recovery state is unambiguous from F1; no stale "55 FPS" masking a dead renderer.
