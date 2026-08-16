# CODEMAP — Liquid Glass Test Window

## 当前分支

`agent/liquid-glass-test-window`

这是从封板 V9 recovery HEAD 新开的最小对照窗口分支。旧 `src/` / `src-tauri/` 不参与运行。

## 结构

```text
experiments/liquid-glass-winui3-v8-validation/
├── LiquidGlassRenderer.h
├── LiquidGlassRenderer.cpp
├── LiquidGlassRenderer.part01.inc          V9 HLSL / optical recipe
├── LiquidGlassRenderer.part01profile.inc   两种 sample profile 的 INI loader
├── LiquidGlassRenderer.part02.inc          renderer state + selected profile
├── LiquidGlassRenderer.part03.inc          Composition / shader / displacement map
├── LiquidGlassRenderer.part04.inc          V9 WGC capture lifecycle（未改）
├── LiquidGlassRenderer.part05.inc          frame drain + profile-sized lighting analysis
├── LiquidGlassRenderer.part06.inc          V9 optical passes，profile 只提供几何/scale
├── LiquidGlassRenderer.part07.inc          V9 recovery/render thread + profile Attach
├── LiquidGlassRenderer.part08.inc          V9 public API/F2/stats（未改）
├── glass-test-window.ini                   Reference / Long Bar 参数
├── verify_test_window.py                   最小测试窗口静态契约
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

XAML：

```text
GlassContainer       274×148
GlassSurfaceHost     fill container
GlassButton          186×60
label                Generate + Zap
```

`m_renderer` 使用 `GlassProfileId::Reference`。

### Long Bar

XAML：

```text
LongBarContainer     336×124
LongBarSurfaceHost   fill container
lens profile         248×36
```

`m_longBarRenderer` 使用 `GlassProfileId::LongBar`。

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
CompositionDrawingSurface
   ↓
对应 XAML GlassSurfaceHost
```

profile 只进入：

- displacement map 宽高；
- lens 宽高；
- `opticalCssScale`。

HLSL 公式、35 displacement 基准、Gaussian 公式、saturation/brightness/white veil/radial/inset/rim 均未新增算法。

## V9 capture / recovery

封板路径仍在：

- `part04`：WGC session / FrameArrived / Closed；
- `part07`：bounds、3 次 bounded recovery、render thread、device removal boundary；
- `part08`：F2 fail-closed API / stats。

测试窗口在 `WM_DISPLAYCHANGE` 时分别调用两个 renderer 的 `RequestCaptureRefresh()`。

F2 API 保留在 renderer，但当前双实例窗口不绑定按键，以免在没有 shared coordinator 的情况下让两个 renderer 独立切换同一个 HWND 的 display affinity。

## 验证

`verify_test_window.py`：

1. 执行 `verify_v9.py`，后者继续执行 V8/V7。
2. 检查普通系统标题栏。
3. 检查 Reference / Long Bar 两块几何。
4. 检查两 renderer 实例和 profile config。
5. 检查无 F3/F4/frost mix。
6. 检查 display-change 双 refresh。
7. 检查 44px margin 和 1.00 / 0.60 optical scale 数学契约。

Windows 上最终需要执行：

```powershell
python verify_test_window.py
```

然后构建 WinUI host 并直接观察两个样本。当前非 Windows 环境不能代替实际 WinUI/D3D 构建。
