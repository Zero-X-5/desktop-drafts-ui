# CODEMAP — 拾笺 (shijian)

## 项目结构
```
shijian/
├── AGENTS.md          项目协议（继承父目录通用协议 + 拾笺架构约定）
├── STATUS.md          当前状态（HEAD、目标、待办）
├── CODEMAP.md         本文件
├── src/               前端（Tauri frontendDist，直接嵌入无需构建）
│   ├── index.html     DOM 结构 + SVG 图标
│   ├── main.js        前端全部逻辑
│   ├── styles.css     样式（整体方案布局）
│   └── assets/        静态资源
└── src-tauri/         Rust 后端
    ├── src/lib.rs     主要后端逻辑
    ├── src/main.rs    入口
    ├── tauri.conf.json  窗口/构建/打包配置
    ├── Cargo.toml     依赖
    └── capabilities/  权限声明
```

## 前端核心 (src/)

### main.js
- `resizeWindow()` — `win.setSize` 按状态调整窗口尺寸（collapsed 248×36 / expanded 248×480 / preview 720×480）
- `expand()` / `collapse()` — 展开/折叠，`masking` 遮罩盖 resize 中间帧
- `openPreview()` / `closePreview()` — 打开/收起预览；`preview-opening/closing` 遮罩、`preview-ready` 淡出
- `applyPreviewSide()` — 交换：瞬间翻转 `preview-left/right` class（flex `order`），无动画
- `onMoved` — 距离屏幕边界 5% 触发交换（`margin = 0.05 * monitor.size.width`）
- 草稿 CRUD、拖拽排序、托盘联动、设置/主题/透明、快捷键等

### styles.css
- `.app-window` — 整体容器（`overflow:hidden`，宽随状态）
- `.window-content` — `display:flex`，目录(248) + 编辑(flex:1)
- `.preview-left .directory-view { order:2 }` — 交换翻转
- `.app-window::after` — resize 遮罩；`preview-opening/closing/masking` 置 1，`preview-ready` 淡出
- 主题变量 `:root` / `html[data-theme="dark"]`；透明模式 `body.transparent-on`

## 后端 (src-tauri/src/lib.rs)
- 命令: `get_store_dir`, `list_drafts`, `read_draft`, `write_draft`, `delete_to_recycle`, `open_folder`, `get_settings`, `set_settings`, `set_autostart`, `set_hotkey`
- 托盘: 显示/隐藏、新建草稿、退出
- 全局快捷键: `ctrl+shift+space`（切换）、`ctrl+shift+n`（新建）
- 文件监控: `notify` → `drafts-changed` 事件

## 关键决策
见 `AGENTS.md`「拾笺架构约定」——整体方案 + 真实 resize + 瞬间交换；**不使用** 1192 轨道 + `SetWindowRgn` + 三独立表面旧方案。
