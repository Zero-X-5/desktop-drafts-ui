# 代码地图

## 入口

- `NativeGlassDemo.cpp`：窗口创建、DWM 材质、DPI 缩放、绘制、拖动和交互。
- `demo.config.json`：Demo 默认尺寸、顶栏高度和目标系统说明。
- `build.ps1`：调用 Visual Studio C++ 环境编译 x64 可执行文件。
- `run.ps1`：关闭旧实例、启动并激活 `bin\NativeGlassDemo.exe`。
- `select-backdrop.ps1`：验证 Mica、Acrylic、透明玻璃切换。
- `capture-window.ps1`：使用目标窗口绘制内容生成验证截图；DWM 系统 backdrop 不保证能被 `PrintWindow` 捕获。
- `README.md`：项目定位、限制和最小使用说明。

## 数据流

```text
WM_CREATE -> WM_NCCALCSIZE/SWP_FRAMECHANGED -> applyBackdrop -> WM_ACTIVATE -> WM_PAINT
WM_NCHITTEST -> 真实顶栏拖动/置顶、设置、关闭命中
WM_SETCURSOR/WM_LBUTTONDOWN/WM_MOUSEMOVE/WM_LBUTTONUP -> 自定义窗口边缘缩放
WM_WINDOWPOSCHANGED/WM_ENTERSIZEMOVE/WM_EXITSIZEMOVE -> 合并完整重绘并同步 DWM 合成，避免移动/缩放残影
WM_DPICHANGED/WM_DISPLAYCHANGE -> 重建 DPI 相关布局、DWM 扩展 Frame 和系统材质，避免跨显示器残影
WM_LBUTTONUP -> 编辑区材质切换 / 顶栏窗口操作
```

## 排查入口

- 玻璃边界、圆角和材质切换：从 `applyBackdrop`、`applyBackdropAttributes`、`extendFrameIntoClientArea`、`rebuildDwmFrame` 开始。
- 跨屏与 DPI：检查 `WM_DPICHANGED`、`WM_DISPLAYCHANGE`、`WM_WINDOWPOSCHANGED` 以及 `g_dpi`/`ui()` 的关系。
- 拉伸与残影：检查 `resizeHitTest`、`beginResize`、`updateResize`、`WM_PAINT`、`WM_ERASEBKGND` 和 `refreshFrame` 的绘制/合成顺序。
- 标题、Tab 和按钮重复绘制：先对照 `paint()` 中的顶栏、Tab 栏和编辑区坐标，再检查 DWM 扩展区域是否与 GDI 绘制区域重叠。

## 修改边界

- 材质切换集中在 `applyBackdrop`；`extendFrameIntoClientArea` 将系统材质扩展到自绘顶栏客户区。
- `WM_NCCALCSIZE` 移除旧非客户区，`SWP_FRAMECHANGED` 使完整客户区立即生效；`resizeHitTest` 补回无默认非客户区时的窗口缩放边缘。
- 窗口不再使用 `WS_THICKFRAME`；`beginResize`、`updateResize`、`endResize` 在客户区内完成缩放，避免 DWM 系统外框露出白边。
- 真实顶栏、Tab 栏尺寸和按钮布局集中在 `demo.config.json` 对应的常量区域；代码通过 `ui()` 将逻辑像素统一换算为当前 DPI 的物理像素。
- `refreshFrame`、`postFrameRefresh` 和 `WM_ERASEBKGND` 共同负责透明顶栏与不透明客户区的重绘边界；顶栏不填充实体色，Tab/编辑区在擦除阶段显式清理。
- `applyBackdropAttributes` 只提交 DWM 材质属性；`rebuildDwmFrame` 负责按需执行 `DwmExtendFrameIntoClientArea`、`SWP_FRAMECHANGED`、完整重绘和 `DwmFlush`，跨屏 DPI 变化与显示器配置变化统一经过该路径。
- 不在此 Demo 中添加业务状态、React 组件或持久化逻辑。
- `bin/` 和验证截图属于构建/验证产物，不作为源码入口；截图因 DWM backdrop 捕获限制只能作为辅助证据。
