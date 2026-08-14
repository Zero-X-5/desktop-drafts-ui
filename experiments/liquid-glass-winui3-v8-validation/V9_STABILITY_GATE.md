# V9 stability seal gate

V9 Recovery Phase 1 has already passed direct Windows checks for forced `WM_DISPLAYCHANGE` recovery and F2/recovery interleaving. This gate is the last stability pass before starting the formal Shijian integration branch.

The gate intentionally does **not** add renderer features. It looks for slow leaks, stale capture, lifecycle hangs, and recovery/F2 regressions that short interactive tests can miss.

## Prerequisites

Use the Win32 V9 build that preserves the V9 title metrics. The title should expose at least most of:

`R-FPS WGC CPU drop age rebinds closed rec=<attempts>/<failures> afail btimeout devrem thread excl shot`

The scripts use only Windows PowerShell plus Win32 APIs from `user32.dll`.

## A. 60-minute soak

Recommended command from this directory:

```powershell
$exe = 'D:\path\to\LiquidGlass LiveDesktopV9.exe'
powershell -ExecutionPolicy Bypass -File .\stress-v9-soak.ps1 `
  -ExePath $exe `
  -DurationMinutes 60 `
  -SampleSeconds 60 `
  -ExerciseEveryMinutes 5
```

Every five minutes the script performs one bounded exercise cycle:

1. F2 ON, then F2 OFF;
2. inject one `WM_DISPLAYCHANGE` to force capture-session recovery;
3. nudge the window by 24×16 pixels and restore it.

It samples process private memory, working set, Handle count, and title metrics to CSV. A JSON summary is written beside the CSV.

### Hard FAIL conditions

- process exits during the soak;
- `thread=DEAD`;
- `afail > 0`;
- `btimeout > 0`;
- `devrem > 0`;
- recovery failures (`rec` second value) > 0;
- normal capture age is over 100ms for 3 consecutive one-minute samples;
- final parsed state is not `excl=YES / shot=OFF`;
- injected `WM_DISPLAYCHANGE` cycles do not produce corresponding recovery attempts when `rec` is available.

### Leak warnings

The default script emits `PASS_WITH_WARNING` rather than a hard failure when:

- private memory grows by more than 64MB from first to last sample; or
- Handle count grows by more than 64.

Allocator/GPU caching can make endpoint deltas noisy. A warning should be reviewed in the CSV: a persistent monotonic rise is a blocker; an early rise followed by a plateau is not automatically a leak.

For a shorter smoke run, `-DurationMinutes 30` is acceptable. The 60-minute run is the preferred seal gate.

## B. 50-cycle lifecycle test

```powershell
$exe = 'D:\path\to\LiquidGlass LiveDesktopV9.exe'
powershell -ExecutionPolicy Bypass -File .\stress-v9-lifecycle.ps1 `
  -ExePath $exe `
  -Iterations 50 `
  -WarmupSeconds 3 `
  -ExitTimeoutSeconds 5
```

Each iteration:

1. starts a new process;
2. waits for the main HWND;
3. lets WGC initialize;
4. injects one `WM_DISPLAYCHANGE` recovery;
5. performs one F2 ON/OFF cycle;
6. checks title health fields;
7. sends `WM_CLOSE` and requires a clean exit within five seconds.

### PASS conditions

All 50 iterations must:

- create the main window;
- remain alive during warmup/exercise;
- avoid `thread=DEAD`;
- keep `afail=0 / btimeout=0 / devrem=0 / recovery failures=0` when those fields are present;
- return to `excl=YES / shot=OFF` when those fields are present;
- exit within the timeout with exit code 0;
- require zero forced cleanup kills.

## Existing V9 Windows evidence

Already passed before this seal gate:

- F1 V9 fields active: `closed=0`, recovery counters/`rec-hr`, `afail=0`, `btimeout=0`, `devrem=0`, `thread=OK`.
- Five injected `WM_DISPLAYCHANGE` events: recovery rose from 1 to 6, `rec=6/0`, `rebinds=6`, `rec-hr=0x0`, `drop=0`, `age=2ms`, `thread=OK`.
- 20 F2/recovery interleaves: `rec=11/0`, `rebinds=11`, `afail=0`, `btimeout=0`, `devrem=0`, final `excl=YES / shot=OFF`, `thread=OK`; `drop=5` was limited to the interleaving transient.

A real `GraphicsCaptureItem.Closed` event remains useful evidence if a physical display disconnect happens naturally, but `closed=0` does **not** block formal integration after this seal gate passes.

## Final Windows seal result — PASS

Completed on 2026-08-14.

### Lifecycle

- 50/50 iterations passed.
- `afail=0 / btimeout=0 / devrem=0 / recF=0 / thread=OK`.
- All processes exited normally; no forced cleanup.
- The original harness helper named `H` collided with PowerShell's `h` / `Get-History` alias on Windows. The repository script has been corrected to use `Wait-Hwnd`.

### 60-minute soak

Result: `PASS_WITH_WARNING`, accepted after reviewing the resource trends.

Hard gate remained clean:

- `rec=12/0`;
- `afail=0 / btimeout=0 / devrem=0`;
- `thread=OK`;
- `age < 31ms`;
- final `excl=YES / shot=OFF`.

Resource observations:

- private memory rose from roughly 114MB toward the 430–480MB range during the first ~30 minutes, then plateaued and ended near 427MB; this was not a continuing monotonic leak;
- Handle count rose early and plateaued around 530 by approximately minute 5;
- `drop` had one late transient jump to 59 around minute 55 during an F2/display-change exercise, while `age` and thread health remained normal. Keep this as an integration-era observation, not a seal blocker.

## Decision after the gate

**V9 Recovery Phase 1 is sealed.**

The next branch is:

`agent/liquid-glass-integration`

That branch should integrate exactly one Liquid Glass region into the current Shijian application behind a fallback/feature switch. It should not immediately replace the whole UI and should not start V9 Phase 2 device reconstruction without actual `devrem` evidence.
