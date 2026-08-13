# Native Glass Demo

这是拾笺的独立 Windows 原生材质验证 Demo。

它直接调用 Windows DWM 的系统 backdrop API，对比：

- Mica：长驻窗口材质。
- Acrylic：半透明磨砂材质。
- Transparent：绝对透明玻璃；关闭系统 backdrop，只保留顶栏的 DWM frame 扩展。

微软将 `DWMSBT_MAINWINDOW` 映射为 Mica，将 `DWMSBT_TRANSIENTWINDOW` 映射为 Desktop Acrylic。该 API 从 Windows 11 Build 22621 开始支持。

## 构建运行

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

Demo 只验证原生材质，不代表最终会直接采用 Win32 壳。确认效果后，再决定是否创建 WinUI 3 + WebView2 壳来承载现有 React 页面。
