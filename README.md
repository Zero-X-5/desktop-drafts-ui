# desktop-drafts-ui

拾笺 HTML 原型的最小 Electron 桌面效果验证壳。

当前目标不是交付完整草稿应用，而是让现有界面在真实无边框桌面窗口中运行，优先验证视觉材质、真实拖动、展开收起和预览左右换边是否与 HTML 原型一致。

## 当前能力

- Electron 无边框透明窗口直接加载现有 HTML、CSS 和 JavaScript
- Windows 11 优先启用 Acrylic，不支持时自动使用透明 CSS 回退
- 收起、目录、左侧预览和右侧预览四种真实窗口布局
- 目录页作为屏幕坐标锚点，预览换边时目录不交换、不跳动
- 真实窗口最小化和保持在最前
- 通过 preload 暴露最小窗口 API，渲染层关闭 Node.js 访问

草稿内容目前仍是内存中的示例数据，不会写入本地 TXT。详细进度与人工验收步骤见 [`STATUS.md`](./STATUS.md)。

## 项目结构

```text
package.json       Electron 依赖与运行命令
main.js            BrowserWindow、窗口布局和系统能力
preload.js         安全的最小 IPC 接口
index.html         原型 DOM 与 SVG 图标
styles.css         原型视觉和桌面窗口适配
app.js             原型交互和窗口布局状态
STATUS.md          当前进度、限制与接续入口
DESIGN_SYSTEM.md   尺寸、材质和预览锚点基线
```

## 环境要求

- Node.js `>=22.13.0`
- Windows 11 推荐 22H2 或更高版本，以测试系统 Acrylic 材质

## 本地运行

```bash
npm install
npm start
```

只做静态语法检查：

```bash
npm run check
```

## 当前范围

第一阶段只验证真实桌面效果，不包含：

- TXT 文件持久化
- 系统托盘和全局快捷键
- 开机启动
- 安装包、签名和自动更新
- 目录监听和外部修改冲突处理
