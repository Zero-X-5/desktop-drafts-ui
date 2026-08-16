# CODEMAP — Liquid Glass Test Window

## 当前分支

`agent/liquid-glass-test-window`

这是从封板 V9 recovery HEAD 新开的最小对照窗口分支。旧 `src/` / `src-tauri/` 不参与运行。

## 结构

```text
experiments/liquid-glass-winui3-v8-validation/
├── LiquidGlassRenderer.h
├── LiquidGlassRenderer.cpp
├── LiquidGlassRenderer.part01.inc          V9 HLSL；scene UV 现在 clamp，不注入黑 sentinel
├── LiquidGlassRenderer.part01profile.inc   两种 sample profile 的 INI loader
├── LiquidGlassRenderer.part02.inc          renderer state + selected profile
├── LiquidGlassRenderer.part03.inc          Composition bridge；no-stretch/pixel-snap presentation
├── LiquidGlassRenderer.part04.inc          V9 WGC capture lifecycle（未改）
├── LiquidGlassRenderer.part05.inc          frame drain + profile-sized lighting analysis
├── LiquidGlassRenderer.part06.inc          V9 optical passes，profile 只提供几何/scale
├── LiquidGlassRenderer.part07.inc          V9 recovery/render thread + profile Attach
├── LiquidGlassRenderer.part08.inc          V9 public API + reciprocal-DPI brush mapping
├── glass-test-window.ini                   Reference / Long Bar 参数
├── verify_test_window.py                   最小窗口 + anti-flicker 静态契约
└── WinUIHost/
    ├── MainWindow.xaml                     普通窗口 + 两个 sample
    ├── MainWindow.xaml.h                   两个 renderer 实例
    └── MainWindow.xaml.cpp                 布局坐标同步 / display refresh
```

## MainWindow

窗口保留 Windows 默认 caption/title bar，没有：

- `WS_CAPTION` 移除；
- 自绘 title bar；
- `WM_NCLBUTTONDOWN` 模拟拖动；
- `SetWindowRgn`。

因此窗口移动直接使用系统标题栏。

内容从上到下只有两个实时样本。

### V9 Reference

```text
GlassContainer       274×148
GlassSurfaceHost     fill container
GlassButton          186×60
label                Generate + Zap
renderer             GlassProfileId::Reference
```

### Long Bar

```text
LongBarContainer     336×124
LongBarSurfaceHost   fill container
lens profile         248×36
renderer             GlassProfileId::LongBar
```

两种 host 都给 lens 保留 44px optical margin。

## Profile 配置

`glass-test-window.ini`：

```ini
[reference]
lens_width=186
lens_height=60
map_width=186
map_height=60
optical_scale_percent=100

[long_bar]
lens_width=248
lens_height=36
map_width=248
map_height=36
optical_scale_percent=60
```

`part01profile.inc` 负责读取配置。配置文件找不到时使用相同数值作为 fallback。

## Renderer 数据流

两实例走相同流程：

```text
GlassProfileId
   ↓
LoadGlassProfile
   ↓
CreateDisplacementMap(profile.mapWidth/mapHeight)
   ↓
WGC monitor frame
   ↓
Scene pass
   ↓
2-pass 25-tap Gaussian
   ↓
V9 composite
   ↓
CompositionDrawingSurface (physical px)
   ↓
CompositionSurfaceBrush Stretch=None
Scale=1/DPI + SnapToPixels
   ↓
对应 XAML GlassSurfaceHost
```

profile 只进入 displacement map 宽高、lens 宽高和 `opticalCssScale`。HLSL 的材质公式、35 displacement 基准、Gaussian、saturation/brightness/white veil/radial/inset/rim 没有新增算法。

## Anti-flicker presentation path

### `part01.inc` — capture edge

Scene sampler 使用 `D3D11_TEXTURE_ADDRESS_CLAMP`。旧代码在 UV 越出 `[0,1]` 时绕过 sampler 并直接返回深黑 RGB；当前改成：

```text
saturate(CaptureUv(localP + displacement))
→ linearClamp sample
```

因此 monitor edge、窗口移动期间的暂时坐标偏差、以及 displacement 越界都使用最近的真实桌面边缘像素，不会人为注入黑块。

### `part03.inc` + `part08.inc` — physical pixel mapping

`CompositionDrawingSurface` 使用物理像素大小，而 XAML visual 使用 DIP。当前 bridge：

```text
Stretch=None
HorizontalAlignmentRatio=0
VerticalAlignmentRatio=0
SnapToPixels=true
BitmapInterpolationMode=NearestNeighbor
Scale=1/rasterizationScale
```

这避免 `Stretch=Fill` 对 physical surface 做额外 resample，也避免非 100% DPI 下 physical→DIP→physical 的重复缩放。

## V9 capture / recovery

封板路径仍在：

- `part04`：WGC session / FrameArrived / Closed，未修改；
- `part07`：bounds、3 次 bounded recovery、render thread、device removal boundary；
- `part08`：F2 fail-closed API / stats；本分支只在 `SetHostScreenRect` 增加 Composition brush 的 reciprocal-DPI mapping。

测试窗口在 `WM_DISPLAYCHANGE` 时分别调用两个 renderer 的 `RequestCaptureRefresh()`。

F2 API 保留在 renderer，但当前双实例窗口不绑定按键，以免两个独立 renderer 在没有 shared coordinator 的情况下分别修改同一个 HWND 的 display affinity。

## 当前没有采用的候选修复

- 不加入 WGC `MinUpdateInterval`：Windows 11 24H2 有公开 update-cadence 问题，但当前黑闪先由确定性的 shader black sentinel / Composition scaling 修复；避免无证据增加 SDK 版本依赖。
- 不修改 V9 optical recipe。
- 不加入 F3/F4、frost mix 或 9-slice。

## 验证

`verify_test_window.py`：

1. 执行 `verify_v9.py`，后者继续执行 V8/V7。
2. 检查普通系统标题栏。
3. 检查 Reference / Long Bar 两块几何。
4. 检查两 renderer 实例和 profile config。
5. 检查无 F3/F4/frost mix。
6. 检查 display-change 双 refresh。
7. 检查 44px margin 和 1.00 / 0.60 optical scale。
8. 禁止 `CompositionStretch::Fill`，要求 no-stretch / pixel snap / nearest / 1-DPI mapping。
9. 禁止 scene shader 深黑 out-of-bounds sentinel，要求 capture UV clamp。
10. 对 274×148 与 336×124 在 100/125/150/200% DPI 验证 physical pixel round-trip。

当前非 Windows 环境不能代替实际 WinUI/D3D 构建。Windows 真机需要重点测静止、拖动、屏幕边缘和非 100% DPI；若仅拖动/resize 仍有轻微空白，再处理 WinUI 3 / DWM 同步层。
