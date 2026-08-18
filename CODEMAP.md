# CODEMAP — Tauri Glass Effects Test

## 当前分支

`agent/tauri-glass-effects-test`

这是从 `main@b442e56d` 新开的独立 Tauri 2 Windows 材质实验分支。目标仅是比较 Acrylic / Blur / 普通透明三种窗口效果；不承载拾笺草稿业务，也不运行 Native Liquid Glass renderer。

## 结构

```text
src/
├── index.html                  三态测试 UI + 自定义拖动区
├── main.js                     Tauri window effect 切换逻辑
├── styles.css                  透明测试窗口视觉
└── glass-test-config.json      初始模式 / tint / 快捷键 / 模式说明

src-tauri/
├── tauri.conf.json             520×360 透明测试窗口
├── capabilities/default.json   set-effects / drag / close 权限
└── src/lib.rs                  最小 Tauri Builder，不启动产品 Region/托盘/快捷键/watcher

verify_tauri_glass_test.py       静态契约
```

## 窗口

- 单窗口、单 WebView。
- 520×360 logical px。
- `transparent: true`。
- `decorations: false`。
- `resizable: false`。
- `shadow: false`。
- `noRedirectionBitmap: true`，用于降低透明窗口创建阶段的白闪风险。
- 顶部 `data-tauri-drag-region` 负责拖动。

本实验明确不使用主线 `window_region.rs` 的固定 720×480 + `SetWindowRgn` 状态机，避免 Region 裁剪干扰系统 backdrop 对比。

## 三种模式

### Acrylic

```text
appWindow.setEffects({
  effects: ["acrylic"],
  color: effectColor
})
```

Windows 10 / 11 系统 Acrylic。Win10 上重点观察拖动过程的性能和稳定性。

### Blur

```text
appWindow.setEffects({
  effects: ["blur"],
  color: effectColor
})
```

使用与 Acrylic 相同的 tint 参数，便于比较系统模糊本身的差异。

### Transparent

```text
appWindow.clearEffects()
```

清除系统 backdrop，只剩 WebView 自身的半透明 CSS，是性能和视觉基准。

## 配置

`src/glass-test-config.json` 保存：

- `initialMode`
- `effectColor`
- 1 / 2 / 3 快捷键映射
- 三种模式的 effect 名称和说明

运行时可调参数不只存在于源码常量中。

## 验证

```powershell
python verify_tauri_glass_test.py
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

前两项用于静态/编译契约，最终 Acrylic / Blur 的拖动表现必须在 Windows 真机观察。
