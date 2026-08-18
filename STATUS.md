# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `f268c33e`（10 态透明度梯度 + Split Acrylic / Split Clear 已实现；本提交仅同步交接状态）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

当前实验从 8 态扩展为 **10 态**。前 8 态继续拆分“纯透明 / CSS / Windows Acrylic / Blur”，新增两档专门验证用户参考图那种“左侧更通透、右侧更磨砂”的材质结构。

本分支仍保持：

- 单 Tauri 2 WebView 窗口；
- 不接入 WGC / D3D11 Liquid Glass renderer；
- 不运行拾笺产品的 Region / 托盘 / 全局快捷键 / 草稿 watcher；
- Rust 启动层保持最小 Builder。

## 当前窗口

- 620×430 logical px
- `transparent: true`
- `decorations: false`
- `resizable: false`
- `shadow: false`
- `backgroundColor: #00000000`
- `noRedirectionBitmap: true`
- 顶部 `data-tauri-drag-region` 可拖动窗口

## 1–8 基础梯度

```text
1 Pure          clearEffects / pure
2 Edge Glass    clearEffects / edge
3 Tint Glass    clearEffects / tint
4 CSS Frost     clearEffects / frost 4px
5 Acrylic α0    acrylic alpha 0 / edge
6 Acrylic α12   acrylic alpha 12 / edge
7 Acrylic α78   acrylic alpha 78 / edge
8 Blur α0       blur alpha 0 / edge
```

这 8 档继续用于判断系统 Acrylic 自身的 blur/luminosity 和 tint 分别贡献多少不透明感。

## 9 — Split Acrylic

```text
system effect = Acrylic
color = [92,170,226,0]
cssProfile = split
```

Split profile 的目标直接对应用户参考图：

- 左侧保持接近 Edge Glass，只留边缘高光；
- 从约 22% 窗口宽度开始平滑增强右侧表面；
- 右侧叠 `blur(14px) + saturate(1.12) + brightness(1.055)`；
- 通过 mask 让 blur/tint 从透明逐渐过渡到完整；
- 右侧增加暖白 luminosity/tint，让背景大色块仍透出、细节更磨砂；
- 中间 material card 的右侧再叠 8px 局部 frost。

这不是两套窗口，也不是 WGC。它仍是单 WebView + 单系统 Acrylic backdrop + CSS 局部表面层。

## 0 — Split Clear

```text
clearEffects()
cssProfile = split
```

和 Split Acrylic 使用完全相同的 CSS。唯一变量是底层没有 Windows Acrylic。

因此真机比较 `9` 和 `0` 可以直接回答：

- 如果 9 明显更接近参考图，说明参考图式材质很可能需要 Acrylic 作为统一底层，再通过 UI surface 做局部分层；
- 如果 0 已经足够接近且更通透，说明没必要为产品引入更重的系统 Acrylic；
- 如果 9/0 的右侧局部 blur 都没有作用到桌面背景，则 WebView2 CSS `backdrop-filter` 无法承担这种局部桌面 frost，需要再进入 Native SystemBackdropElement / DesktopAcrylicController 路线。

## Native Thin 调研结论

微软 Windows App SDK 确实有：

```text
DesktopAcrylicKind::Base
DesktopAcrylicKind::Thin
DesktopAcrylicController::TintOpacity
DesktopAcrylicController::LuminosityOpacity
```

其中 Thin 官方定义就是更透明的 Desktop Acrylic。

但真正接入 `DesktopAcrylicController` 到当前 Tauri HWND 不是 `setEffects()` 的一个额外枚举值。官方 Win32 路径还要求 Windows App SDK runtime/bootstrap、DispatcherQueue、Composition target，以及顶层 HWND 的 `DWMWA_USE_HOSTBACKDROPBRUSH`。

因此当前阶段没有为了一个视觉验证把完整 Windows App SDK 宿主塞进 Tauri。先用 9/0 判断参考图结构是否已经能由现有轻量栈实现；只有结果证明不够，再单独做 Native Thin bridge。

## 已验证

- GitHub readback：10 个模式已经写入配置与 UI。
- `9` = Split Acrylic α0 / `cssProfile=split`。
- `0` = Split Clear / `cssProfile=split`。
- 两档使用同一套 Split CSS，系统 Acrylic 是唯一底层差异。
- Split CSS 含右侧 14px masked backdrop blur 和 material-card 8px 局部 frost。
- 原 5/6/7/8 仍全部使用 `cssProfile=edge`，没有被 Split profile 污染。
- `verify_tauri_glass_test.py` 已扩展为 10 态静态契约。
- Tauri 窗口配置、capability 和最小 Rust Builder 本轮未改。

Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此没有声明 Windows 编译或 Split 真机视觉 PASS。

## 真机判断顺序

这轮不需要再从 1 测到 8，先直接比较：

```text
9 Split Acrylic
0 Split Clear
5 Acrylic α0
```

把窗口放在同时有文字、图标和大色块渐变的背景上。重点看左侧文字清晰度、右侧文字消失速度、背景大色块是否仍然保留，以及拖动窗口是否稳定。
