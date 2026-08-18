# STATUS — Tauri Glass Effects Test

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 对应 HEAD commit: `910dad4b`（10 态透明度梯度 + Split Acrylic / Split Clear 已完成；本提交仅同步真实远端 HEAD，随后开始右侧 Native Acrylic plate 实验）

## 当前分支

`agent/tauri-glass-effects-test`

## 当前状态

当前实验为 **10 态透明度梯度**。真机已验证：

- `9 Split Acrylic`：整窗先经过 Acrylic，因此左侧无法恢复清晰背景；
- `0 Split Clear`：底层真实透明，背景结构可以清楚透过；
- CSS `backdrop-filter` 对 HWND 后面的真实桌面只表现出很弱的局部模糊，无法稳定复刻参考图右侧的系统磨砂。

因此本轮不再继续叠整窗 Acrylic，也不恢复 WGC / D3D11。目标调整为：**主窗口保持透明 WebView，在右侧放一个没有 WebView 的原生 Tauri Window 作为 Acrylic plate**。这样左侧继续 clear glass，右侧才由 Windows 系统 Acrylic 负责磨砂。

## 本轮执行范围

- 主窗口继续单 WebView、`transparent: true`。
- 新增一个隐藏的 `native-plate` 原生 Tauri Window（无 WebView）。
- Windows 下将 plate 作为 main HWND 的 child window，只覆盖右侧区域。
- plate 使用系统 Acrylic effect、忽略鼠标事件、隐藏任务栏、无装饰/无阴影。
- `9` 改为 Native Acrylic Plate：主窗口 `clearEffects()`，只显示右侧 plate。
- `0 Split Clear` 保留，作为完全相同产品窗口下的 CSS split 对照。
- 退出 Native Plate 模式时立即隐藏 plate，避免污染其它 1–8 模式。
- plate 几何和 tint 参数写入 `src-tauri/native-plate.json`。
- 不引入 Windows App SDK、WinUI 3、WGC、D3D11、Win2D 或自定义 shader。

## 技术依据

Tauri 2 的纯 `WindowBuilder` 可以创建没有 WebView 的原生窗口，并支持透明窗口、window effects、child/parent HWND 关系和忽略鼠标事件。该方案只增加一个 HWND，不增加第二个 WebView。

真正的 Windows.UI.Composition `CreateHostBackdropBrush()` 也能采样窗口绘制前的宿主背景，但若要形成 frosted glass 仍需 EffectBrush/Gaussian blur 图形效果；本轮先用 Tauri 已有 Windows Acrylic effect 验证“局部原生 backdrop”架构，避免为一次材质实验引入额外图形依赖。

## 验证

Windows 本机建议执行：

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

当前 ChatGPT 环境不是 Windows Tauri build host，因此不会声明 Native plate Windows 编译或真机视觉 PASS。
