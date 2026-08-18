# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `28839cb1`（Crystal / Thin Acrylic / Acrylic / Blur 四态实验已实现；本提交仅同步交接状态）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

已从 `main@b442e56d` 新开独立 Tauri 2 Windows 材质实验分支。根据 Windows 真机反馈，上一版 Acrylic / Blur 都明显不如 Transparent 通透，因此当前实验把 **Crystal（clearEffects）提升为默认主材质**，系统 Acrylic / Blur 改为对照组。

当前四种模式：

1. Crystal
2. Thin Acrylic
3. Acrylic
4. Blur

本分支不接入 WGC / D3D11 Liquid Glass renderer，也不运行拾笺产品的 Region / 托盘 / 全局快捷键 / 草稿 watcher。

## 当前窗口

- 520×360 logical px
- 单窗口、单 WebView
- `transparent: true`
- `decorations: false`
- `resizable: false`
- `shadow: false`
- `backgroundColor: #00000000`
- `noRedirectionBitmap: true`
- 顶部 `data-tauri-drag-region` 可拖动窗口

## 四态配方

### 1 — Crystal（默认）

- `clearEffects()`
- 无系统 Acrylic / Blur
- 外层约 3% 蓝色 tint
- 内层约 4.5% 浅蓝白 tint
- 1px 白色亮边 + inset top highlight + 低强度 radial sheen
- 外层和内层都显式 `backdrop-filter: none`
- 不再使用上一版 `blur(14px)`

目标：桌面保持清晰透过，用边缘和光泽而不是 blur 制造“水晶玻璃”厚度。

### 2 — Thin Acrylic

- `setEffects({ effects: ['acrylic'], color: [92, 170, 226, 12] })`
- tint alpha 从标准对照的 78 降到 12

目标：验证系统 Acrylic 本身的 blur 是否仍然过重，以及极低 tint 是否能接近 Crystal 的通透度。

### 3 — Acrylic

- `setEffects({ effects: ['acrylic'], color: [92, 170, 226, 78] })`
- 保留上一版配方作为磨砂玻璃对照

### 4 — Blur

- `setEffects({ effects: ['blur'], color: [92, 170, 226, 78] })`
- 与 Acrylic 使用相同 tint，比较系统 Blur 行为

## 切换

点击按钮，或按：

- `1` Crystal
- `2` Thin Acrylic
- `3` Acrylic
- `4` Blur

`main.js` 已改成读取每个模式自己的 `color`；Crystal 的 `effect === null` 时继续调用 `clearEffects()`。

## 已验证

- GitHub code commit：`28839cb1` / `feat: add crystal glass comparison modes`。
- GitHub readback：`initialMode = crystal`。
- GitHub readback：Thin Acrylic color = `[92, 170, 226, 12]`。
- GitHub readback：Acrylic / Blur color = `[92, 170, 226, 78]`。
- 四态 UI、1~4 快捷键、逐模式 color 与 Crystal 无 14px blur 已写入 `verify_tauri_glass_test.py` 静态契约。
- Tauri 520×360 透明窗口配置、capability 与最小 Rust Builder 本轮未修改。

Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此没有声明 Windows 编译或四态真机视觉 PASS。

## 真机判断顺序

固定同一桌面背景，先比较 `1 Crystal` 与 `2 Thin Acrylic`：

- 背景文字/图标清晰程度；
- 拖动窗口时背景跟随是否稳定；
- 是否闪黑/闪白；
- 亮边和 sheen 是否足以产生玻璃感；
- 如果 Crystal 已经足够漂亮且明显更稳，后续拾笺优先围绕 Crystal 做产品 UI，而不是继续增加底层图形管线。
