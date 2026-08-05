# 拾笺项目协议

本文件是 `shijian`（拾笺，Tauri 2 桌面便签）的项目级协议。通用 AI 开发协议见父目录 `D:\AI\ClaudeCode\AGENTS.md`，本项目以本文件补充/覆盖。

## UI 规范

改动 UI / 样式前必须先读 `DESIGN.md`（设计 token、尺寸、圆角、字体、组件约定）。新增颜色/字体/尺寸时优先复用既有 token，不随手引入新值；如需扩展，同步更新 `DESIGN.md`。

## 拾笺架构约定

改动本项目的布局、窗口、预览交互前，先读本节，**不得无理由回退到更复杂的旧方案**。

- **整体方案**：一个整体 DOM（`src/index.html` 的 `.app-window`），目录+编辑用 flex 排列，上方栏横跨。
- **窗口真实 resize**：`win.setSize` 按状态调整窗口尺寸（collapsed 248×36 / expanded 248×480 / preview 720×480）。**不再使用** 永久 1192 宽窗口 + `SetWindowRgn` 裁剪方案（历史遗留，已废弃）。
- **目录不固定屏幕坐标**：预览方向由窗口相对屏幕边缘决定（`openPreview` 检测右缘超屏选侧），拖动触边时 `applyPreviewSide` 瞬间翻转（flex `order`），**无滑动动画**。
- **resize 中间帧遮罩**：打开/收起/展开/折叠时用 `.app-window::after` 遮罩盖住 WebView2 新区域白屏；`preview-opening / preview-closing / masking` 置遮罩为 1，`preview-ready` 触发淡出。
- **交换提前 5%**：`onMoved` 中距离屏幕边界 5% 屏幕宽度即触发交换（`margin = 0.05 * monitor.size.width`）。
- **已知取舍**：resize 以窗口左上角为锚，窗口靠屏幕右缘展开可能超屏，`openPreview` 会自动 `setPosition` 左移兜底。
- **历史教训**：1192 轨道 + `SetWindowRgn` + 三独立表面方案造成动画不同步、收起闪烁等大量问题，整体重构后才解决。后续加功能优先在整体方案上做增量，不要重蹈覆辙。
