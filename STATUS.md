# STATUS — 拾笺 (shijian)

- 更新日期: 2026-08-05
- 更新 Agent: Claude
- HEAD commit: `96c3555`（merge 远端 `agent/fix-ui-flicker` 重构；本地仅去除冗余 `performance-fixes.css` 引用）

## 当前分支
`master`

## 当前目标
已拉取远端防闪烁重构（core/fix 层拆分 + resize 串行队列），等待 Windows WebView2 实机视觉回归；重点验证展开/折叠、预览开合、透明模式和快速连续操作。

## 当前配方 / 运行方式
- 构建: 在项目根目录 `npm run tauri build`
- 前端资源: `src/`（Tauri `frontendDist`，无前端构建步骤，直接嵌入）
- 调试: 启动前设置 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`，用 CDP (9222) 做程序化验证
- 安装路径: 构建产物复制到 `D:\AI Program Files\拾笺\拾笺.exe`
- 运行进程: `拾笺.exe`

## 本轮实现
- [x] 修复 `performance-fixes.css` 未被加载的问题：`styles.css` 现在按顺序加载 core 样式和 resize 覆盖层
- [x] 原生窗口独占尺寸控制：`.app-window` 始终 `100% × 100%`，移除 DOM 宽高动画冲突
- [x] 新增全窗口不透明 resize 遮罩，resize 期间关闭 backdrop blur 和布局过渡
- [x] 使用 `win.onResized`、目标尺寸确认和双 `requestAnimationFrame` 判断渲染稳定，不再依赖固定 `100ms`
- [x] 展开、折叠、预览开合、隐藏和恢复统一进入串行 transition 队列，旧操作会被新目标合并
- [x] 保留原始业务逻辑为 `main-core.js`，resize 同步层集中在 `resize-fixes.js`

## 已执行验证
- `node --check`：`main.js` 和 `resize-fixes.js` 通过
- Mock DOM/Tauri 状态测试：展开、打开预览、关闭预览、快速连续切换通过
- 远端回读：`main-core.js` 与原 `main.js` blob SHA 一致，`styles-core.css` 与原 `styles.css` blob SHA 一致

## 未完成事项
- [ ] 在 Windows WebView2 上构建并逐帧检查实际闪烁效果
- [ ] 透明模式、深浅主题、100% / 125% / 150% 缩放回归
- [ ] 左右屏幕边缘、双显示器和快速快捷键连续触发回归

## 下一步建议
1. 构建并安装代码基线 `96c3555`
2. 每种状态连续切换至少 30 次，并录制 60fps 视频逐帧检查
3. 若仍有单帧异常，先区分是方形背景、透明穿透还是内容重绘，再只调整 `performance-fixes.css` 的遮罩背景/淡出时机
