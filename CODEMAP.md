# CODEMAP — 拾笺 (shijian)

## 项目结构
```
shijian/
├── AGENTS.md          项目协议（通用开发协议 + UI 规范 + 架构约定）
├── DESIGN.md          UI 规范（设计 token、尺寸、圆角、字体、组件约定）
├── STATUS.md          当前状态、代码基线、验证与待办
├── CODEMAP.md         本文件
├── src/               前端（Tauri frontendDist，直接嵌入无需构建）
│   ├── index.html     DOM 结构 + SVG 图标
│   ├── main.js        JavaScript 轻量入口：依次加载 main-core.js、resize-fixes.js
│   ├── main-core.js   原始业务逻辑、事件绑定、草稿 CRUD、设置与窗口基础逻辑
│   ├── resize-fixes.js 窗口 resize 同步层与防并发状态队列
│   ├── styles.css     CSS 轻量入口：依次加载 styles-core.css、performance-fixes.css
│   ├── styles-core.css 原始视觉样式与整体布局
│   ├── performance-fixes.css resize 遮罩、100% 根容器和合成性能覆盖
│   └── assets/        静态资源
└── src-tauri/         Rust 后端
    ├── src/lib.rs     主要后端逻辑
    ├── src/main.rs    入口
    ├── tauri.conf.json 窗口/构建/打包配置
    ├── Cargo.toml     依赖
    └── capabilities/  权限声明
```

## 前端核心 (src/)

### main.js
- 仅作为加载入口，不承载业务逻辑
- 页面解析阶段同步加载 `main-core.js`，随后加载 `resize-fixes.js`
- 非解析阶段提供顺序动态加载兜底

### main-core.js
- `resizeWindow()` — 原始基础尺寸逻辑；运行时由 `resize-fixes.js` 的稳定版本覆盖
- `expand()` / `collapse()` / `openPreview()` / `closePreview()` — 原始交互入口；事件监听仍调用同名全局绑定
- `applyPreviewSide()` / `onMoved` — 左右边缘 5% 阈值与瞬间 flex order 翻转
- 草稿 CRUD、拖拽排序、保存、托盘联动、设置、主题、透明模式和快捷键

### resize-fixes.js
- `setWindowSizeStable()` — resize 前监听 `win.onResized`，结合 `innerSize()` / `scaleFactor()`、48ms 稳定窗口和双 RAF 等待渲染提交
- `queueWindowTransition()` — 串行化窗口操作，并用版本号丢弃被新目标取代的旧操作
- `showResizeMask()` / `hideResizeMask()` — 在原生 resize 前先提交不透明遮罩，稳定后再淡出
- 覆盖 `resizeWindow`、`expand`、`collapse`、`openPreview`、`closePreview`、`hideApp`、`restoreHidden`
- 预览方向和超屏位置修正仍沿用原有整体窗口方案

### styles.css / styles-core.css
- `styles.css` 只负责按顺序导入 core 样式和性能覆盖
- `styles-core.css` 保留原 `.app-window`、目录/编辑 flex 布局、主题变量与组件样式

### performance-fixes.css
- `.app-window` 在所有状态始终填满原生窗口，不再执行 width/height CSS 动画
- `#resizeMask` 是应用容器内的完全不透明高层遮罩
- `body.window-resizing` 在 WebView2 重新分配表面期间提供主题对应的纯色底
- resize 期间关闭 backdrop blur 和窗口/壳层 transition，避免透明合成与布局动画竞争

## 后端 (src-tauri/src/lib.rs)
- 命令: `get_store_dir`, `list_drafts`, `read_draft`, `write_draft`, `delete_to_recycle`, `open_folder`, `get_settings`, `set_settings`, `set_autostart`, `set_hotkey`
- 托盘: 显示/隐藏、新建草稿、退出
- 全局快捷键: `ctrl+shift+space`（切换）、`ctrl+shift+n`（新建）
- 文件监控: `notify` → `drafts-changed` 事件

## 关键决策
- 继续使用一个整体 DOM + 原生窗口真实 resize + flex order 瞬间换侧
- 原生窗口是唯一尺寸来源，DOM 根容器只填满 viewport
- resize 完成以 Tauri resize 事件和渲染帧为准，不使用固定等待时间猜测
- 不回退到 1192 轨道、`SetWindowRgn` 或三独立表面旧方案
- 业务逻辑修改进入 `main-core.js`；仅 resize/合成相关修改进入 `resize-fixes.js` 和 `performance-fixes.css`
