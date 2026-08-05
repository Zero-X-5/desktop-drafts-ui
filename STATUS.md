# STATUS — 拾笺 (shijian)

- 更新日期: 2026-08-05
- 更新 Agent: Claude
- 代码基线: `6b1fbb3`（master merge verify-region；本机 `cargo check` + `tauri build` 已通过）

## 当前分支
`master`

## 当前目标
已将窗口状态切换从“透明 WebView2 原生 resize”重构为“固定 720×480 画布 + Windows 圆角 Region”。等待 Windows 实机验证该方案是否彻底消除 resize 时矩形表面和圆角丢失闪帧。

## 当前配方 / 运行方式
- 构建: 在项目根目录执行 `npm run tauri build`
- 前端资源: `src/`（Tauri `frontendDist`，无前端构建步骤）
- 主窗口: 永久保持 720×480、透明、无装饰、不可调整大小
- 可见区域: Rust 端通过 Windows Region 在折叠、目录、预览状态之间切换

## 本轮实现
- [x] Tauri 主窗口固定为 720×480，启动时先隐藏，应用初始折叠 Region 后再显示
- [x] 新增 `src-tauri/src/window_region.rs`，封装 DPI 感知的 `CreateRoundRectRgn` / `SetWindowRgn`
- [x] 新增 `set_window_region` Tauri 命令
- [x] Region 状态：折叠 248×36、目录 248×480、预览 720×480，统一 14px 圆角
- [x] 前端完全取消运行时 `win.setSize` 和 `win.onResized`
- [x] 展开预览时先在被裁剪的固定画布内完成 DOM 布局，再扩大 Region
- [x] 收起预览/窗口时先缩小 Region，再移除 DOM 内容
- [x] 左右换侧时移动固定画布 472px，并同步 DOM 顺序和 Region，使目录在屏幕上的位置保持不变
- [x] `html/body` 永久透明，禁用旧 resize 遮罩、矩形 body 背景及宽高/圆角动画
- [x] 保留单窗口、单 WebView、单 DOM 和现有草稿业务逻辑

## 已执行验证
- GitHub 远端回读确认五个架构文件已写入代码提交 `838166f`
- 代码检索确认新的 `resize-fixes.js` 不再调用 `win.setSize`
- Tauri 配置确认固定 720×480，并在 Region 应用前保持隐藏
- 未新增 Cargo 依赖，`Cargo.toml` 与 `Cargo.lock` 保持不变
- **本机已验证（2026-08-05）**：`cargo check` 通过；`npm run tauri build` 通过（exe + NSIS 打包成功）

## 尚未执行 / 风险
- [ ] 尚未在真实 Windows WebView2 上逐帧验证 Region 切换效果
- [ ] 尚未在真实 Windows WebView2 上逐帧验证 Region 切换效果
- [ ] 需要验证 100% / 125% / 150% DPI 下圆角和坐标是否准确
- [ ] 需要验证双显示器、屏幕边缘换侧、拖动及快速快捷键连续触发
- [ ] GDI Region 边缘抗锯齿可能与 CSS 圆角存在 1px 视觉差异

## 实机验收建议
1. 运行代码基线 `6b1fbb3`（已构建通过）
2. 折叠/展开、预览开/关各连续切换至少 30 次
3. 使用 60fps 或更高帧率录屏，逐帧检查是否仍出现完整矩形或圆角丢失
4. 分别测试深色、浅色、透明模式和 100% / 125% / 150% 缩放
5. 在左右屏幕边缘和双显示器之间反复打开预览并拖动换侧
