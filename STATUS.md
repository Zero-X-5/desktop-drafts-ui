# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `1977492e`（8 态透明度梯度实验已实现；本提交仅同步交接状态）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

当前实验已经从 4 态扩展为 **8 态透明度梯度**，目的不是继续猜 Acrylic 参数，而是把透明度来源拆开测试：

1. Tauri/WebView2 纯透明；
2. CSS 边缘/面色/轻 blur；
3. Windows Acrylic / Blur 系统 backdrop。

本分支不接入 WGC / D3D11 Liquid Glass renderer，也不运行拾笺产品的 Region / 托盘 / 全局快捷键 / 草稿 watcher。

## 当前窗口

- 620×430 logical px
- 单窗口、单 WebView
- `transparent: true`
- `decorations: false`
- `resizable: false`
- `shadow: false`
- `backgroundColor: #00000000`
- `noRedirectionBitmap: true`
- 顶部 `data-tauri-drag-region` 可拖动窗口

## 8 态实验

### 1 — Pure

- `clearEffects()`
- CSS profile = `pure`
- 大面积背景几乎完全透明

用途：真实透明基准。

### 2 — Edge Glass

- `clearEffects()`
- CSS profile = `edge`
- 只增加边框、inset highlight、很轻的 sheen
- 不铺大面积 tint

用途：测试“只画边”能否产生玻璃感。

### 3 — Tint Glass

- `clearEffects()`
- CSS profile = `tint`
- Edge + 极薄蓝白 tint

用途：观察面色对通透度的影响。

### 4 — CSS Frost

- `clearEffects()`
- CSS profile = `frost`
- `backdrop-filter: blur(4px)`

用途：验证 WebView2 CSS backdrop blur 是否能实际作用于桌面背景；这是实验项，不预设它一定有效。

### 5 — Acrylic α0

- `setEffects({ effects: ['acrylic'], color: [92,170,226,0] })`
- CSS profile = `edge`

关键判断：如果 alpha 已经是 0 仍明显模糊/不透，那么主要来源是 Acrylic 自身的 blur/luminosity，而不是 tint。

### 6 — Acrylic α12

- 同上，tint alpha = 12

### 7 — Acrylic α78

- 同上，tint alpha = 78
- 保留之前的标准磨砂对照

### 8 — Blur α0

- `setEffects({ effects: ['blur'], color: [92,170,226,0] })`
- CSS profile = `edge`

用途：和 Acrylic α0 直接比较系统 Blur 与 Acrylic 的差异。

## 隔离原则

Acrylic α0 / α12 / α78 / Blur α0 全部复用同一个 `edge` CSS profile，不使用 Tint/Frost 面层。因此这四档之间额外的模糊和不透明度主要来自 Windows effect 本身。

`main.js` 会同时显示：

- 当前模式
- Tauri API 状态
- CSS profile
- Tint alpha

快捷键 `1` 到 `8` 对应上述 8 个模式。

## 已验证

- GitHub readback：8 个模式和 1~8 快捷键已落库。
- GitHub readback：Acrylic tint alpha = 0 / 12 / 78 三档已落库。
- GitHub readback：Blur α0 已落库。
- GitHub readback：系统 effect 模式全部使用 `cssProfile = edge`。
- GitHub readback：窗口为 620×430、透明、`noRedirectionBitmap=true`。
- `verify_tauri_glass_test.py` 已扩展为 8 态静态契约。
- Rust 最小启动层、capability、WGC/D3D 禁止项未改变。

Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此没有声明 Windows 编译或 8 态真机视觉 PASS。

## 真机判断顺序

优先按这个顺序比较：

```text
1 Pure
2 Edge Glass
3 Tint Glass
4 CSS Frost
5 Acrylic α0
6 Acrylic α12
7 Acrylic α78
8 Blur α0
```

尤其重点看 `5 Acrylic α0`：如果它与 `1~3` 相比仍然明显发白、发糊或不透，就基本可以确认系统 Acrylic 本身不适合当前追求的 clear-glass 产品方向。
