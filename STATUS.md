# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应基线 HEAD: `b442e56d`（从 main 新开独立实验分支；本提交仅建立测试范围 checkpoint）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前目标

建立一个最小 Tauri 2 Windows 玻璃效果测试窗口，只比较三种系统/窗口效果：

1. Acrylic
2. Blur
3. 普通透明（clearEffects）

本分支不承载拾笺草稿业务验证，也不接入此前 WGC / D3D11 Liquid Glass renderer。

## 范围

- 保持 Tauri 2 + 单窗口 + 单 WebView。
- 透明、无装饰、不可调整大小的测试窗口。
- 自定义顶部拖动区域用于移动窗口。
- 三个模式按钮运行时调用 Tauri window effect API。
- 普通透明模式调用 `clearEffects()`，用于与 Acrylic / Blur 做直接对照。
- 页面显示当前模式、调用成功/失败状态和 Windows 兼容提示。
- 不使用主线固定 720×480 + SetWindowRgn 状态机；该结构仅在 main 产品分支继续保留。

## 官方 API 依据

Tauri 2 `Window.setEffects()` / `Window.clearEffects()` 用于运行时设置和清除窗口效果；`Acrylic` 支持 Windows 10/11，`Blur` 支持 Windows 7/10/部分 Windows 11。窗口 effect 要求透明窗口。

本实验使用仓库已有 `app.withGlobalTauri: true`，前端直接通过 `window.__TAURI__.window.getCurrentWindow()` 调用，无需新增前端 bundler。

## 验证计划

- 静态检查三态按钮和 API 调用存在。
- 静态检查 capability 包含 `core:window:allow-set-effects`。
- 静态检查透明窗口配置且没有产品 Region 启动裁剪。
- 当前执行环境不是 Windows Tauri build host，因此最终拖动性能和 Acrylic/Blur 视觉效果必须在 Windows 真机确认。
