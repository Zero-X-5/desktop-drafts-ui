# STATUS — 拾笺 / Liquid Glass V8 Validation

- 更新日期: 2026-08-14
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `b84dd1c0`（V8 源码未改；已记录 2026-08-14 真机压力验证结果。本 STATUS 提交仅更新状态文档）

## 当前分支
`agent/liquid-glass-v8-validation`

## 当前目标

继续完成 V8 最后两类边界验证：真实跨显示器/混合 DPI rebind，以及显示器/设备扰动。已经通过的 F2 并发、普通移动和 3200×2000 高动态捕获不再作为待修问题；在没有新失败证据前，不创建“仅为了稳定性”的 V9。

## 分支定位

- 分支基于远端 `main` 创建。
- 主应用 `src/`、`src-tauri/` 未被修改；原有固定 720×480 画布 + Windows Region 的 Tauri 架构保持不变。
- V8 源码位于 `experiments/liquid-glass-winui3-v8-validation/`，仍是独立实验，不代表已决定迁移拾笺壳层。
- `agent/native-glass-demo` 的 DWM 原生 Mica/Acrylic 实验仍是另一条独立验证线，不与本分支混用。

## V8 当前实现

- F2 使用 `std::timed_mutex captureGate` 严格串行 WGC Drain 与 display-affinity 切换。
- F2 ON：等待在途 Drain 结束 → 冻结捕获 → `WDA_NONE`。
- F2 OFF：保持冻结 → 成功恢复 `WDA_EXCLUDEFROMCAPTURE` → 才恢复捕获。
- affinity 恢复失败时 fail-safe 保持冻结，避免递归自捕获。
- F2 gate 最多等待 250ms；超时记录 `barrier-timeout`，不无限阻塞 UI。
- 过滤 F2 keyboard autorepeat。
- Host bounds 使用 mutex 保护的一致快照。
- F1 指标包含 `dropped`、`age`、`thread`、`affinity-fail`、`barrier-timeout`、`monitors`、`device-removed`、最后 HRESULT。
- `DXGI_ERROR_DEVICE_REMOVED` 会显式暴露 render-thread 失败状态，而不是保留旧 FPS 假装健康。

## GitHub 源码布局

`LiquidGlassRenderer.cpp` 是小型 wrapper，顺序 include：

- `LiquidGlassRenderer.part01.inc`
- `LiquidGlassRenderer.part02.inc`
- `LiquidGlassRenderer.part03.inc`
- `LiquidGlassRenderer.part04.inc`
- `LiquidGlassRenderer.part05.inc`
- `LiquidGlassRenderer.part06.inc`
- `LiquidGlassRenderer.part07.inc`
- `LiquidGlassRenderer.part08.inc`

8 个 `.inc` 文件按顺序拼接后与原始单文件 V8 Renderer 逐字节一致。该分片只用于绕过当前 GitHub 连接器的单次文本写入限制；编译语义仍是单一 translation unit。

## 静态验证

`python verify_v8.py` 已通过：

- V7 optical/product architecture: PASS
- strict F2 capture gate: PASS
- affinity fail-safe: PASS
- F2 autorepeat filter: PASS
- capture drop/age metrics: PASS
- render health metrics: PASS
- cross-monitor observability: PASS
- coherent bounds snapshot: PASS
- V8 validation instrumentation: PASS

分片前后逐字节重组检查一致。

## Windows 真机构建基线

用户已拉取 `agent/liquid-glass-v8-validation`，将 V8 renderer 复制到现有本地 prototype，并把宿主从 WinUI Composition 适配为 Win32 layered-window 路径；V8 的 capture gate、affinity fail-safe 和观测指标源码保留。

本地产物：

`D:\AI\ClaudeCode\liquid-glass-reference-replica-v4\liquid-glass-winui3-product-v8\win32-build\LiquidGlass LiveDesktopV8.exe`

实测为 899KB 全静态 Win32 可执行文件，窗口 274×148 正常运行，任务栏图标和实时标题统计正常。

初始 V8 真机状态：

