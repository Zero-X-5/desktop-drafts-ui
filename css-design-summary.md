# 拾笺 (shijian) — CSS 与配色体系现状总结

> 目的：供另一个 AI 评估 CSS/配色优化空间。基于 2026-08-05 代码基线 `b442e56`。

## 一、技术背景
- **应用**：Tauri 2 桌面便签（Windows）。前端无构建步骤（`frontendDist` 直接嵌入）。
- **窗口架构（重要）**：主窗口**永久固定 720×480**、透明、无装饰。可见区域由 **Rust `SetWindowRgn`**（`src-tauri/src/window_region.rs`）按状态裁剪：`collapsed 248×36` / `expanded 248×480` / `preview 720×480`，统一 14px 圆角（DPI 感知，按 scale factor 转物理像素）。
- **CSS 文件结构**（`src/`）：
  - `styles.css` — 入口，`@import` 加载下面两个
  - `styles-core.css`（413 行）— 全部视觉样式、主题变量
  - `performance-fixes.css`（64 行）— 固定画布坐标覆盖层（HTML/body 720×480、Region 相关）
- **主题切换**：`<html data-theme="light|dark">`；透明模式：`body.transparent-on`。
- 窗口状态类：`.app-window` 的 `expanded` / `preview-mode` / `preview-left|right` / `hidden`；遮罩类 `masking` / `preview-opening` / `preview-closing` / `preview-ready`（**已被 Region 方案弃用**）。

## 二、设计 Token 体系

