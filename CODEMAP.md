# CODEMAP — Tauri Glass Effects Test

## 当前分支

`agent/tauri-glass-effects-test`

这是从 `main@b442e56d` 新开的独立 Tauri 2 Windows 材质实验分支。目标仅是比较 Acrylic / Blur / 普通透明三种窗口效果，并验证“系统 backdrop + CSS 厚玻璃视觉”是否足够用于拾笺；不承载草稿业务，也不运行 Native Liquid Glass renderer。

## 结构

```text
src/
├── index.html                  三态测试 UI + 分层玻璃结构 + 自定义拖动区
├── main.js                     Tauri window effect 切换逻辑
├── styles.css                  蓝白 Acrylic 风格、亮边、内高光、内层厚玻璃
└── glass-test-config.json      初始模式 / tint / 快捷键 / 模式说明

src-tauri/
├── tauri.conf.json             520×360 透明测试窗口
├── capabilities/default.json   set-effects / drag / close 权限
└── src/lib.rs                  最小 Tauri Builder，不启动产品 Region/托盘/快捷键/watcher

verify_tauri_glass_test.py       三态与蓝白分层玻璃静态契约
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

## 三种模式

### Acrylic

```text
appWindow.setEffects({
  effects: ["acrylic"],
  color: effectColor
})
```

系统 Acrylic 负责真实桌面模糊；当前 tint 为 `[92, 170, 226, 78]`，向浅蓝高透明玻璃靠拢。

### Blur

```text
appWindow.setEffects({
  effects: ["blur"],
  color: effectColor
})
```

与 Acrylic 使用同一 tint 和同一套 HTML/CSS，只比较 backdrop 实现差异。

### Transparent

```text
appWindow.clearEffects()
```

清除系统 backdrop，只剩 WebView 的半透明 CSS，是性能和视觉基准。

## 当前视觉层

本轮参考用户提供的高透明蓝白玻璃图片，只提取材质语言，不复刻其 Windows 12 文案。

```text
Windows Acrylic / Blur
        ↓
透明 Tauri WebView
        ↓
外层 test-window
  ├─ 大圆角 28px
  ├─ 白色亮边 / inset highlight
  ├─ 蓝白 radial / linear sheen
  └─ saturate + brightness
        ↓
内层 material-card
  ├─ 浅蓝白半透明底
  ├─ 14px CSS backdrop blur
  ├─ 高亮边框
  └─ 内阴影 + 轻微悬浮深度
```

没有加入 WGC、D3D11、WebGL、SVG displacement 或背景像素折射；“厚玻璃”只通过稳定的系统 backdrop 与 CSS 层次模拟。

## 配置

`src/glass-test-config.json` 保存：

- `initialMode`
- `effectColor`
- 1 / 2 / 3 快捷键映射
- 三种模式的 effect 名称和说明

## 验证

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

静态契约同时检查三态 API、透明窗口配置以及蓝白分层玻璃关键结构。最终 Acrylic / Blur 的拖动表现和视觉效果必须在 Windows 真机观察。