- `R-FPS 51 / WGC 51 / CPU 1.83ms`
- `cap 3200×2000`
- `frames=767 / drop=0 / age=15ms`
- `rebinds=1 / mon=1`
- `afail=0 / btimeout=0 / devrem=0 / hr=0x0`
- `thread=OK / excl=YES / shot=OFF`

F2 基础功能已确认：ON 后 `excl=NO / shot=ON` 且 `age` 持续上升证明捕获冻结；OFF 后恢复 `excl=YES / shot=OFF`，`age` 回落到 28ms。

## 2026-08-14 压力验证结果

### A. F2 高频切换 — PASS

- 80 次快速 F2 + 12 次长按。
- `afail=0` 全程。
- `btimeout=0` 全程。
- `thread=OK` 全程。
- 最终正确回到 `excl=YES / shot=OFF`。
- 切换期间 `drop` 累计 38，恢复正常模式后停止增长。

结论：capture gate、affinity 顺序和 fail-closed 路径没有出现死锁、超时、affinity 失败、永久截图状态错乱或持续 backlog。38 个 drop 视为冻结/恢复期间的有限队列 coalescing，而不是持续性能故障。

### 普通窗口移动 / bounds 高频更新 — PASS

- 40 次快速拖动，含屏幕四角/边缘。
- `rebinds=1` 稳定，无 rebind 风暴。
- `drop=0`。
- `thread=OK`。
- `mon` 在窗口完全/部分落到所有显示器矩形之外时可短暂为 `0`，属于指标语义，不视为故障。

该测试只证明同一 capture source 下的高频位置更新稳定，不等价于真正 monitor A → monitor B rebind。

### C. 3200×2000 高动态捕获 — PASS（当前硬件/单 renderer）

Edge 全屏动画 + 滚动，连续 3 分钟：

- t0: `R-FPS 55 / WGC 55 / CPU 2.11ms / drop=0 / age=5ms`
- t60s: `55 / 55 / 2.31ms / drop=0 / age=12ms`
- t120s: `55 / 55 / 2.48ms / drop=0 / age=12ms`
- t180s: `55 / 55 / 2.28ms / drop=0 / age=3ms / frames=10175`

结论：本机 3200×2000、约 55 FPS、单 renderer 下，全屏 `CopyResource` 没有表现为现实瓶颈；`drop=0`、`age<15ms`、FPS 和 CPU 均无持续恶化。该结论不外推到 4K/5K 高刷、核显/省电模式、HDR 或多个独立 renderer。

## 当前风险状态

已通过 / 暂不继续修改：

- F2 capture/affinity 并发时序。
- F2 barrier 超时风险（当前硬件压测未复现）。
- affinity 恢复失败（当前硬件压测未复现）。
- 普通窗口移动和 bounds 高频同步。
- 3200×2000 高动态单 renderer 捕获性能。
- 正常运行下 render-thread 健康状态。

仍待验证：

- 真实 monitor A → monitor B capture rebind。
- 混合 DPI 跨屏 30+ 往返。
- 显示器断开/重连、分辨率/缩放/显示模式变化。
- 若真实触发 device removal，确认 `devrem/hr/thread` 能准确暴露失败。

已知产品化限制：

- 横跨两屏仍是单显示器 capture source；`monitors=2` 只暴露限制，尚无双屏 stitching。
- BGRA8 HDR pipeline 尚未实现。
- device lost 已能检测，但尚未实现自动 D3D/宿主对象重建。
- 多个 Liquid Glass 控件共享一个 monitor capture session 尚未实现。

## 下一步

保持 renderer 代码不变，先完成 `V8_VALIDATION.md` 剩余两项：

1. **B — 真实跨显示器 / 混合 DPI**：确认每次完整进入新显示器后只发生预期 rebind，`age` 恢复正常、`thread=OK`，没有永久 capture freeze。
2. **D — 显示器 / 设备扰动**：断开/重连副屏或改变显示模式/缩放，确认恢复状态和错误指标可判读。

若 B/D 通过，则 V8 单实例底层验证阶段可关闭，下一工程阶段应优先评估共享 capture / 多控件产品架构，而不是继续做稳定性 V9。若 B/D 暴露具体生命周期缺陷，再基于复现证据实现 V9。
