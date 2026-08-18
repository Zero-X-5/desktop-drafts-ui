# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `17aaba68`（Acrylic / Blur / Transparent 三态 + 蓝白分层玻璃视觉已实现；本提交仅同步交接状态）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

已从 `main@b442e56d` 新开独立实验分支，完成一个最小 Tauri 2 Windows 玻璃效果测试窗口。

当前比较三种模式：

1. Acrylic
2. Blur
3. 普通透明（`clearEffects()`）

同时在三种模式上共用一套参考用户图片提炼出的蓝白高透明玻璃 UI，用于判断“系统 backdrop + CSS 精修”是否足够接近目标质感。

本分支不接入此前 WGC / D3D11 Liquid Glass renderer，也不运行拾笺产品的 Region / 托盘 / 全局快捷键 / 草稿 watcher。

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

- Acrylic：`setEffects({ effects: ['acrylic'], color })`
- Blur：`setEffects({ effects: ['blur'], color })`
- Transparent：`clearEffects()`

点击按钮或按键：

- `1` Acrylic
- `2` Blur
- `3` Transparent

初始模式为 Acrylic。

## 当前视觉配方

`src/glass-test-config.json`：

- Acrylic / Blur 共用 tint `[92, 170, 226, 78]`

`src/styles.css`：

- 外层 28px 大圆角系统玻璃壳
- 蓝白 radial / linear 光泽
- 高亮外边线与 inset highlight
- 右上和左侧柔和 sheen
- 内层浅蓝白 `material-card`
- 内层 `backdrop-filter: blur(14px)` + saturate / brightness
- 内层高亮边框、内阴影和轻微深度

没有加入 WebGL、SVG displacement、WGC 或 D3D11；背景真实模糊仍由 Acrylic / Blur 系统效果承担。

## 权限与启动层

`src-tauri/capabilities/default.json` 只保留必要窗口权限：

- `core:window:allow-set-effects`
- `core:window:allow-start-dragging`
- `core:window:allow-close`

Rust 启动层保持最小 `tauri::Builder`，没有恢复产品 Region 或其他业务插件。

## 已验证

- GitHub diff：本轮视觉修改只涉及 `src/index.html`、`src/styles.css`、`src/glass-test-config.json`、`verify_tauri_glass_test.py`。
- `main.js` 三态 API 逻辑未改。
- Tauri 窗口配置与最小 Rust 启动层未改。
- 静态契约新增蓝白分层玻璃结构与 tint 检查。

Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此没有声明 Windows 编译或真机视觉 PASS。

## Windows 真机观察重点

固定同一桌面背景，分别切到 1 / 2 / 3：

- Acrylic 是否出现目标图那种高透明蓝白层次；
- Blur 是否更轻、更稳定；
- Transparent 能否接受作为无系统 blur 的降级方案；
- 拖动 10~20 秒是否存在明显掉帧、闪黑、闪白；
- 内层 CSS blur 是否过重，必要时下一轮只调视觉参数，不改架构。
