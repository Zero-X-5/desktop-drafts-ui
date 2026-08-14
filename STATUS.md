# STATUS — 拾笺 / Liquid Glass V9 Recovery

- 更新日期: 2026-08-14
- 更新 Agent: ChatGPT

## 当前分支

`agent/liquid-glass-v9-recovery`

## 当前状态

**V9 Recovery Phase 1 已封板。**

V8 的 F2 / capture gate / affinity fail-safe / 高动态捕获基线与 V9 的 capture-session recovery 已完成静态、沙盒和 Windows 真机验证。当前没有证据支持继续做 V9 Phase 2 的 D3D/Composition device reconstruction；下一工程阶段切换到正式拾笺隔离集成。

## 已验证基线

V8：

- F2 80 次快速切换 + 12 次长按：`afail=0 / btimeout=0 / thread=OK`，最终 `excl=YES / shot=OFF`。
- 40 次窗口移动：无 rebind storm，`drop=0 / thread=OK`。
- 3200×2000 高动态捕获 3 分钟：约 55 FPS，`drop=0 / age<15ms`，CPU 无持续退化。

V9 recovery：

- `GraphicsCaptureItem.Closed`、ContentSize 变化、WGC drain error、`WM_DISPLAYCHANGE` 统一进入 render-thread recovery。
- recovery 最多 3 次；普通 capture-session failure 不杀 render thread。
- recovery / Drain / F2 共用 `captureGate`；F2 frozen 时 recovery pending。
- request 使用 `atomic::exchange(false)`。
- device removal 保持 `devrem/hr/thread=DEAD` 明确诊断。

Windows recovery 实测：

- 5 次 `WM_DISPLAYCHANGE`：`rec=6/0 / rebinds=6 / rec-hr=0x0 / drop=0 / age=2ms / thread=OK`。
- 20 次 F2 / recovery 交错：`rec=11/0 / rebinds=11 / afail=0 / btimeout=0 / devrem=0`，最终 `excl=YES / shot=OFF / thread=OK`。

## Stability seal gate — PASS

### Lifecycle 50 次

- 50/50 PASS。
- `afail=0 / btimeout=0 / devrem=0 / recF=0 / thread=OK`。
- 全部正常退出，无 forced cleanup。
- 真机发现 PowerShell helper `H` 与 `h=Get-History` alias 冲突；仓库脚本已改为 `Wait-Hwnd`。

### 60 分钟 soak

结果：`PASS_WITH_WARNING`，资源趋势人工复核后接受封板。

硬门槛全部通过：

- `rec=12/0`；
- `afail=0 / btimeout=0 / devrem=0`；
- `thread=OK`；
- `age<31ms`；
- 最终 `excl=YES / shot=OFF`。

资源趋势：

- Private Memory 从约 114MB 阶梯增长到 430–480MB 区间，约 30 分钟后 plateau，最终约 427MB；没有持续单调增长证据。
- Handle 数约 5 分钟后 plateau 在 ~530。
- `drop` 在约 55 分钟一次 exercise 中跳到 59，但 `age/thread` 正常；记录为后续正式集成观察项，不阻塞封板。

完整 seal 证据见：

`experiments/liquid-glass-winui3-v8-validation/V9_STABILITY_GATE.md`

## 已知非阻塞项

- 真正 `GraphicsCaptureItem.Closed` 物理事件尚未实测；`closed=0` 不阻塞正式集成。
- 真正 D3D device removal 尚未出现；无 `devrem` 证据前不做 Phase 2。
- 横跨两屏仍无 dual-monitor stitching。
- HDR pipeline 未实现。
- 多 Glass 控件共享 capture session 尚未实现。

## 下一步

从本封板 HEAD 创建：

`agent/liquid-glass-integration`

正式拾笺第一阶段只接入 **一个 Liquid Glass 区域**，并保留原 UI fallback / feature switch。优先验证：

1. Tauri/WebView 与原生 Liquid Glass 层共存；
2. 现有 Windows Region 折叠/目录/预览切换不回归；
3. DPI、双屏、左右换侧、隐藏/恢复；
4. self-exclusion / F2 / recovery 在正式宿主中的行为；
5. 资源趋势，尤其继续观察 recovery exercise 后 Private Memory plateau 与偶发 drop burst。

通过单区域正式宿主验证后，再设计 shared capture service / 多控件架构；不直接全量替换现有拾笺 UI。
