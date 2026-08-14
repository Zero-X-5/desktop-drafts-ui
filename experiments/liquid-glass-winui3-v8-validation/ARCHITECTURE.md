# V7 architecture decisions

## 1. Composition is presentation, not the optical engine

Microsoft.UI.Composition receives the finished pixels. It does not attempt to reproduce the non-linear displacement effect with `CompositionEffectBrush`.

## 2. D3D11 remains the optical engine

The reference material stays exactly where it was proven:
- 8-bit displacement map
- two-pass Gaussian
- surface color processing
- directional shadow/bevel
- rim

## 3. XAML owns controls

The material renderer draws **no text and no icon** in V7.

The visible `Generate` label and lightning path are XAML, which gives the product:
- focus
- keyboard input
- automation/accessibility
- theme foreground
- normal layout

## 4. Small transparent composition surface

The D3D output is a 274x148-DIP optical region, not a 2174x1369 full-window renderer.

This keeps the expensive work bounded and makes multiple future glass controls possible.

## 5. Screenshot debugging is safe-by-freeze

Temporarily setting `WDA_NONE` while continuing live monitor capture would make the app ingest itself.

V7 freezes the last good WGC texture first. This makes F2 suitable for screenshots without changing the shipping capture policy.
