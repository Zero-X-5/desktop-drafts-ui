# DESIGN — 拾笺 UI 规范

本文件规范拾笺的视觉风格与设计 token。**改动 UI 前先读本文件**,新增颜色/字体/尺寸时优先复用既有 token,不随手引入新值。

## 设计语言

- 毛玻璃质感（`backdrop-filter` blur + saturate）
- 圆角卡片、无边框透明窗口
- 深浅双主题（`html[data-theme="light"|"dark"]`）
- 内容近不透明、窗口本体近不透明（透明窗口上 `opaque` 背景不合成，须用 `rgba(...,0.95)`）

## 设计 Token

### 颜色（两套主题对应）

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--glass` | `rgba(242,243,248,.70)` | `rgba(27,30,38,.56)` | 面板/玻璃底 |
| `--glass-strong` | `rgba(242,243,248,.80)` | `rgba(29,32,41,.70)` | 强玻璃/透明模式窗口 |
| `--surface` | `rgba(247,248,251,.86)` | `rgba(23,26,34,.84)` | 内容区/输入/遮罩底 |
| `--surface-soft` | `rgba(0,0,0,.028)` | `rgba(255,255,255,.026)` | 次级底（列表面板） |
| `--surface-hover` | `rgba(0,0,0,.062)` | `rgba(255,255,255,.066)` | 悬停 |
| `--surface-selected` | `rgba(108,143,255,.16)` | `rgba(99,140,255,.18)` | 选中 |
| `--text` | `#18191f` | `#e8e9ef` | 主文本 |
| `--text-secondary` | `#626572` | `#9496a0` | 次级文本 |
| `--text-tertiary` | `#858895` | `#5e6070` | 弱文本/占位 |
| `--line` | `rgba(0,0,0,.07)` | `rgba(255,255,255,.065)` | 分隔线 |
| `--line-strong` | `rgba(0,0,0,.10)` | `rgba(255,255,255,.10)` | 强线/滚动条 |
| `--accent` | `#6c8fff` | `#6c8fff` | 主色（两主题同值） |
| `--accent-soft` | `rgba(108,143,255,.16)` | `rgba(108,143,255,.16)` | 主色淡底 |
| `--danger` | `#e85d67` | `#ff6b6b` | 危险/删除 |
| `--warning` | `#b37b20` | `#e8a93a` | 警告 |
| `--warning-bg` | `rgba(232,169,58,.10)` | `rgba(232,169,58,.10)` | 警告淡底 |

### 阴影

| Token | 浅色 | 深色 |
|---|---|---|
| `--shadow-window` | `0 18px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.14)` | `0 18px 48px rgba(0,0,0,.36), 0 2px 8px rgba(0,0,0,.22)` |
| `--shadow-menu` | `0 14px 38px rgba(0,0,0,.28), 0 2px 6px rgba(0,0,0,.16)` | `0 14px 40px rgba(0,0,0,.42), 0 2px 6px rgba(0,0,0,.26)` |

> 注：窗口本体 `.app-window` **不使用 box-shadow**（透明窗口上会在四角形成方形轮廓，已移除）。

### 字重

| Token | 值 |
|---|---|
| `--fw-regular` | 400 |
| `--fw-medium` | 500 |
| `--fw-semibold` | 590 |
| `--fw-bold` | 650 |

## 尺寸体系

> 物理窗口固定 720 × 480（透明、无装饰、不可调）；下表为 **Region 可见区域**（Rust `SetWindowRgn` 按状态裁剪）。

| 项 | 值 |
|---|---|
| 窗口 collapsed | 248 × 36 |
| 窗口 expanded | 248 × 480 |
| 窗口 preview | 720 × 480 |
| 目录宽 | 248 |
| 工具栏高 | 34 |
| 编辑头高 | 44 |
| 图标按钮 | 28 × 28 |
| 列表行高 | 52 |
| 搜索框高 | 28 |
| 开关 | 32 × 18 |

## 圆角

| 项 | 值 |
|---|---|
| 窗口（折叠） | 10 |
| 窗口（展开/预览） | 14 |
| brand-mark | 5 |
| 图标按钮 | 7 |
| 列表行 | 7 |
| 搜索框 | 8 |
| 弹层/菜单 | 10 ~ 12 |
| 对话框 | 14 |
| 开关 / 胶囊 | 999 |

## 字体

| 用途 | 字体 |
|---|---|
| UI | `"Inter Variable", Inter, system-ui, -apple-system, sans-serif` |
| 代码/编辑器 | `"JetBrains Mono", ui-monospace, monospace` |

字号层级：9.5（分组标签）· 10~11（弱文本/时间/操作）· 12~13（正文/列表名）· 14~15（标题/输入）。

## 组件约定

- **图标按钮**：默认 `--text-secondary`，hover 变 `--text` + `--surface-hover`，active `scale(.92)`
- **列表行**：48~52 高网格布局，选中 `--surface-selected`，拖拽中 `opacity .38 + blur`
- **开关**：胶囊形，on 态 `--accent`
- **菜单/弹层**：毛玻璃 `--glass-strong` 92% + `--shadow-menu`，入场 `translateY(-4px) scale(.985)` → 到位
- **对话框**：遮罩 `rgba(0,0,0,.46) + blur(4px)`，卡片 `--surface + scale(.97)→1`
- **toast**：深色胶囊 `rgba(28,30,38,.88) + blur(20px)`，底部居中

## 特殊约束

- **透明窗口背景**：`html/body` 永久透明，可见区域完全由原生 Region 裁剪；窗口内内容区背景用 `--surface` 等半透明 token
- **固定画布 + Region 裁剪**：主窗口固定 720×480，可见区域由 Rust `SetWindowRgn` 按状态裁剪（collapsed 248×36 / expanded 248×480 / preview 720×480，统一 14px 逻辑圆角）；前端 **CSS 遮罩已废弃**（`.app-window::after` `display:none`），不再有全窗口遮罩或 resize 专用不透明背景
- **阴影**：窗口本体不画 box-shadow（见上）
- **动画时长**：窗口 Region 切换为原生即时裁剪、无宽高/圆角过渡动画（仅背景色 `180ms ease`）；组件 hover/active `80~150ms ease`；弹层 `135~180ms`
