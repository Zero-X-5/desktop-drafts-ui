# STATUS — 拾笺 (shijian)

- 更新日期: 2026-08-05
- 更新 Agent: Claude
- HEAD commit: `6a32a0a`（合并 fix-ui-flicker 分支 `cbf05a6` + 补 index.html 引用 + 复用 --surface token）

## 当前分支
`master`

## 当前目标
整体方案收尾：修复展开/收起时的轻微闪烁（左右交换提前 5% 已实现）。

## 当前配方 / 运行方式
- 构建: 在项目根目录 `npm run tauri build`
- 前端资源: `src/`（Tauri `frontendDist`，无构建步骤，直接嵌入）
- 调试: 启动前设置 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`，用 CDP (9222) 做程序化验证
- 安装路径: 构建产物复制到 `D:\AI Program Files\拾笺\拾笺.exe`
- 运行进程: `拾笺.exe`

## 未完成事项
- [x] 左右交换提前 5% 触发 — 已实现（`onMoved` 中 `margin = 0.05 * monitor.size.width`）
- [~] 展开/收起轻微闪烁 — 修复已合入（`performance-fixes.css`，构建通过），实际效果待运行验证
- [ ] 展开/收起闪烁运行验证（目测 / CDP 截图）
- [ ] 透明模式、主题切换回归测试

## 下一步建议
1. 聚焦修复展开/收起的轻微闪烁（遮罩淡出时机、resize 稳定时间）
2. 有问题按 `AGENTS.md`「拾笺架构约定」做增量修复，勿回退旧方案
3. 全部验收通过后，工作区提交为稳定版本
