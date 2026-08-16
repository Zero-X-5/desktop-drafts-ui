# STATUS — Liquid Glass Test Window

- 更新日期: 2026-08-16
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `45bc51a6`（V9 recovery 封板基线；本提交仅重置分支与范围）

## 当前分支

`agent/liquid-glass-test-window`

## 基线

本分支从 `agent/liquid-glass-v9-recovery` 当前 HEAD `45bc51a6` 创建。V9 renderer 的 WGC / D3D11 / D2D / Microsoft.UI.Composition、F2 captureGate、display-affinity fail-closed、capture-session recovery、device-removal 诊断均保持封板状态。

## 当前唯一目标

做一个简单的原生 Windows 测试窗口，只包含：

1. 可拖动的普通窗口顶栏；
2. V9 已验证原版样本：274×148 host，中心 186×60 `Generate + Zap`；
3. 一个 248×36 长条样本，用同一 V9 renderer 配方，仅通过小型 profile 改几何/光学尺度；
4. 两个样本同时实时显示，便于同背景直接比较。

## 严格范围

- 不做 F3/F4 诊断 UI。
- 不做新的 frost mix、9-slice、radial/rim 算法或材质调参。
- 不改 WGC capture/recovery/F2/device-loss 状态机。
- 不接入 Tauri/WebView/旧拾笺业务。
- 不追求产品 UI；测试窗口只要求清楚、稳定、可拖动。

## 实现原则

- V9 profile 必须保持原参数：lens 186×60、displacement map 186×60、displacement 35、Gaussian sigma 2、optical scale 1.0。
- Long Bar profile：lens 248×36、displacement map 248×36、optical scale 0.60；其余 V9 shader 配方不新增算法。
- 两个 renderer 实例复用同一个 `LiquidGlassRenderer` 类；只新增极小 profile/config 输入，不复制 renderer 源码。
- profile 参数写入实验配置文件，不只存在源码常量。

## 验证

当前环境不是 Windows/WinUI 3 build host。完成代码后执行静态 V7→V8→V9 回归与新 test-window contract；最终编译/视觉验证仍需 Windows 真机。
