# STATUS — Liquid Glass Test Window

- 更新日期: 2026-08-16
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `7a69da81`（dual-sample test window 当前真实 HEAD；本提交仅同步状态元数据）

## 当前分支

`agent/liquid-glass-test-window`

## 当前状态

已从封板 V9 `45bc51a6` 重新开干净分支，放弃此前 `agent/shijian-native-rebuild` 上的复杂诊断壳、F3/F4、frost mix 和 reference harness 迭代。

当前只保留一个简单原生 Windows 测试窗口，用于同时观察两个实时 Liquid Glass 样本。

## 窗口范围

- 普通 Windows 系统标题栏，直接拖动标题栏移动窗口。
- 不做自绘透明顶栏，不做 Region 裁剪，不做产品 UI。
- 内容区只放两个样本：
  1. **V9 Reference**：274×148 host，中心 186×60 `Generate + Zap`。
  2. **Long Bar**：336×124 host，中心 248×36 长条。
- 两个样本同时使用实时桌面 WGC 背景，便于同一时间、同一桌面直接比较。

## Renderer 变化

没有复制第二套 renderer，也没有新增材质算法。`LiquidGlassRenderer` 只增加一个很小的 `GlassProfileId` 输入：

- `Reference`
- `LongBar`

两个实例复用同一 V9 WGC / D3D11 / D2D / Composition / HLSL / recovery 实现。

### Reference profile

```text
lens            186×60
host            274×148
map             186×60
optical scale   1.00
DISP_SCALE      35
Gaussian sigma  2 CSS px
margin          44px
```

该 profile 保持 V9 成功实验的光学参数和 `Generate + Zap` 交互样本。

### Long Bar profile

```text
lens            248×36
host            336×124
map             248×36
optical scale   0.60
DISP effective  21
Gaussian sigma  1.2 CSS px
margin          44px
```

Long Bar 只改变几何、displacement map 尺寸与空间光学 scale；V9 shader 配方不新增/替换算法。

## 配置

profile 参数位于：

`experiments/liquid-glass-winui3-v8-validation/glass-test-window.ini`

源码数值仅作为配置缺失时 fallback。

## V9 稳定性边界

保持：

- WGC monitor capture；
- D3D11 / D2D / Microsoft.UI.Composition；
- render thread；
- captureGate / display-affinity fail-closed API；
- GraphicsCaptureItem.Closed / ContentSize / drain / WM_DISPLAYCHANGE recovery；
- bounded 3-attempt recovery；
- device removal 显式 `thread=DEAD` 边界。

`LiquidGlassRenderer.part04.inc` 未修改；V9 capture session 主路径保持封板代码。`SetScreenshotMode` API 也仍保留。

当前双 renderer 测试窗口**不绑定 F2**：两个独立 renderer 共用一个顶层 HWND 时，若要重新开放 screenshot mode，需要先做共享 affinity/freeze coordinator。当前任务不需要该功能，因此不为测试窗口新增协调层。

## 明确不做

- 不做 F3/F4。
- 不做 frostAmount 调节。
- 不做 9-slice。
- 不改 radial / inset / rim / white veil。
- 不接入 Tauri/WebView/拾笺业务。
- 不继续之前的复杂诊断界面。

## 验证

新增 `verify_test_window.py`，会先链式执行 V7→V8→V9 静态契约，再检查：

- 普通系统标题栏未被移除；
- 274×148 / 186×60 V9 样本存在；
- 336×124 / 248×36 Long Bar 存在；
- 两个 renderer profile 实例；
- profile 外置配置；
- V9 shader 配方仍在；
- 无 F3/F4/frost mix；
- 两个 renderer 都处理 `WM_DISPLAYCHANGE` refresh；
- 两种样本都保持 44px optical margin。

当前环境不是 Windows/WinUI 3 build host，因此**未声明 Windows 编译或视觉 PASS**。下一步只需在 Windows 上运行静态脚本、构建并启动窗口，确认两个样本同时显示且可通过系统标题栏拖动窗口。
