# Native Glass Demo 项目规则

## 项目目标

这是一个只验证 Windows 原生窗口材质的独立 Win32 Demo，不承载拾笺业务逻辑，也不修改 `shijian-react-electron-experiment`。

当前验证范围：

- Windows 11 DWM Mica。
- Windows 11 Desktop Acrylic。
- `DWMSBT_NONE` 对应的透明玻璃模式。
- 原生无边框窗口、圆角、拖动和按钮命中区域。
- 跨 DPI、跨显示器和自定义窗口缩放行为。

## 运行与构建

- 构建：`powershell -ExecutionPolicy Bypass -File .\build.ps1`
- 运行：`powershell -ExecutionPolicy Bypass -File .\run.ps1`
- 切换材质：`powershell -ExecutionPolicy Bypass -File .\select-backdrop.ps1`
- 捕获窗口：`powershell -ExecutionPolicy Bypass -File .\capture-window.ps1`
- 目标系统：Windows 11 Build 22621 或更高。
- 构建使用 Visual Studio C++ 工具链和 Windows SDK，不引入 Electron、Tauri 或网络资源。

## 修改边界

- 只修改本 Demo 目录内文件。
- 不把 Demo 代码直接复制进拾笺主项目。
- 材质只使用 Windows DWM 原生接口；不要用屏幕截图或 WebRTC 模拟背景。
- `NativeGlassDemo.cpp` 是窗口消息、布局、绘制和 DWM 适配的唯一实现入口；修改窗口边界时同步检查 `STATUS.md` 和 `CODEMAP.md`。
- 布局常量优先与 `demo.config.json` 保持一致；不要把与 UI 相关的新参数只藏在事件处理代码中。
- 修改后至少执行一次构建；涉及窗口行为时还要验证窗口可见、可拖动、按钮可点击，以及 DPI、跨屏和缩放场景。
- 不使用截图、网页背景或额外模糊层模拟原生材质；改变材质边界前必须确认 DWM Frame 与客户区的绘制边界。
- 不把此 Demo 的代码直接复制回拾笺主项目；迁移前先形成独立方案和验证结果。

## 文档使用顺序

处理任务前依次阅读：`STATUS.md`、`CODEMAP.md`，涉及视觉参数时再阅读 `DESIGN.md`。Git 提交记录是历史依据，状态文档只记录当前交接状态。
