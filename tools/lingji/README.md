# 灵玑鼠标 WebHID 诊断工具

该目录是硬件协议排障工具，不参与 BlexAgent 构建或生产运行。生产实现的权威来源是 `src-tauri/src/global_shortcut.rs`；诊断页中的报告码和初始化序列必须与其中的 `lingji_control_code`、`LINGJI_INIT_STEPS` 保持一致。

## 使用

1. 完全退出 BlexAgent 和 uMouse，避免 HID 设备被其它进程独占。
2. 在仓库根目录执行 `python -m http.server 8765 --directory tools/lingji`。
3. 使用 Chrome 或 Edge 打开 `http://localhost:8765/webhid-monitor.html`。
4. 点击“连接设备”，选择 VID `0xABC9` / PID `0xCA89` 的 vendor collection；需要时再点击“初始化鼠标”。

浏览器必须通过 HTTPS 或 `localhost` 使用 WebHID，直接双击 `file://` 页面可能无法获得设备权限。该页面只用于诊断 AI 键原始事件，不替代桌面端的长期监听、重连和按键状态机。
