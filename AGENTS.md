# 拾笺项目协议（desktop-drafts-ui）

本文件是 `shijian`（拾笺，Tauri 2 桌面便签）的项目协议，**独立自包含，不依赖外部文件**。适用于本仓库所有开发、修改、测试与文档工作。

推荐项目从第一天就建立文档体系：`STATUS.md`（状态层）+ `CODEMAP.md`（代码地图层）+ `DESIGN.md`（UI 规范）。

处理任何代码任务前，必须按以下顺序执行：

1. 先阅读根目录 `STATUS.md`。
2. 以 `STATUS.md`（存在时）指定的当前工作分支、当前目标和当前配方为准；未建立该文档体系时，以 `git status`、`git branch` 和最近提交为准。
3. 检查当前分支、工作区状态和最近提交；不得依据旧聊天中的源码或参数修改项目。
4. 阅读 `CODEMAP.md`，再定位与任务相关的源码、调用者和配置。
5. 修改前确保工作区干净，或先建立 checkpoint 提交。
6. 只修改当前任务所需文件，不顺手重构无关模块。
7. 参数必须写入配置文件（JSON / YAML / .ini），禁止只存在于 GUI 控件或源码常量中。
8. 修改后运行相关构建、测试或静态检查；验证失败不得声明完成。
9. 仅当当前阶段、卡点、分支、运行方式或核心结构发生变化时更新 `STATUS.md` / `CODEMAP.md`。
10. Git 提交记录是开发历史的唯一来源，不在文档中重复维护流水账。
11. **文档—代码同频校验**：动手改码前先执行 `git log -1 --format=%h`，与 `STATUS.md` 头部记录的 HEAD 提交号比对；缺失或不一致时，先同步 `STATUS.md` 到真实状态，再开始修改。
12. **跨会话/跨 Agent 交接**：阶段结束前，把未完成事项与下一步建议写入 `STATUS.md`；任何后续 Agent 只以该状态文件为上下文，不得沿用旧对话中的结论或旧源码参数。
13. **STATUS.md 头部元数据**：每次更新 `STATUS.md` 时维护头部三要素：更新日期、更新 Agent 名称、对应 HEAD commit。
14. **提交信息规范**：遵循仓库既有风格（如 `类型: 英文小写描述`）；一次提交只包含当前任务相关文件。

## UI 规范

改动 UI / 样式前必须先读 `DESIGN.md`（设计 token、尺寸、圆角、字体、组件约定）。新增颜色/字体/尺寸时优先复用既有 token，不随手引入新值；如需扩展，同步更新 `DESIGN.md`。

## 拾笺架构约定

改动本项目的布局、窗口、预览交互前，先读本节，**不得无理由回退到更复杂的旧方案**。

- **整体方案**：一个整体 DOM（`src/index.html` 的 `.app-window`），目录+编辑用 flex 排列，上方栏横跨；单窗口、单 WebView、单 DOM。
- **固定画布 + 原生 Region 裁剪**：主窗口永久 720×480（透明、无装饰、不可调整大小），启动时先隐藏、应用初始折叠 Region 后再显示。可见区域由 Rust `src-tauri/src/window_region.rs` 用 `CreateRoundRectRgn` / `SetWindowRgn` 按状态裁剪：collapsed 248×36 / expanded 248×480 / preview 720×480，统一 14px 逻辑圆角（按显示器 scale factor 转物理像素）。前端**不再调用** `win.setSize` / `win.onResized`，状态切换改为 `invoke('set_window_region', { state, side })`。
- **目录不固定屏幕坐标**：预览方向由窗口相对屏幕边缘决定（`openPreview` 检测右缘超屏选侧），拖动触边时 `applyPreviewSide` 瞬间翻转（flex `order`），**无滑动动画**；换侧时固定画布平移 472px，目录在屏幕上的位置保持不变。
- **Region 切换时序**：展开/打开预览先在被裁剪的固定画布内完成 DOM 布局，再扩大 Region；收起/折叠先缩小 Region，再移除 DOM 内容；状态切换由 `resize-fixes.js` 用版本号 + Promise 队列串行化。
- **CSS 遮罩已废弃**：Region 原生裁剪已替代 `.app-window::after` 遮罩（后者 `display:none`）；`html/body` 永久透明，不再使用 resize 专用不透明背景或全窗口遮罩。
- **交换提前 5%**：`onMoved` 中距离屏幕边界 5% 屏幕宽度即触发交换（`margin = 0.05 * monitor.size.width`）。
- **已知取舍**：固定画布以 720 宽为基准，折叠/目录态靠 Region 裁剪；靠屏幕右缘展开预览可能超屏，`openPreview` 会自动 `setPosition` 左移兜底。
- **历史教训**：旧的 1192 轨道 + `SetWindowRgn` + 三独立表面方案造成动画不同步、收起闪烁等大量问题，已废弃。当前固定画布方案虽也使用 Region 裁剪，但**只有单一 DOM/单 WebView，Region 只负责原生裁剪，不引入多表面**；后续增量不得回到按 DOM 分表面渲染或多 DOM 同步的旧思路。
