# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `073a164e`（Acrylic / Blur / Transparent 三态测试窗口已实现；本提交仅同步交接状态）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

已从 `main@b442e56d` 新开独立实验分支，完成一个最小 Tauri 2 Windows 玻璃效果测试窗口。

该分支只用于比较：

1. Acrylic
2. Blur
3. 普通透明（`clearEffects()`）

不接入此前 WGC / D3D11 Liquid Glass renderer，也不运行拾笺产品的 Region / 托盘 / 全局快捷键 / 草稿 watcher。

## 当前窗口

- 520×360 logical px
- 单窗口、单 WebView
- `transparent: true`
- `decorations: false`
- `resizable: false`
- `shadow: false`
- `backgroundColor: #00000000`
- `noRedirectionBitmap: true`
- 顶部自定义 `data-tauri-drag-region` 可直接拖动窗口

## 三态切换

前端使用仓库已有的 `app.withGlobalTauri: true`，直接从 `window.__TAURI__.window` 获取当前窗口。

- Acrylic：`setEffects({ effects: ['acrylic'], color })`
- Blur：`setEffects({ effects: ['blur'], color })`
- Transparent：`clearEffects()`

三种模式可点击按钮切换，也可使用：

- `1` Acrylic
- `2` Blur
- `3` Transparent

当前初始模式为 Acrylic。

## 参数

`src/glass-test-config.json` 保存：

- 初始模式
- Acrylic / Blur 共用 tint `[24, 26, 32, 92]`
- 快捷键映射
- 模式说明

## 权限

`src-tauri/capabilities/default.json` 只为该测试保留必要 window 权限：

- `core:window:allow-set-effects`
- `core:window:allow-start-dragging`
- `core:window:allow-close`

## 官方 API 依据

Tauri 2 当前提供 `Window.setEffects()` 与 `Window.clearEffects()`；Acrylic 支持 Windows 10/11，Blur 支持 Windows 7/10/部分 Windows 11。窗口 effect 要求透明窗口。Tauri 官方同时提示 Acrylic 在部分 Win10/Win11 版本拖动/resize 性能可能较差，因此本窗口就是用来做真机对照。

`noRedirectionBitmap` 按 Tauri 官方说明启用，用于降低透明窗口创建时出现白闪的概率。

## 验证

已完成：

- GitHub readback：三态 JS API 调用已落库。
- GitHub readback：520×360 / transparent / noRedirectionBitmap 配置已落库。
- GitHub readback：`allow-set-effects` capability 已落库。
- GitHub readback：Rust 启动层已缩成最小 Builder，不再调用 `window_region`。
- 分支 diff 检查：改动限定在本实验 UI、Tauri window config/capability、最小启动层、CODEMAP/STATUS 与静态验证脚本。

新增 `verify_tauri_glass_test.py`，Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此没有声明 Windows 编译或 Acrylic/Blur 真机视觉 PASS。

## Windows 真机观察重点

固定同一桌面背景，分别切到 1 / 2 / 3，重点观察：

- 静止时是否稳定、是否闪黑/闪白；
- 抓住顶部连续拖动 10~20 秒时的流畅度；
- Acrylic 和 Blur 的背景模糊强度及延迟；
- Transparent 作为无系统 blur 的性能基准。
