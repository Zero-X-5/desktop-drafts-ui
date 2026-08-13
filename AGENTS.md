# Native Glass Demo 规则

## 项目目标

这是一个只验证 Windows 原生窗口材质的独立 Demo，不承载拾笺业务逻辑，也不修改 `shijian-react-electron-experiment`。

当前验证范围：

- Windows 11 DWM Mica。
- Windows 11 Desktop Acrylic。
- 原生无边框窗口、圆角、拖动和按钮命中区域。

## 运行与构建

- 构建：`powershell -ExecutionPolicy Bypass -File .\build.ps1`
- 运行：`powershell -ExecutionPolicy Bypass -File .\run.ps1`
- 目标系统：Windows 11 Build 22621 或更高。
- 构建使用 Visual Studio C++ 工具链和 Windows SDK，不引入 Electron、Tauri 或网络资源。

## 修改边界

- 只修改本 Demo 目录内文件。
- 不把 Demo 代码直接复制进拾笺主项目。
- 材质只使用 Windows DWM 原生接口；不要用屏幕截图或 WebRTC 模拟背景。
- 修改后至少执行一次构建，并实际启动验证窗口可见、可拖动、按钮可点击。
