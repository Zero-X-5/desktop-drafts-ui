# STATUS — Liquid Glass Test Window

- 更新日期: 2026-08-16
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `2d5acd74`（anti-flicker presentation/capture-edge 修复完成；后续文档提交仅同步交接状态）

## 当前分支

`agent/liquid-glass-test-window`

## 当前状态

本分支从封板 V9 `45bc51a6` 创建，只保留一个普通原生测试窗口，同时显示两个实时 Liquid Glass 样本：

1. **V9 Reference**：274×148 host，中心 186×60 `Generate + Zap`；
2. **Long Bar**：336×124 host，中心 248×36 长条。

窗口使用普通 Windows 系统标题栏拖动；不包含 F3/F4、frost mix、9-slice、Tauri/WebView 或产品 UI。

## 最新问题：运行/移动时黑闪

用户真机反馈窗口运行后存在明显闪烁和黑色闪帧。已按 Microsoft 官方文档/官方仓库公开 issue 检查 Composition、D3D texture addressing、WGC 和 WinUI 3 move/resize rendering。

本轮只修确定性的 presentation/capture-edge 问题，不改变 Liquid Glass 光学配方。

### 修复 1 — Composition surface 取消 Fill 二次缩放

`CompositionDrawingSurface` 实际按物理像素 resize，而 XAML child visual 使用 DIP。旧 V9 bridge 使用：

```text
CompositionSurfaceBrush Stretch = Fill
```

当前改为：

```text
Stretch = None
HorizontalAlignmentRatio = 0
VerticalAlignmentRatio = 0
SnapToPixels = true
BitmapInterpolationMode = NearestNeighbor
brush.Scale = 1 / rasterizationScale
```

这沿用此前 Native RAW 真机已经验证过的 physical-pixel 映射方案，避免物理 surface 先被 Fill 缩放到 DIP，再由 DWM 输出到设备像素。

### 修复 2 — capture 越界不再注入深黑 sentinel

Scene shader 原本在 displacement 后 UV 稍微越出 monitor 时直接返回：

```text
float4(0.035, 0.040, 0.048, 1)
```

但 D3D sampler 本身已是 `D3D11_TEXTURE_ADDRESS_CLAMP`。当前改为显式：

```text
uv = saturate(CaptureUv(...))
```

然后继续采样真实 desktop edge pixel。窗口移动、靠显示器边缘或折射把采样点推出 [0,1] 时，不再人为制造一帧深黑区域。

## 保持不变

- V9 WGC `part04` capture lifecycle / FrameArrived / Closed；
- captureGate / display-affinity fail-closed API；
- V9 bounded 3-attempt recovery；
- device-removal `thread=DEAD` 边界；
- displacement / Gaussian / saturation / brightness / white veil / radial / inset / rim 公式；
- Reference / Long Bar profile 参数；
- 普通系统标题栏与双 sample UI。

未加入 `MinUpdateInterval`：Windows 11 24H2 确有 WGC update-cadence 相关公开问题，但该 API 主要针对捕获更新节奏，不是当前黑色 sentinel / Composition 二次缩放的确定性根因，而且会增加 SDK 版本依赖。

## Profile

### Reference

```text
lens            186×60
host            274×148
map             186×60
optical scale   1.00
DISP_SCALE      35
Gaussian sigma  2 CSS px
margin          44px
```

### Long Bar

```text
lens            248×36
host            336×124
map             248×36
optical scale   0.60
DISP effective  21
Gaussian sigma  1.2 CSS px
margin          44px
```

配置：`experiments/liquid-glass-winui3-v8-validation/glass-test-window.ini`。

## 验证

`verify_test_window.py` 现在额外锁定：

- 禁止恢复 `Stretch=Fill`；
- 必须使用 no-stretch / pixel snap / nearest-neighbor / reciprocal-DPI mapping；
- Scene capture UV 必须 clamp；
- 禁止恢复深黑 out-of-bounds sentinel；
- Reference / Long Bar 在 100/125/150/200% DPI 下物理像素 round-trip 保持 1:1。

沙盒数学契约已通过：两种 host 的 optical margin 均为 44px，常见 DPI 下 reciprocal mapping 不改变最终物理像素计数。

当前环境不是 Windows/WinUI 3 build host，因此**未声明 Windows 编译或视觉 PASS**。

## Windows 下一步

重新构建并重点观察：

1. 窗口静止 30 秒是否还有周期性黑闪；
2. 拖动系统标题栏移动窗口时是否还有黑块闪入玻璃；
3. 把窗口移到显示器四边，观察 edge clamp；
4. 在 100% 和非 100% DPI 各测一次；
5. 若静止完全稳定、只有拖动/resize 仍有轻微空白或不同步，再单独处理 WinUI 3 / DWM move-resize 同步层，不再改 shader。
