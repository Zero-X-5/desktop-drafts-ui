# Liquid Glass WinUI 3 Product Prototype V8 Validation

This is the V8 validation hardening of the product-oriented V7 source drop. The optical pipeline is intentionally unchanged; V8 adds lifecycle safety and observability for stress testing.

It is intentionally a **source drop for a standard Visual Studio WinUI 3 C++/WinRT project**, rather than a hand-written `.vcxproj`. That avoids coupling the renderer to one Visual Studio template revision.

## Target architecture

```text
WinUI 3 / XAML
├─ layout
├─ Button input / focus / accessibility / text / icon
│
└─ GlassSurfaceHost
   └─ Microsoft.UI.Composition SpriteVisual
      └─ CompositionSurfaceBrush
         └─ CompositionDrawingSurface
            ↑
            │ D2D BeginDraw / DrawBitmap
            │
       D3D11 final premultiplied texture
            ↑
            ├─ exact SVG-equivalent displacement
            ├─ 2-pass 25-tap Gaussian
            ├─ saturation 180%
            ├─ brightness 1.05
            ├─ 25% white veil
            ├─ corrected inset shadows
            └─ 24-bin rim

Windows.Graphics.Capture
└─ monitor frame
   └─ GPU CopyResource
      └─ D3D11 live-desktop SRV
```

## Why CompositionDrawingSurface instead of SwapChainPanel

The Win32 V5/V6 demo used a flip-model waitable swap chain because it owned a complete HWND.

The product control is different: Liquid Glass needs to live **inside the XAML visual tree**, clip/scale/move with XAML, and coexist with normal WinUI controls.

Windows App SDK exposes `ICompositorInterop`, `CompositionGraphicsDevice`, and `ICompositionDrawingSurfaceInterop` specifically for app-provided DirectX/Direct2D rendering into Microsoft.UI.Composition surfaces.

The renderer therefore:
1. creates the existing D3D11 device;
2. creates a D2D device on the same DXGI device;
3. gives the D2D device to `ICompositorInterop::CreateGraphicsDevice`;
4. creates a `CompositionDrawingSurface`;
5. renders the optical result into a small app-owned D3D11 texture;
6. `BeginDraw`s the composition surface as an `ID2D1DeviceContext`;
7. clears/touches the complete update and draws the D3D-backed bitmap;
8. `EndDraw`s;
9. XAML/Composition presents it.

There is **no HWND child swap chain and no SwapChainPanel**.

## Create the Visual Studio host

Create:

**Blank App, Packaged (WinUI 3 in Desktop) — C++**

Use the current **Stable** Windows App SDK channel. As of August 2026 Microsoft lists Stable as the production-supported channel.

Then:

1. Copy `LiquidGlassRenderer.h/.cpp` into the app project.
2. Replace the template `MainWindow.xaml`, `MainWindow.xaml.h`, and `MainWindow.xaml.cpp` with the files in `WinUIHost/`.
3. Merge `pch-additions.h` into the template `pch.h`.
4. Add the libraries from `link-libraries.txt` to the linker.
5. Build x64.

The renderer namespace is:

`Shijian::LiquidGlass`

The example XAML namespace is:

`LiquidGlassWinUI`

If the Visual Studio project has a different namespace, update `x:Class` and the namespaces in the two `MainWindow` C++ files.

## Product host geometry

The example uses:

- optical surface: **274 × 148 DIPs**
- actual button: **186 × 60 DIPs**

The extra area is the blur/shadow margin. The composition visual is attached to `GlassSurfaceHost`; the real XAML `Button` sits above it and remains responsible for input/accessibility.

This is the important split:

**DirectX renders material, not controls.**

## Live desktop

The renderer uses:

- `IGraphicsCaptureItemInterop::CreateForMonitor`
- `Direct3D11CaptureFramePool::CreateFreeThreaded`
- `IDirect3DDxgiInterfaceAccess`
- GPU `CopyResource`

The WGC `FrameArrived` callback only signals an event. Frame draining, the D3D11 immediate context, optical passes, and composition-surface updates are serialized on the renderer thread.

The host reports the optical surface's **physical screen rectangle**. The shader converts each material pixel to a physical monitor pixel, so the captured desktop remains spatially registered while the WinUI window moves.

Cross-monitor behavior remains V6-style: the renderer binds the monitor nearest the glass surface. True two-monitor simultaneous stitching is still deferred.

## Screenshot mode: F2

Normal mode:

`WDA_EXCLUDEFROMCAPTURE`

This prevents the live WGC monitor texture from recursively ingesting the app, but also makes the app disappear from supported system screenshots.

V8 keeps the V7 debug workflow and adds a strict capture barrier plus fail-safe affinity handling:

### F2 ON

1. Freeze the last good WGC texture.
2. Stop consuming capture frames.
3. Switch window display affinity to `WDA_NONE`.
4. System screenshot can now see the app.
5. The glass continues drawing from the frozen last-good desktop texture.

### F2 OFF

1. Restore `WDA_EXCLUDEFROMCAPTURE`.
2. Resume WGC frame consumption.

This is a **debug-only** mode. Shipping behavior should default to exclusion enabled.

## F1 performance / health panel

F1 toggles a small XAML debug panel showing:

- renderer FPS
- WGC FPS
- CPU optical frame time
- capture resolution
- captured frame count
- monitor rebind count
- intentionally dropped/coalesced WGC frames
- last captured-frame age
- render-thread ALIVE/DEAD state
- affinity failures and F2 barrier timeouts
- number of monitors intersecting the glass host
- device-removed count / last HRESULT
- self-exclusion state
- screenshot mode state

Unlike the old V5 overlay, this panel is plain XAML and is not part of the D3D renderer.

## Optical behavior preserved from V7/V6

### Preserved

- exact 8-bit SVG displacement map
- `35 * (channel - 0.5)` refraction
- 2-pass 25-tap Gaussian
- 180% saturation
- 1.05 brightness
- 25% white veil
- corrected CSS inset spread semantics
- directional shadow stack
- 24-bin rim
- Windows.Graphics.Capture monitor source
- `CreateFreeThreaded`
- render-thread-only D3D11 immediate context
- self-capture exclusion
- cursor capture disabled

### Changed for product integration

- no full-window faux-transparent Win32 renderer
- no HWND swap chain
- no `Present`
- no `SwapChainPanel`
- final output is a **transparent, button-sized CompositionDrawingSurface**
- normal XAML content renders the label/icon/input above the material
- Microsoft.UI.Composition controls presentation

## Expected next validation

On the Windows machine:

1. Build the WinUI 3 host.
2. Confirm the glass appears at the XAML button's exact position.
3. Move the app window; the desktop texture should stay spatially registered.
4. Resize / change DPI.
5. Move between monitors.
6. Run video behind the app and observe WGC freshness.
7. F1: record renderer/WGC numbers.
8. F2: verify the app becomes visible to system screenshots without immediately creating recursive capture.

## Not yet product-complete

This source drop intentionally does not add:

- dual-monitor stitching while the glass straddles two displays
- HDR capture pipeline
- device-lost reconstruction for every D3D/Composition object
- multiple Liquid Glass buttons sharing a single monitor capture session
- a reusable WinUI custom control class
- accessibility automation beyond the host XAML Button

Those are the next engineering layers after the single-control WinUI integration is proven.


## V8 stress-test guide

See `V8_VALIDATION.md` for the F2, mixed-DPI/cross-monitor, sustained high-motion, and display/device disruption validation matrix.
