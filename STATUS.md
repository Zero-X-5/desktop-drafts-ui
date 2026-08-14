# STATUS — 拾笺 / Liquid Glass V9 Recovery

- 更新日期: 2026-08-14
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `3c186869`（V9 Phase 1 recovery 代码、静态验证脚本与恢复说明完成后的交接基线；本 STATUS 提交仅更新状态文档）

## 当前分支
`agent/liquid-glass-v9-recovery`

## 当前目标

在 V8 已通过 F2 高频切换、普通移动和 3200×2000 高动态捕获实测的基础上，修复沙盒已证明的 capture-session 生命周期缺口：`GraphicsCaptureItem.Closed` 无恢复，以及 `WM_DISPLAYCHANGE` 在几何/DPI 不变时无法强制重绑。V9 Phase 1 只做 WGC capture-session recovery，不改光学效果，不接入拾笺 Tauri 主业务，也不实现完整 D3D device-lost 重建。

## 分支定位

- 本分支从 `agent/liquid-glass-v8-validation` 最新验证基线创建。
- 主应用 `src/`、`src-tauri/` 未修改；现有固定 720×480 画布 + Windows Region 的 Tauri 架构保持不变。
- 实验源码继续位于 `experiments/liquid-glass-winui3-v8-validation/`；目录名沿用 V8 以避免复制整套 source drop，分支/文档明确当前实现已经是 V9 Recovery。
- `agent/native-glass-demo` 的 DWM 原生材质实验仍为独立路线。

## V8 已确认基线

Windows 真机已确认：

- F2：80 次快速切换 + 12 次长按，`afail=0 / btimeout=0 / thread=OK`，最终 `excl=YES / shot=OFF`。
- 普通窗口移动：40 次快速拖动，`rebinds=1 / drop=0 / thread=OK`，无 rebind storm。
- 高动态捕获：3200×2000、约 55 FPS 连续 3 分钟，`drop=0`、`age<15ms`、CPU 约 2.1–2.5ms，无持续退化。
- V8 Win32 化产物已在用户机器构建运行成功；capture gate、affinity fail-safe 与健康指标保留。

因此 V9 不修改 F2、CopyResource、shader 或普通 bounds 路径，除非出现新的失败证据。

## V8 沙盒发现的确定缺口

1. `GraphicsCaptureItem.Closed` 未订阅：捕获目标结束后可能不再产生 FrameArrived，从而没有机会靠 ContentSize 变化自动重建。
2. Host 虽处理 `WM_DISPLAYCHANGE`，但原 `UpdateGlassScreenRect()` 在 RECT/DPI 未变化时提前返回，renderer 收不到强制 refresh。
3. D3D device removal 已能通过 `devrem/hr/thread=DEAD` 明确暴露，但没有自动重建设备；这是独立的 Phase 2 范围。

## V9 Phase 1 已实现

- 订阅 `GraphicsCaptureItem.Closed`；Closed 只投递 recovery request，不在回调线程直接创建/销毁 WGC 对象。
- `StopCapture()` 在关闭 session/frame pool 前注销 Closed handler。
- capture ContentSize 变化、Drain 的 `hresult_error` 统一改为 recovery request。
- 新增 `LiquidGlassRenderer::RequestCaptureRefresh()`。
- `WM_DISPLAYCHANGE` 无条件调用 `RequestCaptureRefresh()`，不再依赖 RECT/DPI 是否变化。
- 所有 capture restart 统一在 render thread 执行。
- 每个 recovery cycle 最多 3 次，退避 50ms / 100ms；三次普通 capture-session 失败后线程保持存活并发布 recovery HRESULT。
- recovery 与 V8 F2/Drain 共用 `captureGate`；WGC session 重建不能跨越 `freeze -> WDA_NONE` 屏障。
- F2 frozen 时 recovery request 保持 pending，恢复 `WDA_EXCLUDEFROMCAPTURE` 后再执行。
- 消费 request 使用 `atomic::exchange(false)`，避免 Closed/DisplayChange 恰好插入 `load/store` 间隙而丢请求。
- recovery 期间若 `GetDeviceRemovedReason()` 真实失败，则继续使用 V8 语义：记录 `device-removed/hr` 并让 render thread DEAD，不把设备丢失伪装成普通 capture 重试。

## V9 新增观测指标

F1 新增：

- `closed`：GraphicsCaptureItem Closed 次数。
- `recovery attempts/failures`：capture restart 尝试与失败次数。
- `rec-hr`：最近一次 capture recovery HRESULT。

V8 原有 `R-FPS/WGC/CPU/frames/drop/age/rebinds/mon/afail/btimeout/devrem/hr/thread/excl/shot` 保持。

## 已执行验证

### GitHub diff / 静态边界

`agent/liquid-glass-v8-validation -> agent/liquid-glass-v9-recovery` 仅修改：renderer header、capture/recovery 相关分片、WinUI Host display-change 路径，并新增 `verify_v9.py` / `V9_RECOVERY.md`。HLSL/光学分片没有改动，未触及 `src/` / `src-tauri/`。

### 沙盒 recovery 状态机

通过：

- 两次失败后第三次成功：3 attempts / 2 failures / thread alive。
- 三次普通失败：严格停止在 3 次，thread alive，等待未来新事件重新请求。
- F2 frozen 时收到 Closed/DisplayChange：0 attempts，request 保留。
- F2 OFF 恢复 exclusion 后：pending recovery 执行。
- device removed：终止 recovery，保持明确 DEAD 语义。
- 100,000 次随机 Closed / DisplayChange / F2 / recovery 交错：fail-closed 不变量保持。

`verify_v9.py` 负责 V7 -> V8 -> V9 静态回归约束，包含 Closed 订阅/注销、有界重试、captureGate、atomic exchange、WM_DISPLAYCHANGE 强刷与 device-removed 终止路径检查。

## 尚未完成 / 已知限制

- 当前沙盒不是 Windows，无法真实触发 WGC Closed、显示器断开/重连或 D3D device removal；Windows 行为仍需真机验证。
- V9 Phase 1 只恢复 capture session，不重建 D3D11 / D2D / Microsoft.UI.Composition 设备对象。
- 横跨两屏仍使用单显示器 capture source，没有 dual-monitor stitching。
- BGRA8 HDR pipeline 未实现。
- 多 Liquid Glass 控件共享 capture session 未实现。

## 下一步

当 Windows 环境可用时按 `V9_RECOVERY.md` 验证：

1. 窗口保持不动时改变分辨率/缩放，确认 recovery 后 `age` 回落、thread 保持 OK。
2. 断开/重连副屏，观察 `closed/recovery/rebinds/rec-hr`，确认不永久冻结。
3. 显示变化附近反复 F2，确认 `afail=0 / btimeout` 无持续异常且最终 fail-closed 状态正确。
4. 若真实出现 `devrem>0 / thread=DEAD`，再决定是否进入 **V9 Phase 2：D3D/Composition device reconstruction**。

在 Phase 1 真机失败证据出现前，不改 shader、不做多控件架构、不把实验代码直接接入拾笺主应用。
