# CODEMAP — 拾笺 (shijian)

## 项目结构
```text
shijian/
├── AGENTS.md
├── DESIGN.md
├── STATUS.md
├── CODEMAP.md
├── experiments/
│   └── liquid-glass-winui3-v8-validation/   V8 基线 + V9 capture recovery 独立实验源码
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

## 独立实验 (`experiments/liquid-glass-winui3-v8-validation/`)

当前 `agent/liquid-glass-v9-recovery` 继续复用 V8 source-drop 目录，**尚未接入 `src/` 或 `src-tauri/`，不会改变现有拾笺 Tauri 架构**。

### 核心入口

- `LiquidGlassRenderer.h`：renderer 公共接口、F1 统计结构、F2 截图模式，以及 V9 `RequestCaptureRefresh()`。
- `LiquidGlassRenderer.cpp`：小型编译入口，顺序 include `LiquidGlassRenderer.part01.inc` ～ `part08.inc`。
- `LiquidGlassRenderer.part01.inc` / `part03.inc` / `part06.inc`：光学/HLSL、Composition/D3D 主路径；V9 Phase 1 未改这些光学实现。
- `LiquidGlassRenderer.part02.inc`：renderer 状态；V9 新增 capture restart flag、Closed token、recovery 统计。
- `LiquidGlassRenderer.part04.inc`：`StopCapture` / `StartCapture` / FrameArrived；V9 在此订阅和注销 `GraphicsCaptureItem.Closed`。
- `LiquidGlassRenderer.part05.inc`：`DrainCaptureFrames`；ContentSize 变化和 WGC hresult 改为投递 recovery request。
- `LiquidGlassRenderer.part07.inc`：`RecoverCaptureIfNeeded`、bounds/rebind、render-thread 生命周期；V9 的 3 次有界恢复和 device-removed 分界集中在这里。
- `LiquidGlassRenderer.part08.inc`：公共 `RequestCaptureRefresh()`、F2 和 Stats 导出。

### 宿主与验证

- `WinUIHost/MainWindow.xaml*`：WinUI 3 宿主、F1/F2；`WM_DISPLAYCHANGE` 现在无条件请求 capture refresh。
- `V8_VALIDATION.md`：V8 已执行/待执行验证证据。
- `V9_RECOVERY.md`：V9 Phase 1 恢复目标、状态机与后续 Windows 验证矩阵。
- `verify_v7.py`：V7 光学/产品架构约束。
- `verify_v8.py`：V8 capture gate、affinity、健康指标和 bounds snapshot 回归。
- `verify_v9.py`：Closed 订阅/注销、有界重试、captureGate、atomic request consume、display-change 强刷和 device-removed 终止语义。
- `README.md` / `ARCHITECTURE.md`：WinUI 3 + WGC + D3D11 + Microsoft.UI.Composition 集成说明。

### V9 Phase 1 recovery 数据流

```text
GraphicsCaptureItem.Closed
ContentSize changed
Drain hresult
WM_DISPLAYCHANGE
monitor changed
        ↓
captureRestartRequested = true
        ↓
render thread
        ↓
captureGate
        ↓
F2 frozen? ── yes → keep pending
        │ no
        ↓
atomic exchange(false)
        ↓
MonitorFromRect(current host rect)
        ↓
StartCapture (max 3 attempts, 50/100ms backoff)
        ↓
normal capture restored
```

若 `GetDeviceRemovedReason()` 返回真实设备错误，Phase 1 不做普通 retry 隐藏问题，而是保留 `devrem/hr/thread=DEAD` 语义；完整 D3D/D2D/Composition 重建属于 Phase 2。

当前实验仍采用单显示器 capture source；玻璃横跨两屏时没有真正 dual-monitor stitching。HDR 和多 Glass 控件共享 capture session 也仍是后续产品化层。

## 关键决策
- 禁止恢复运行时原生 `setSize` 状态切换
- 禁止用不透明 body 背景或全 HWND 矩形遮罩掩盖过渡
- Region 必须在展开时最后扩大、收起时最先缩小
- 保持单窗口、单 WebView、单 DOM；不拆分目录和预览窗口
- 若调整尺寸或圆角，必须同时更新 Rust Region 常量和 CSS 固定画布变量
- Windows 实机测试必须覆盖多 DPI、双显示器和左右换侧
- Liquid Glass V9 仍是独立实验，不直接接线进现有 Tauri 主应用
- V9 Phase 1 只恢复 WGC capture session；没有真机 device-removal 证据前不实现完整 D3D/Composition reconstruction
