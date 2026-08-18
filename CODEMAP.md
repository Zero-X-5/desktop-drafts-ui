# CODEMAP — Tauri Glass Effects Test

## 当前分支

`agent/tauri-glass-effects-test`

这是从 `main@b442e56d` 新开的独立 Tauri 2 Windows 材质实验分支。当前目标是拆开比较四层来源：

1. WebView2 / Tauri 透明窗口本身；
2. CSS 边缘、tint、backdrop blur；
3. Windows Acrylic / Blur 系统 backdrop；
4. “统一系统 backdrop + 局部更厚表面层”的参考图式分区材质。

不承载草稿业务，也不运行 Native Liquid Glass renderer。

## 结构

```text
src/
├── index.html                  10 态透明度/分区材质 UI + 自定义拖动区
├── main.js                     window effect 切换 + cssProfile/tint 诊断
├── styles.css                  Pure / Edge / Tint / Frost / Split 五套 CSS profile
└── glass-test-config.json      10 个模式、逐模式 effect/color/cssProfile、0~9 快捷键

src-tauri/
├── tauri.conf.json             620×430 透明测试窗口
├── capabilities/default.json   set-effects / drag / close 权限
└── src/lib.rs                  最小 Tauri Builder，不启动产品 Region/托盘/快捷键/watcher

verify_tauri_glass_test.py       10 态静态契约
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

## 1–8 基础梯度

### 1. Pure

```text
clearEffects()
cssProfile = pure
```

几乎不画大面积背景，只保留必要内容和极弱控件底。它是真实透明基准。

### 2. Edge Glass

```text
clearEffects()
cssProfile = edge
```

不铺大面积 tint，只加 1px 亮边、inset highlight 和轻微 sheen。

### 3. Tint Glass

```text
clearEffects()
cssProfile = tint
```

在 Edge 基础上增加很薄的蓝白 tint。

### 4. CSS Frost

```text
clearEffects()
cssProfile = frost
backdrop-filter: blur(4px)
```

验证 WebView2 CSS `backdrop-filter` 是否能实际影响桌面背景。

### 5. Acrylic α0

```text
setEffects({
  effects: ["acrylic"],
  color: [92, 170, 226, 0]
})
cssProfile = edge
```

若 tint alpha 已为 0 仍明显模糊/不透，说明主要来源是 Acrylic 自身的 blur/luminosity，而不是 tint。

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

与 Acrylic α0 比较系统 Blur 与 Acrylic 的差异。

## 9 / 0 参考图式 Split 实验

两档都使用同一个 `cssProfile = split`。Split profile 不改变左侧 Edge Glass 基线，而是在右侧叠加一个带软 mask 的局部层：

```text
left ~ clear edge glass
        ↓ smooth transition
right local layer
  ├─ backdrop-filter: blur(14px)
  ├─ saturate(1.12)
  ├─ brightness(1.055)
  ├─ warm-white luminosity/tint gradient
  └─ mask gradient: transparent → full
```

`material-card` 内部右侧还额外叠一层 8px 局部 frost，使大色块保留而高频细节更快消失。

### 9. Split Acrylic

```text
setEffects({
  effects: ["acrylic"],
  color: [92, 170, 226, 0]
})
cssProfile = split
```

用途：模拟参考图“左边仍通透、右边更磨砂”的材质层次。底层统一使用 Acrylic α0，右侧磨砂增强由局部 CSS surface 完成。

### 0. Split Clear

```text
clearEffects()
cssProfile = split
```

与 Split Acrylic 使用完全相同的 CSS。二者只差底层有没有 Windows Acrylic，因此可以直接判断参考图式效果到底依赖系统 Acrylic 多少。

## CSS profile 隔离原则

```text
pure  → 几乎无面层
edge  → 只画边与高光
tint  → edge + 极薄面色
frost → tint + 4px CSS backdrop blur
split → edge + 右侧 14px 局部 frost/luminosity 渐变
```

Acrylic α0 / α12 / α78 / Blur α0 仍全部复用 `edge`，不会被 Split profile 污染。

## 前端切换

`main.js`：

- `effect === null` → `clearEffects()`；
- 有 system effect → `setEffects()`；
- 每个模式从 JSON 读取自己的 `color`；
- `document.documentElement.dataset.profile` 驱动 CSS profile；
- UI 同时显示 CSS profile 和 tint alpha。

快捷键 `1` 到 `9` 对应前九个模式，`0` 对应 Split Clear。

## Native Desktop Acrylic Thin 边界

微软 Windows App SDK 的真正 `DesktopAcrylicKind::Thin` 属于 `DesktopAcrylicController`，还需要 Windows App SDK runtime/bootstrap、DispatcherQueue、Composition target，并非 Tauri 当前 `setEffects()` 的一个隐藏参数。当前分支没有为了单次视觉实验引入这一整套运行时。

因此本轮先验证“系统 Acrylic α0 + 局部 surface 分层”是否已经能接近参考图。如果 9 明显优于 0 且仍不够通透，再单独开 Native Thin bridge 阶段。

## 验证

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

静态契约检查窗口配置、10 个模式、Acrylic α0/12/78、Blur α0、五套 CSS profile、Split Acrylic/Split Clear 隔离，并继续禁止 WGC / D3D11 / window_region 回流到实验路径。最终透明度和系统 backdrop 行为必须在 Windows 真机验证。
