# CODEMAP — Tauri Glass Effects Test

## 当前分支

`agent/tauri-glass-effects-test`

这是从 `main@b442e56d` 新开的独立 Tauri 2 Windows 材质实验分支。当前目标是拆开比较：

1. Tauri/WebView2 真实透明；
2. CSS edge/tint/frost；
3. 整窗 Windows Acrylic / Blur；
4. **透明主窗口 + 右侧局部原生 Acrylic/Blur plate**。

不承载草稿业务，也不运行 WGC / D3D11 Liquid Glass renderer。

## 结构

```text
src/
├── index.html                  10 态透明度/局部 backdrop 对照 UI
├── main.js                     主窗口 effect + native plate invoke 切换
├── styles.css                  Pure / Edge / Tint / Frost（旧 split CSS 已无活动模式引用）
└── glass-test-config.json      0~9 模式与 nativePlate 标记

src-tauri/
├── tauri.conf.json             620×430 透明主 WebViewWindow
├── native-plate.json           右侧 child HWND 几何与 Acrylic/Blur tint
├── capabilities/default.json   主窗口 set-effects / drag / close 权限
└── src/lib.rs                  创建/控制无 WebView 的 native-plate Window

verify_tauri_glass_test.py       主窗口 + child-HWND plate 静态契约
```

## 主窗口

- 620×430 logical px。
- 单 WebView。
- `transparent: true`。
- `decorations: false`。
- `resizable: false`。
- `shadow: false`。
- `backgroundColor: #00000000`。
- `noRedirectionBitmap: true`。
- 顶部 `data-tauri-drag-region` 负责拖动。

## Native plate

`src-tauri/native-plate.json`：

```text
x      = 120
y      = 0
width  = 500
height = 430
Acrylic color = [92,170,226,0]
Blur color    = [92,170,226,0]
```

Windows setup 阶段：

```text
main WebviewWindow HWND
        ↓ parent_raw
native-plate Window
  ├─ 无 WebView
  ├─ transparent
  ├─ decorations=false
  ├─ shadow=false
  ├─ focusable=false
  ├─ skip_taskbar=true
  ├─ always_on_bottom=true
  ├─ ignore_cursor_events=true
  └─ 初始 hidden
```

plate 是 main 的 child HWND，因此随主窗口一起移动，不需要 JS 每帧同步坐标。它只覆盖 x=120 之后的右侧区域。

## Rust bridge

`src-tauri/src/lib.rs`：

- `setup_native_plate()` 在 Tauri setup hook 创建 child Window。
- `set_native_plate(kind)` 是唯一新增 command。
- `kind = null`：隐藏 plate。
- `kind = acrylic`：plate 使用 `Effect::Acrylic` 后显示。
- `kind = blur`：plate 使用 `Effect::Blur` 后显示。
- effect color 来自 `native-plate.json`。
- 非 Windows 平台只允许关闭 plate；启用时返回 Windows-only 错误。

纯 WindowBuilder 需要 Tauri `unstable` feature，因此 `Cargo.toml` 为：

```text
tauri = { version = "2", features = ["tray-icon", "unstable"] }
```

没有增加 Windows App SDK、WinUI 3、Win2D、WGC、D3D11 或 shader 依赖。

## 前端切换

每次切换模式，`main.js` 固定执行：

```text
1. invoke set_native_plate(null)
2. 切换主窗口 clearEffects / setEffects
3. 若模式声明 nativePlate，再显示对应 child HWND
```

这样旧 plate 不会污染其它比较模式。

## 10 个模式

```text
1 Pure             主窗口 clear
2 Edge Glass       clear + CSS edge
3 Tint Glass       clear + CSS thin tint
4 CSS Frost        clear + CSS backdrop blur 4px
5 Acrylic α0       整窗 Acrylic
6 Acrylic α12      整窗 Acrylic
7 Acrylic α78      整窗 Acrylic
8 Blur α0          整窗 Blur
9 Native Acrylic   主窗口 clear + 右侧 Acrylic child HWND
0 Native Blur      主窗口 clear + 右侧 Blur child HWND
```

关键比较：

```text
1 vs 9
→ Acrylic plate 是否只影响右侧，而左侧保持 Pure 清晰度

9 vs 0
→ 右侧 Acrylic 与 Blur 哪个更接近参考图

5 vs 9
→ 整窗 Acrylic 与局部 Acrylic 的透明度差异
```

## 技术边界

微软 `Windows.UI.Composition.Compositor.CreateHostBackdropBrush()` 可以从“窗口绘制前”的宿主背景采样，适用于局部 Visual；但真正 frosted glass 还需要 EffectBrush/Gaussian blur 图形效果。当前阶段先复用 Tauri 已有 Windows Acrylic/Blur effect，把它限制到一个独立 child HWND 上，验证局部系统 backdrop 架构是否成立。

如果 child HWND 上的 Tauri Acrylic 在目标 Win10 上不可用或合成层级不正确，再进入下一阶段：Windows.UI.Composition HostBackdropBrush / Windows App SDK DesktopAcrylicController。当前阶段不提前引入这些依赖。

## 验证

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

静态契约锁住：主窗口透明配置、10 个模式、Acrylic α0/12/78、native-plate 几何、child HWND、ignore cursor、always-on-bottom、Acrylic/Blur effect 和前端 invoke 时序。最终 child HWND 的 Acrylic/Blur 真机表现必须在 Windows 上确认。
