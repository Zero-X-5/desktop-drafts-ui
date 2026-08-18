# CODEMAP — Tauri Glass Effects Test

## 当前分支

`agent/tauri-glass-effects-test`

这是从 `main@b442e56d` 新开的独立 Tauri 2 Windows 材质实验分支。当前目标是拆开比较三层来源：

1. WebView2 / Tauri 透明窗口本身；
2. CSS 边缘、tint、backdrop blur；
3. Windows Acrylic / Blur 系统 backdrop。

不承载草稿业务，也不运行 Native Liquid Glass renderer。

## 结构

```text
src/
├── index.html                  8 态透明度梯度 UI + 自定义拖动区
├── main.js                     window effect 切换 + cssProfile/tint 诊断
├── styles.css                  Pure / Edge / Tint / Frost 四套 CSS profile
└── glass-test-config.json      8 个模式、逐模式 effect/color/cssProfile、1~8 快捷键

src-tauri/
├── tauri.conf.json             620×430 透明测试窗口
├── capabilities/default.json   set-effects / drag / close 权限
└── src/lib.rs                  最小 Tauri Builder，不启动产品 Region/托盘/快捷键/watcher

verify_tauri_glass_test.py       8 态静态契约
```

## 窗口

- 单窗口、单 WebView。
- 620×430 logical px。
- `transparent: true`。
- `decorations: false`。
- `resizable: false`。
- `shadow: false`。
- `noRedirectionBitmap: true`。
- 顶部 `data-tauri-drag-region` 负责拖动。
- 不使用主线 `window_region.rs` / `SetWindowRgn`。

## 8 种模式

### 1. Pure

```text
clearEffects()
cssProfile = pure
```

几乎不画大面积背景，只保留必要的内容和极弱控件底。它是“真正透明”的基准。

### 2. Edge Glass

```text
clearEffects()
cssProfile = edge
```

不铺大面积 tint，只加 1px 亮边、inset highlight 和非常轻的 sheen。用于判断“只画边”是否已经足够产生玻璃感。

### 3. Tint Glass

```text
clearEffects()
cssProfile = tint
```

在 Edge 基础上增加很薄的蓝白 tint，观察透明度开始明显下降的程度。

### 4. CSS Frost

```text
clearEffects()
cssProfile = frost
backdrop-filter: blur(4px)
```

用来验证 WebView2 的 CSS `backdrop-filter` 是否真的能影响桌面背景。这个模式是实验项，不假定一定能工作。

### 5. Acrylic α0

```text
setEffects({
  effects: ["acrylic"],
  color: [92, 170, 226, 0]
})
cssProfile = edge
```

关键诊断项。若 tint alpha 已为 0 仍明显模糊/不透，说明主要来源是 Acrylic 本身的 blur/luminosity 合成，而不是 tint。

### 6. Acrylic α12

与 α0 相同，但 tint alpha = 12。

### 7. Acrylic α78

之前使用的标准 Acrylic 对照，tint alpha = 78。

### 8. Blur α0

```text
setEffects({
  effects: ["blur"],
  color: [92, 170, 226, 0]
})
cssProfile = edge
```

用来和 Acrylic α0 比较系统 Blur 与 Acrylic 自身的差异。

## CSS profile 隔离原则

系统 Acrylic / Blur 四个模式全部复用 `cssProfile = edge`，不额外铺 Tint/Frost 面层。这样真机看到的额外不透明度主要来自 Windows effect 本身，而不是 CSS。

```text
pure  → 几乎无面层
edge  → 只画边与高光
tint  → edge + 极薄面色
frost → tint + 4px CSS backdrop blur
```

## 前端切换

`main.js`：

- `effect === null` → `clearEffects()`；
- 有 system effect → `setEffects()`；
- 每个模式从 JSON 读取自己的 `color`；
- `document.documentElement.dataset.profile` 驱动 CSS profile；
- UI 同时显示 CSS profile 和 tint alpha。

快捷键 `1` 到 `8` 与 8 个模式一一对应。

## 验证

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

静态契约检查窗口配置、8 个模式、Acrylic α0/12/78、Blur α0、四套 CSS profile，并继续禁止 WGC / D3D11 / window_region 回流到实验路径。最终透明度和系统 backdrop 行为必须在 Windows 真机验证。
