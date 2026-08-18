# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应 HEAD commit: `813b9914`（Crystal / Thin Acrylic / Acrylic / Blur 四态版本；本提交仅同步真实远端 HEAD，随后扩展透明度梯度实验）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

已从 `main@b442e56d` 新开独立 Tauri 2 Windows 材质实验分支。根据 Windows 真机反馈，Acrylic / Blur 明显不如 Transparent 通透；当前分支用于拆开验证“WebView 透明层本身、CSS 玻璃层、系统 Acrylic/Blur”各自对透明度的影响。

现有四种模式：

1. Crystal
2. Thin Acrylic
3. Acrylic
4. Blur

本轮将扩展为更细的透明度梯度实验，重点确认 Acrylic 的系统 blur / luminosity 是否是主要不透明来源，以及纯透明路径可以保留多少玻璃视觉。

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

## 本轮目标

扩展成一组从完全清透到系统磨砂的对照模式：

- Pure：`clearEffects()` + 完全透明 CSS 面，只保留必要文字/控件。
- Edge：`clearEffects()` + 仅边缘高光，无大面积 tint。
- Tint：`clearEffects()` + 极薄蓝白 tint。
- Frost：`clearEffects()` + 轻微 CSS backdrop blur，用来验证 WebView CSS 是否能影响桌面背景。
- Acrylic α0：系统 Acrylic，color alpha = 0。
- Acrylic α12：系统 Acrylic，color alpha = 12。
- Acrylic α78：现有标准 Acrylic 对照。
- Blur：系统 Blur 对照。

实验只修改前端测试 UI、配置、必要窗口尺寸和静态契约；不改变最小 Rust 启动层，不引入新的图形管线。

## 验证

Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此最终透明度、系统 backdrop 与拖动表现必须在 Windows 真机确认。
