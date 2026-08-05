# CODEMAP — 拾笺 (shijian)

## 项目结构
```text
shijian/
├── AGENTS.md
├── DESIGN.md
├── STATUS.md
├── CODEMAP.md
├── src/
│   ├── index.html
│   ├── main.js                 前端加载入口
│   ├── main-core.js            草稿业务、设置、事件与基础窗口交互
│   ├── resize-fixes.js         固定画布 Region 状态协调层
│   ├── styles.css              样式加载入口
│   ├── styles-core.css         原始视觉样式与整体布局
│   ├── performance-fixes.css   固定画布坐标与透明背景覆盖
│   └── assets/
└── src-tauri/
    ├── src/lib.rs              后端命令、托盘、快捷键、文件监控
    ├── src/window_region.rs    固定画布和 Windows 圆角 Region
    ├── src/main.rs
    ├── tauri.conf.json
    ├── Cargo.toml
    └── capabilities/
```

## 架构概览

应用继续使用一个原生窗口、一个 WebView 和一个整体 DOM，但原生窗口不再随 UI 状态改变尺寸。

- HWND / WebView 固定为 720×480
- 折叠状态只显示 248×36 圆角 Region
- 目录状态只显示 248×480 圆角 Region
- 预览状态显示完整 720×480 圆角 Region
- 目录位于右侧布局时，窄 Region 从 x=0 开始
- 目录位于左侧布局时，窄 Region 从 x=472 开始
- 所有状态使用 14px 逻辑圆角，并按显示器 scale factor 转换为物理像素

这不是旧的 1192px 轨道或多表面方案。固定画布中只有当前的 720px 单一 DOM，Region 只负责原生裁剪。

## 前端 (`src/`)

### `main.js`
- 同步加载 `main-core.js`，随后加载 `resize-fixes.js`
- 不承载业务逻辑

### `main-core.js`
- 草稿 CRUD、自动保存、文件冲突、拖拽排序、设置、主题、透明模式
- 托盘和全局快捷键事件对应的前端状态切换
- `onMoved` 仍负责在靠近显示器边缘时请求左右换侧
- 原始窗口函数会在加载结束后由 `resize-fixes.js` 覆盖

### `resize-fixes.js`
- 不再调用 `win.setSize`、`win.onResized` 或尺寸稳定计时器
- 通过 `invoke('set_window_region', { state, side })` 切换原生 Region
- 使用版本号和 Promise 队列串行化展开、折叠、预览开关、隐藏和恢复
- 展开顺序：先修改 DOM → 等待两个渲染帧 → 扩大 Region
- 收起顺序：先缩小 Region → 再移除 DOM 内容
- 左右换侧：移动固定画布 472 逻辑像素，并同步 `preview-left` / `preview-right` 和窄 Region
- 预览打开后按当前显示器工作区夹紧固定 720px 画布位置

### `performance-fixes.css`
- `html/body` 固定为 720×480 且背景永久透明
- 折叠壳层 248×36、目录壳层 248×480、预览壳层 720×480
- 非预览的左侧目录布局将 `.app-window` 放在 x=472
- 所有状态统一 14px 圆角
- 禁用旧 `.app-window::after` / `#resizeMask`
- 不再使用不透明 body 背景遮盖整个透明 HWND
- 取消宽度、高度和圆角动画，只保留背景颜色过渡

## 后端 (`src-tauri/`)

### `src/window_region.rs`
- `ensure_fixed_canvas()`：确保原生窗口为 720×480 逻辑像素
- `region_geometry()`：计算 collapsed / expanded / preview 的逻辑 Region
- Windows 平台：
  - 使用 `WebviewWindow::hwnd()` 获取 HWND
  - 使用 `scale_factor()` 将逻辑坐标转换为物理坐标
  - 通过 `CreateRoundRectRgn` 创建圆角 Region
  - 通过 `SetWindowRgn` 原子替换窗口可见区域
  - 成功后 Region handle 所有权交给 Windows；失败时主动释放
- 非 Windows 平台：校验状态参数后 no-op

### `src/lib.rs`
- 注册 `set_window_region` 命令
- 启动时恢复 always-on-top 设置
- 确保 720×480 固定画布
- 在窗口显示前应用 collapsed/right 初始 Region
- 其他命令：`get_store_dir`, `list_drafts`, `read_draft`, `write_draft`, `delete_to_recycle`, `open_folder`, `get_settings`, `set_settings`, `set_autostart`, `set_hotkey`

### `tauri.conf.json`
- 主窗口尺寸固定为 720×480
- `visible: false`，防止 Region 设置前出现完整矩形窗口
- 继续使用透明、无装饰、无阴影、不可调整大小的单窗口

## 关键决策
- 禁止恢复运行时原生 `setSize` 状态切换
- 禁止用不透明 body 背景或全 HWND 矩形遮罩掩盖过渡
- Region 必须在展开时最后扩大、收起时最先缩小
- 保持单窗口、单 WebView、单 DOM；不拆分目录和预览窗口
- 若调整尺寸或圆角，必须同时更新 Rust Region 常量和 CSS 固定画布变量
- Windows 实机测试必须覆盖多 DPI、双显示器和左右换侧
