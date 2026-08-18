# CODEMAP — Tauri Glass Effects Test

## 当前分支

`agent/tauri-glass-effects-test`

这是从 `main@b442e56d` 新开的独立 Tauri 2 Windows 材质实验分支。当前重点不是复刻 Native Liquid Glass，而是比较“清透 Crystal”与系统 Acrylic / Blur 在真实 Windows 机器上的透明度、拖动稳定性和视觉层次。

## 结构

```text
src/
├── index.html                  四态测试 UI + 清透玻璃结构 + 自定义拖动区
├── main.js                     Tauri window effect 切换逻辑；每个模式读取独立 color
├── styles.css                  Crystal 默认视觉：极薄 tint、亮边、sheen、无 CSS backdrop blur
└── glass-test-config.json      初始模式 / 各模式 effect + color / 1~4 快捷键

src-tauri/
├── tauri.conf.json             520×360 透明测试窗口
├── capabilities/default.json   set-effects / drag / close 权限
└── src/lib.rs                  最小 Tauri Builder，不启动产品 Region/托盘/快捷键/watcher

verify_tauri_glass_test.py       四态与 Crystal 清透材质静态契约
```

## 窗口

- 单窗口、单 WebView。
- 520×360 logical px。
- `transparent: true`。
- `decorations: false`。
- `resizable: false`。
- `shadow: false`。
- `noRedirectionBitmap: true`。
- 顶部 `data-tauri-drag-region` 负责拖动。
- 不使用主线 `window_region.rs` / `SetWindowRgn`，避免裁剪干扰系统 backdrop 对比。

## 四种模式

### 1. Crystal

```text
appWindow.clearEffects()
```

- 当前默认模式。
- 不启用系统 Acrylic / Blur。
- CSS 外壳和内层 card 都显式 `backdrop-filter: none`。
- 只用很低 alpha 的蓝白 tint、1px 高亮边、inset highlight、radial sheen 模拟玻璃厚度。
- 目标是保留桌面图像的清晰透过和最简单的合成路径。

### 2. Thin Acrylic

```text
appWindow.setEffects({
  effects: ["acrylic"],
  color: [92, 170, 226, 12]
})
```

系统 Acrylic 仍然存在，但 tint alpha 从标准对照的 78 降到 12。用于判断系统 blur 本体是否仍然过重，以及低 tint 是否能接近 Crystal 的通透感。

### 3. Acrylic

```text
appWindow.setEffects({
  effects: ["acrylic"],
  color: [92, 170, 226, 78]
})
```

保留上一版磨砂感明显的 Acrylic 配方作为对照。

### 4. Blur

```text
appWindow.setEffects({
  effects: ["blur"],
  color: [92, 170, 226, 78]
})
```

Windows 系统 Blur，对比 Acrylic 和 Crystal 的透明度与拖动表现。

## 前端切换

`main.js` 不再使用单一全局 `effectColor`。每个模式从 `glass-test-config.json` 读取自己的 `color`；`effect === null` 时直接 `clearEffects()`，否则把该模式的 `color` 传给 `setEffects()`。

快捷键：

- `1` Crystal
- `2` Thin Acrylic
- `3` Acrylic
- `4` Blur

## Crystal 视觉层

```text
Windows desktop
      ↓
transparent Tauri/WebView2 window
      ↓
Crystal shell
  ├─ ~3% 蓝色底
  ├─ 1px 白色亮边
  ├─ inset top highlight
  ├─ 两块低强度 radial sheen
  └─ backdrop-filter: none
      ↓
material-card
  ├─ ~4.5% 浅蓝白底
  ├─ 半透明亮边
  ├─ 微弱 inner highlight
  └─ backdrop-filter: none
```

Crystal 不把 CSS blur 当成玻璃核心。Acrylic / Blur 模式继续使用同一套清透 CSS，因此四态差异主要来自系统 window effect 本身，便于真机比较。

## 验证

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

静态契约检查四态模式、逐模式 tint、透明窗口配置、Crystal 无 `blur(14px)`，并继续禁止 WGC / D3D11 / window_region 回流到实验路径。最终透明度、拖动帧率与系统效果仍必须在 Windows 真机验证。