### 颜色变量（`--xxx`，深浅双套，`styles-core.css:6-55`）
| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--glass` | rgba(242,243,248,.70) | rgba(27,30,38,.56) | 面板/玻璃底 |
| `--glass-strong` | rgba(242,243,248,.80) | rgba(29,32,41,.70) | 强玻璃/透明模式 |
| `--surface` | rgba(247,248,251,.86) | rgba(23,26,34,.84) | 内容区/输入/遮罩底 |
| `--surface-soft` | rgba(0,0,0,.028) | rgba(255,255,255,.026) | 次级底 |
| `--surface-hover` | rgba(0,0,0,.062) | rgba(255,255,255,.066) | 悬停 |
| `--surface-selected` | rgba(108,143,255,.16) | rgba(99,140,255,.18) | 选中 |
| `--text` | #18191f | #e8e9ef | 主文本 |
| `--text-secondary` | #626572 | #9496a0 | 次级文本 |
| `--text-tertiary` | #858895 | #5e6070 | 弱文本/占位 |
| `--line` | rgba(0,0,0,.07) | rgba(255,255,255,.065) | 分隔线 |
| `--line-strong` | rgba(0,0,0,.10) | rgba(255,255,255,.10) | 强线/滚动条 |
| `--accent` | #6c8fff | #6c8fff（同值） | 主色 |
| `--accent-soft` | rgba(108,143,255,.16) | 同 | 主色淡底 |
| `--danger` | #e85d67 | #ff6b6b | 危险/删除 |
| `--warning` | #b37b20 | #e8a93a | 警告 |
| `--warning-bg` | rgba(232,169,58,.10) | 同 | 警告淡底 |

### 阴影（窗口本体不使用 box-shadow）
- `--shadow-window`：0 18px 48px + 0 2px 8px（深色更深）
- `--shadow-menu`：0 14px 38px + 0 2px 6px
- 另有 `--shadow` / `--menu-shadow` 别名（重复定义）

### 字重
`--fw-regular:400` / `--fw-medium:500` / `--fw-semibold:590` / `--fw-bold:650`

### 尺寸（Region 可见区域）
| 项 | 值 |
|---|---|
| 物理窗口 | 720 × 480（固定） |
| collapsed / expanded / preview | 248×36 / 248×480 / 720×480 |
| 目录宽 / 工具栏高 / 编辑头高 | 248 / 34 / 44 |
| 图标按钮 / 列表行 / 搜索框 | 28×28 / 52 / 28 |
| 开关 | 32×18 |

### 圆角
窗口折叠 10 / 展开与预览 14 / 卡片弹层 10~14 / 图标按钮 7 / 列表行 7 / 搜索框 8 / 开关胶囊 999

### 字体
- UI：`"Inter Variable", Inter, system-ui, -apple-system, sans-serif`（**硬编码在 body，非变量**）
- 编辑器：`"JetBrains Mono", ui-monospace, monospace`
- 字号无变量，各处硬编码：9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 13 / 13.5 / 15px

## 三、视觉风格要点
- **毛玻璃**：窗口 `backdrop-filter: blur(30px) saturate(1.34)`；弹层/菜单 `blur(36px) saturate(1.38)`；toast `blur(20px)`。
- **窗口本体背景**：非透明模式近不透明 `rgba(14,18,27,.95)` / light `rgba(240,242,248,.95)`；透明模式用 `--glass-strong`。
- **窗口高光**：`.app-window::before` 内边框 `1px rgba(255,255,255,.13)` + inset 高光。
- **整体渐变背景**（body，非透明模式）：深色径向蓝紫光晕 + 135° 线性渐变；浅色灰蓝同构。
- **动画曲线**：窗口 `cubic-bezier(.22,1,.36,1)`，hover/active `ease` 80~150ms，弹层 135~180ms；`prefers-reduced-motion` 已降级 1ms。
- **滚动条**：细 3px、圆角 999，深色 `rgba(255,255,255,.14)`。

## 四、组件现状
- **图标**：全部内联 SVG `<symbol>`（stroke 风格，stroke-width 1.6~1.9），fill 为 none。
- **目录列表**：`grid-template-columns: 14px minmax(0,1fr) auto 16px`，行高 52，选中 `--surface-selected`，拖拽 `opacity .38 + blur(1px)`。
- **开关**：胶囊 + 圆点平移（14px→translateX(14px)）。
- **菜单/弹层**：`color-mix(in srgb, var(--glass-strong) 92%, transparent)` + 阴影 + 入场 `translateY(-4px) scale(.985)`。
- **对话框**：遮罩 `rgba(0,0,0,.46) + blur(4px)`，卡片 `scale(.97)→1`。
- **toast**：深色胶囊 `rgba(28,30,38,.88) + blur(20px)`，底部居中。

## 五、供评估的已知问题点
1. **注释残留**：`styles-core.css:1-3` 头部注释仍写"窗口真实 resize / 遮罩盖中间帧"——与当前 Region 方案**不符**（实际遮罩已被 `performance-fixes.css` 以 `display:none` 禁用），易误导。
2. **死代码**：`.app-window::after` 遮罩整套规则（`styles-core.css:136-156`）+ `#resizeMask` 相关，已被 Region 替代，可清理；`.app-window` 的 width/height/border-radius transition（`styles-core.css:109-113`）被覆盖层压掉，属无效声明。
3. **token 覆盖不彻底**：多处硬编码色值未走变量——`rgba(0,0,0,.025)`（列表面板）、`rgba(108,143,255,.22/.42)`（搜索框 focus）、滚动条各色、`.desktop-copy`/`.taskbar` 色、窗口背景 `rgba(14,18,27,.95)` 等。
4. **重复/冗余 token**：`--shadow`/`--menu-shadow` 与 `--shadow-window`/`--shadow-menu` 重复；`--accent-soft`、`--warning-bg` 深浅主题同值仍各写两遍。
5. **字体族/字号未 token 化**：字体族硬编码在 body/editor；字号 9.5~15px 散落硬编码，未建立字号 scale。
6. **同义类名残留**：`masking` / `preview-opening` / `preview-closing` / `preview-ready` / `body.window-resizing` 等遮罩/过渡类仍在 CSS 与 JS 中（`resize-fixes.js` 可能仍操作，需与 Region 新时序核对）。
7. **覆盖链**：`performance-fixes.css` 通过后加载覆盖 `styles-core.css`，两者职责边界靠"后者 `!important`"维持，可考虑合并回单一文件或明确分层。
