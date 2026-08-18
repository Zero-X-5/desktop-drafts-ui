# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应 HEAD commit: `5b2cc52a`（Native Acrylic / Blur child-HWND plate 已实现；本提交仅同步最终交接状态）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

已从“整窗 Acrylic + CSS split”切换到真正的**局部原生 backdrop plate 实验**：

- 主窗口仍是 620×430 透明 Tauri WebViewWindow；
- 新增 `native-plate`，它是没有 WebView 的纯 Tauri Window；
- Windows 下 plate 通过 `parent_raw(main.hwnd())` 成为 main 的 child HWND；
- plate 只覆盖右侧 x=120..620；
- plate 忽略鼠标、不可聚焦、无装饰/阴影、隐藏任务栏、always-on-bottom；
- `9`：主窗口 clear + 右侧 Native Acrylic plate；
- `0`：主窗口 clear + 右侧 Native Blur plate；
- 切到其它模式前会先隐藏 plate，避免污染旧实验。

这条路线不引入 WGC、D3D11、WinUI 3、Windows App SDK、Win2D 或 shader。

## 当前模式

```text
1 Pure
2 Edge Glass
3 Tint Glass
4 CSS Frost
5 Acrylic α0       whole window
6 Acrylic α12      whole window
7 Acrylic α78      whole window
8 Blur α0          whole window
9 Native Acrylic   right child HWND only
0 Native Blur      right child HWND only
```

重点比较：

```text
1 vs 9  → 左侧是否仍保持 Pure 清晰度
5 vs 9  → 整窗 Acrylic 与局部 Acrylic 的区别
9 vs 0  → Acrylic / Blur 哪个右侧磨砂更接近参考图
```

## Native plate 配置

`src-tauri/native-plate.json`：

```json
{
  "x": 120,
  "y": 0,
  "width": 500,
  "height": 430,
  "acrylicColor": [92, 170, 226, 0],
  "blurColor": [92, 170, 226, 0]
}
```

## Rust / Tauri 改动

- `Cargo.toml` 给 Tauri 增加 `unstable` feature，以使用纯 `WindowBuilder`。
- `setup_native_plate()` 在 setup hook 创建隐藏的 child Window。
- `set_native_plate(kind)` command 负责 hide / Acrylic / Blur 三态。
- `main.js` 使用 `window.__TAURI__.core.invoke('set_native_plate', ...)` 控制 plate。
- 主窗口原有 `setEffects/clearEffects` 仍保留用于 1–8 对照。

## 已完成的静态验证范围

`verify_tauri_glass_test.py` 已锁住：

- 620×430 主窗口透明配置；
- 10 个模式和 0~9 快捷键；
- Acrylic α0/12/78；
- `native-plate.json` 几何与 tint；
- Tauri `unstable` feature；
- `WindowBuilder::new(..., "native-plate")`；
- `parent_raw(main.hwnd())`；
- ignore cursor / always-on-bottom；
- Acrylic / Blur plate effect；
- JS hide→切主 effect→show plate 的时序；
- WGC / D3D11 / SetWindowRgn 不回流。

## Windows 真机验证

当前 ChatGPT 环境不是 Windows Tauri build host，因此没有声明 `cargo check`、Windows build 或 child HWND Acrylic 真机 PASS。

本机执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

然后重点按 `1 / 5 / 9 / 0`，把窗口放在有网格、文字和明显色块的背景上拖动。

### 成功标准

`9 Native Acrylic` 成功时应满足：

- 左侧 x<120 与 `1 Pure` 接近，背景细节仍清晰；
- 右侧出现系统 Acrylic 磨砂；
- plate 随主窗口一起移动，不出现脱离；
- UI 仍由主 WebView 绘制，plate 不抢鼠标/焦点。

如果 plate 在 child HWND 上不显示 Acrylic、出现在 WebView 上方遮住 UI，或 Windows 10 compositor 不接受该 effect，则下一步再切到 Windows.UI.Composition HostBackdropBrush / Windows App SDK DesktopAcrylicController；当前阶段先用最小 child-HWND 方案验证架构。
