# 拾笺桌面端

当前目录是拾笺的 Tauri 2 Windows 桌面工程。已接入原生窗口、置顶、系统托盘、开机启动、位置记忆和本地 TXT 目录。

## 环境

- Node.js 22+
- Rust stable MSVC
- Visual Studio 2022 Build Tools（C++ 桌面工具）
- Microsoft Edge WebView2 Runtime

## 命令

```bash
npm install
npm run build
npm run tauri dev
```

Rust 单独检查：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## 当前边界

- `src/` 负责 React 界面与交互。
- `src/services/desktop-api.ts` 统一封装窗口与系统行为。
- `src/services/draft-api.ts` 统一封装草稿文件命令。
- `src-tauri/` 负责应用生命周期、托盘、目录配置和安全 TXT 文件操作。
- 原生模式支持选择目录、读取、新建、重命名、安全保存和移入系统回收站。
- 浏览器模式保留模拟草稿，便于独立预览界面；完整编辑窗口仍待后续实现。
