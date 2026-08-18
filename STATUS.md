# STATUS — 拾笺 (shijian)

- 更新日期: 2026-08-18
- 更新 Agent: ChatGPT
- 代码基线: `40db374`（`shijian/tab-preview` 当前 HEAD；开源整理起点）

## 当前分支
`shijian/tab-preview`

## 当前目标

将现有可运行的 Tauri 2 桌面草稿应用整理为可公开、可分享、可持续维护的正式开源项目，同时保持现有稳定窗口架构不变。

## 当前稳定架构

- 单窗口、单 WebView、单 DOM
- 原生窗口固定 720×480
- Windows 下使用 `SetWindowRgn` 切换 collapsed / expanded / preview 可见区域
- 前端不恢复运行时 `win.setSize` / `win.onResized`
- 展开时先准备 DOM 再扩大 Region；收起时先缩小 Region 再清理 DOM
- 左右换侧通过固定画布移动 + flex order 保持目录屏幕位置稳定

## 已验证基线

2026-08-05 已完成并实机验证：

- `cargo check` 通过
- `npm run tauri build` 通过（exe + NSIS）
- 深色 / 浅色 / 透明模式
- 100% / 125% / 150% DPI
- 双显示器、屏幕边缘换侧、拖动与快捷键连续触发

## 当前开源整理范围

- 重写项目 README，并提供英文 README
- 增加 MIT License
- 增加 CONTRIBUTING / SECURITY / PRIVACY / CHANGELOG
- 增加 Issue / PR 模板
- 增加 Windows CI 与 tag Release 工作流
- 完善 npm / Cargo / Tauri 元数据
- 清理根目录实验预览文件，避免与正式应用入口混淆
- 单独修正新用户默认草稿目录的硬编码问题

## 发布前待办

- [ ] 应用开源整理改动并完成构建验证
- [ ] 补充真实产品截图 / GIF
- [ ] 确认仓库名称与项目品牌是否统一为 `shijian`
- [ ] 将默认分支整理为正式发布基线
- [ ] 建立首个公开 `v0.1.0` Release
- [ ] 仓库切换 Public 后补充 description / topics

## 当前注意事项

- 不为“代码看起来更整洁”而重构稳定窗口核心。
- 发布前不得提交个人草稿、账号信息、密钥、绝对本机路径或私有资源链接。
- 根目录 `index.html` 与 `css-design-summary.md` 属于 2026-08-18 的实验预览/评估材料，不应作为正式项目入口公开展示。
