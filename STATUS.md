# STATUS — 拾笺 / Liquid Glass V9 Recovery

- 更新日期: 2026-08-14
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `853c5aff`（V9 Phase 1 与 stability seal harness 基线；本提交仅更新状态）

## 当前分支

`agent/liquid-glass-v9-recovery`

## 当前目标

V9 Recovery Phase 1 已通过 Windows 真机恢复/并发验证。当前不继续增加 renderer 功能，只完成最后的稳定性封板：60 分钟 soak 与 50 次启动/退出生命周期循环。通过后进入 `agent/liquid-glass-integration`，在正式拾笺中做单区域隔离集成。

## 已确认

V8 真机基线：

- F2 80 次快速切换 + 12 次长按：`afail=0 / btimeout=0 / thread=OK`，最终 `excl=YES / shot=OFF`。
- 40 次窗口移动：无 rebind storm，`drop=0 / thread=OK`。
- 3200×2000 高动态捕获 3 分钟：约 55 FPS，`drop=0 / age<15ms`，CPU 无持续恶化。

V9 Phase 1 已实现：

- `GraphicsCaptureItem.Closed`、ContentSize 变化、WGC drain error、`WM_DISPLAYCHANGE` 统一进入 render-thread capture recovery。
- recovery 最多 3 次并有短退避；普通 capture-session failure 不直接终止 render thread。
- recovery / Drain / F2 共用 `captureGate`；F2 frozen 时 recovery 保持 pending。
- request 使用 `atomic::exchange(false)`，避免并发请求丢失。
- device removal 仍保持 `devrem/hr/thread=DEAD` 明确诊断，不在 Phase 1 中重建设备。

## V9 真机验证 — PASS

F1 新指标已工作：

`closed=0  rec=1/0  rec-hr=0x0  afail=0  btimeout=0  devrem=0  thread=OK`

5 次 `WM_DISPLAYCHANGE`：

`rec=6/0  rebinds=6  rec-hr=0x0  drop=0  age=2ms  thread=OK`

结论：每次 DISPLAYCHANGE 都触发 capture refresh，全部恢复成功且帧立即恢复新鲜。

20 次 F2 / recovery 交错：

`rec=11/0  rebinds=11  afail=0  btimeout=0  devrem=0  closed=0`

最终 `excl=YES / shot=OFF / thread=OK`；`drop=5` 仅发生在交错瞬态。

`closed=0` 说明这次没有真实 GraphicsCaptureItem 终止事件。真实 Closed 是补充证据，但不再作为进入正式集成的硬阻塞项。

## Stability seal harness

已新增：

- `experiments/liquid-glass-winui3-v8-validation/stress-v9-soak.ps1`
  - 默认 60 分钟，每 60 秒采样；每 5 分钟做 F2 ON/OFF + DISPLAYCHANGE + 窗口轻微移动。
  - 输出 CSV/JSON，采样 Private Memory、Working Set、Handle 数和 V9 标题健康指标。
- `experiments/liquid-glass-winui3-v8-validation/stress-v9-lifecycle.ps1`
  - 默认 50 次启动、初始化、recovery、F2、关闭循环。
- `experiments/liquid-glass-winui3-v8-validation/V9_STABILITY_GATE.md`
  - 定义命令与封板门槛。

当前沙盒不是 Windows，无法实际运行上述 PowerShell/WGC harness。本轮已完成脚本结构检查与 GitHub 远端回读；实际 seal 结果需要在 Windows 真机执行。

## 剩余门槛

1. Soak：推荐 60 分钟；不得出现 `thread=DEAD`、`afail/btimeout/devrem/rec failure > 0`、持续 stale capture 或最终 `excl/shot` 错误。资源增长警告需看 CSV 是否已 plateau。
2. Lifecycle：50 次全部通过，无启动失败、退出超时或健康指标异常。

若真实出现 `devrem>0 / thread=DEAD`，再评估 V9 Phase 2；没有该证据则不扩大范围。

## 通过后的下一步

当 soak 与 lifecycle 通过后，V9 Recovery Phase 1 封板，新建：

`agent/liquid-glass-integration`

正式拾笺第一阶段只接一个 Liquid Glass 区域，并保留原 UI fallback / feature switch。先验证 Tauri/WebView、Region、DPI、双屏、折叠展开、隐藏恢复与 self-exclusion，再进入共享 capture / 多控件架构。
