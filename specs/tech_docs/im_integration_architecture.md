# Agent Channel / IM 集成架构

> 状态：当前有效
> 更新：2026-07-14

## 支持范围

BlexAgent 当前支持：

- 飞书内置 Channel；
- 钉钉内置 Channel；
- 经过 BlexAgent 审核的 OpenClaw Channel 插件。

原生 Telegram Channel 已移除。配置加载会删除历史 Telegram 项，Rust 创建命令也会明确拒绝 `telegram`。不得把旧文案、图标、教程或配置表单重新作为产品入口暴露。

## 分层

```text
Platform / Plugin
       |
       v
ImAdapter / Plugin Bridge
       |
       v
Agent Channel Router
       |
       v
Sidecar management API
       |
       v
SessionEngine (builtin)
       |
       v
Claude Agent SDK
```

Rust 负责连接、消息 I/O、白名单、重连、路由和 Channel 生命周期；Node sidecar 负责 Agent 会话、工具、模型供应商、审批和结果生成。Plugin Bridge 在独立 Node 子进程中加载 OpenClaw 插件，不能直接获得主 sidecar 的进程内状态。

## 核心类型

`ImPlatform` 只包含内置 `feishu`、`dingtalk` 和 `openclaw:<plugin-id>`。新增平台必须先定义：

- 凭证所有权和保存位置；
- 私聊/群聊身份键；
- 消息长度、媒体和卡片能力；
- 白名单和权限边界；
- 重连、限流和错误恢复；
- 数据发送到第三方平台的隐私说明。

## Session Router

每个 peer 映射到稳定 session key：

```text
im:<platform>:private:<peer-id>
im:<platform>:group:<chat-id>
```

Router 负责：

1. 根据 Channel 找到 Agent 与工作区；
2. 校验 Channel 是否启用、凭证是否完整和发送者是否允许；
3. 恢复或创建 peer session；
4. 通过 capability-token 管理 API 唤醒 sidecar；
5. 将消息提交给 builtin SessionEngine；
6. 把文本、媒体、审批卡片和错误结果送回原 Channel。

Runtime identity 固定为 builtin。旧 `runtime`、`runtimeSource` 或 Managed Codex 值只能作为迁移输入，不参与 peer drift 或 sidecar spawn 决策。

## 飞书

飞书支持手动 App ID/App Secret 配置以及开放平台允许的一键扫码创建流程。扫码流程必须在回调完成、凭证可用并经用户确认后才绑定 Channel；仅生成二维码不等于绑定成功。

消息使用官方 SDK/WebSocket 能力。文档、表格、日历等深度能力通过经过审核的 OpenClaw 飞书插件提供时，插件配置和权限必须在 UI 中明确展示。

## 钉钉

钉钉使用官方 Stream 能力保持连接。Client ID/Secret 等凭证仅保存在本机受控配置中，不进入日志。消息发送、卡片和媒体能力按平台限制降级。

## OpenClaw Plugin Bridge

Bridge 只加载已安装且通过 catalogue/manifest 校验的插件。每个 Channel 使用独立运行目录和状态目录；插件通过受限协议调用 BlexAgent，不得直接读取任意应用配置或其他工作区。

兼容 shim 可以包含第三方插件依赖的符号，但这不代表 BlexAgent 原生支持对应平台。产品 catalogue、创建接口和 UI 是支持范围的权威来源。

## 审批与 AskUserQuestion

Channel 能力通过 `hostInteraction` 显式声明。支持原生卡片的平台可以展示审批和结构化问题；不支持的平台必须安全降级，不能让 Agent 永久等待一个用户无法看到的交互。

- permission request 必须绑定 request id 和 session；
- 回答只能解除对应 pending request；
- stop/reset/崩溃恢复必须清理或过期 pending request；
- 敏感操作不得因平台不支持交互而默认放行。

## 媒体

入站附件下载必须使用统一 SSRF 防护：HTTPS-only、全球可路由单播地址、DNS pinning、禁止重定向、超时和体积上限。下载后的文件进入受控附件目录，再通过 workspace/attachment 协议交给 Agent。

出站媒体必须校验路径、MIME、大小和当前 Channel 上下文。内部中间文件不能在没有用户意图时自动发送。

## 配置迁移

Renderer 与 Rust 都有读时修复：

- 删除历史 Telegram Channel；
- 规范旧 Channel JSON 字段；
- 保留飞书、钉钉和有效 OpenClaw 配置；
- 不因一个已移除 Channel 导致整个 Agent 配置反序列化失败。

迁移必须幂等，并在下一次安全写盘时持久化清理后的结构。

## 可靠性

- Channel 连接由 owner 生命周期管理，避免窗口关闭即断开；
- reconnect 使用退避并区分凭证错误与瞬时网络错误；
- 同一 peer 的消息按序处理；
- handover 时先冻结旧 session，再切换端口/owner；
- heartbeat 和 Cron 投递只使用明确的目标 Channel/session；
- 错误日志不得包含 token、secret、完整消息或敏感附件内容。

## 测试要求

- catalogue/UI 不出现原生 Telegram；
- 旧 Telegram 配置会被删除且不影响其他 Channel；
- 创建命令拒绝 Telegram；
- 飞书、钉钉、OpenClaw 的配置、启动、停止、恢复与消息流；
- 私聊/群聊白名单；
- capability token 正反向；
- SSRF、媒体大小和路径边界；
- pending approval/AskUserQuestion 的完成、取消和崩溃清理。
