# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应 HEAD commit: `745fc774`（蓝白分层玻璃三态版本；本提交先同步真实分支 HEAD，再开始 Crystal / Thin Acrylic 四态实验）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

已从 `main@b442e56d` 新开独立实验分支，当前是最小 Tauri 2 Windows 玻璃效果测试窗口。

现有版本比较 Acrylic / Blur / Transparent，并共用一套蓝白高透明玻璃 UI。用户真机反馈：Acrylic 与 Blur 不够透，而 Transparent 明显更清透。

本轮目标因此调整为验证“透明水晶玻璃”是否更适合作为拾笺主材质：

1. Crystal / Transparent（默认）
2. Thin Acrylic（极低 tint）
3. Acrylic（现有 tint）
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
- 顶部自定义 `data-tauri-drag-region` 可直接拖动窗口

## 本轮执行范围

- Crystal 继续使用 `clearEffects()`，但作为默认主材质。
- Crystal 专属 CSS 降低 tint / surface opacity，并取消内层 14px backdrop blur，让桌面背景尽量清晰透过。
- Thin Acrylic 使用 Acrylic 系统效果，但 tint alpha 明显降低，用于判断“轻系统 blur + 极薄 tint”是否能兼顾透明度与稳定性。
- Acrylic 与 Blur 保留作为对照，不改变最小 Rust 启动层和窗口配置。
- 快捷键改为 1 / 2 / 3 / 4。
- 所有运行时视觉参数继续放在 `src/glass-test-config.json` 或 CSS，不引入 WebGL / SVG displacement / WGC / D3D11。

## 验证

Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此最终系统 backdrop 与拖动表现必须在 Windows 真机确认。
