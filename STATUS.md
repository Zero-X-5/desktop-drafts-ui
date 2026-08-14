# STATUS — 拾笺 / Liquid Glass V8 Validation

- 更新日期: 2026-08-14
- 更新 Agent: ChatGPT
- 对应代码 HEAD: `73cdb894`（V8 源码、验证脚本与 CODEMAP 完成后的交接基线；本 STATUS 提交仅更新状态文档）

## 当前分支
`agent/liquid-glass-v8-validation`

## 当前目标

在不修改现有拾笺 Tauri 主业务代码的前提下，独立验证 WinUI 3 + Windows.Graphics.Capture + D3D11 + Microsoft.UI.Composition 的 Liquid Glass 产品化路线，并用 V8 加固版重点验证 F2 截图切换时序、跨显示器/混合 DPI、持续高动态负载和设备异常的可观测性。

## 分支定位

- 分支基于远端 `main` 创建。
- 主应用 `src/`、`src-tauri/` 未被修改；原有固定 720×480 画布 + Windows Region 的 Tauri 架构保持不变。
- V8 源码位于 `experiments/liquid-glass-winui3-v8-validation/`，当前只是独立实验，不代表已决定迁移拾笺壳层。
- `agent/native-glass-demo` 的 DWM 原生 Mica/Acrylic 实验仍是另一条独立验证线，不与本分支混用。

## V7 已确认实测基线

用户已在 Windows 真机确认 V7：

- 初始约 `R-FPS 55 / WGC 55 / CPU 2.12ms / cap 3200×2000 / excl=YES`。
- F1 详细统计正常，可显示累计 frames、rebinds、excl、shot。
- F2 ON 正常进入 `excl=NO / shot=ON`，冻结捕获后系统截图可见窗口。
- F2 OFF 正常恢复 `excl=YES / shot=OFF`。

## V8 加固内容

- F2 使用 `std::timed_mutex captureGate` 严格串行 WGC Drain 与 display-affinity 切换。
- F2 ON：等待在途 Drain 结束 → 冻结捕获 → `WDA_NONE`。
- F2 OFF：保持冻结 → 成功恢复 `WDA_EXCLUDEFROMCAPTURE` → 才恢复捕获。
- affinity 恢复失败时 fail-safe 保持冻结，避免递归自捕获。
- F2 gate 最多等待 250ms；超时记录 `barrier-timeout`，不无限阻塞 UI。
- 过滤 F2 keyboard autorepeat。
- Host bounds 改为 mutex 保护的一致快照，避免多 atomic 字段混合版本。
- F1 新增 `dropped`、`age`、`thread`、`affinity-fail`、`barrier-timeout`、`monitors`、`device-removed`、最后 HRESULT。
- `DXGI_ERROR_DEVICE_REMOVED` 不再静默保留旧 FPS，而会暴露 render-thread 失败状态。

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

8 个 `.inc` 文件按顺序拼接后与原始单文件 V8 Renderer 逐字节一致。该分片只用于绕过当前 GitHub 连接器的单次文本写入限制；Visual Studio 中只编译 `LiquidGlassRenderer.cpp` 即可。

## 已执行验证

当前环境不是 Windows / Visual Studio / WinUI 3，因此没有伪称完成真机构建。

本地对完整 V8 源码执行 `python verify_v8.py` 已通过：

- V7 optical/product architecture: PASS
- strict F2 capture gate: PASS
- affinity fail-safe: PASS
- F2 autorepeat filter: PASS
- capture drop/age metrics: PASS
- render health metrics: PASS
- cross-monitor observability: PASS
- coherent bounds snapshot: PASS
- V8 validation instrumentation: PASS

分片前后已做逐字节重组检查，结果一致。

## 尚未完成 / 已知限制

- 尚未在 Windows 真机编译当前 GitHub V8 source drop。
- 尚未执行 `V8_VALIDATION.md` 中四组压力测试。
- 跨两屏仍使用单显示器 capture source；`monitors=2` 只用于暴露当前限制，不代表已经实现双屏拼接。
- 仍固定使用 BGRA8，HDR pipeline 尚未实现。
- D3D/Composition device lost 目前可以明确检测，但尚未实现自动全对象重建；`thread=DEAD` 后需要 renderer/app 重启。
- 多个 Liquid Glass 控件共享一个 monitor capture session 尚未实现。

## 下一步

在 Windows 11 真机从本分支取 `experiments/liquid-glass-winui3-v8-validation/`，创建标准 WinUI 3 C++/WinRT Host 并按 `README.md` 接入，然后依次执行 `V8_VALIDATION.md`：

1. F2 快速切换/长按压力测试。
2. 双屏、混合 DPI 跨屏往返。
3. 4K/高动态背景持续拖动负载。
4. 显示器重连/显示模式变化/设备异常观察。

通过这些数据后再决定是否进入架构收敛或继续做 V9；在此之前不要把实验代码直接接入拾笺主应用。
