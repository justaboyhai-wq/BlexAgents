# BlexAgent 架构说明

> 状态：当前实现的高层权威说明
> 更新：2026-07-14

## 1. 产品边界

BlexAgent 是杭州波粒二象文化科技有限公司开发的 Apache-2.0 开源桌面个人 Agent，主要面向内容创作、生活、教育和知识工作场景。

当前产品边界：

- 桌面端：Tauri 2 + React 19；
- Agent Runtime：仅内置 Claude Agent SDK；
- 模型供应商：由 SDK 与供应商适配层连接；
- AgentHub：仅提供经过审核并随应用或官方渠道分发的模板与 Skill；
- Agent Channel：飞书、钉钉和经过审核的 OpenClaw 插件；
- 平台：Windows 与 macOS；
- 内部管理工具：`blexagent` CLI，供应用受控调用，不是用户可选的模型 Runtime。

已经退役且不得通过隐藏开关恢复：外部 Agent CLI Runtime、Managed Codex Provider/runtime、原生 Telegram Channel、用户 CLI 工具注册表。

## 2. 总体结构

```text
┌─────────────────────────────────────────────────────┐
│ React Renderer                                      │
│ Launcher · Chat · Agent Settings · AgentHub · Tasks │
└───────────────────────┬─────────────────────────────┘
                        │ Tauri IPC / localhost API
┌───────────────────────▼─────────────────────────────┐
│ Rust Desktop Core                                   │
│ lifecycle · window · filesystem · updater · IM      │
│ sidecar manager · cron · plugin process management  │
└───────────────┬───────────────────────┬─────────────┘
                │ spawn                 │ platform I/O
┌───────────────▼────────────────┐  ┌───▼─────────────┐
│ Node.js Sidecar               │  │ Agent Channels  │
│ management API · sessions     │  │ Feishu/DingTalk │
│ Claude Agent SDK · tools      │  │ OpenClaw Bridge │
│ provider bridge · AgentHub    │  └─────────────────┘
└───────────────┬────────────────┘
                │ stdio NDJSON
┌───────────────▼────────────────┐
│ Bundled Claude Agent SDK      │
└────────────────────────────────┘
```

## 3. Renderer

`src/renderer/` 负责图形界面和用户交互：

- `pages/Launcher.tsx`：启动页与工作区入口；
- `pages/Chat.tsx`：对话、文件、工具和任务交互；
- `pages/settings/SettingsPage.tsx`：全局设置和模型供应商；
- `components/AgentSettings/`：Agent、提示词、Skill、MCP 和 Channel 设置；
- `pages/AgentHub.tsx`：官方精选模板；
- `config/ConfigProvider.tsx`：配置单一 React 数据源和旧配置迁移。

配置加载时必须清理已经退役的外部 Runtime、Managed Codex、CLI 注册表和 Telegram Channel 状态，防止旧磁盘数据重新暴露功能。

## 4. Rust Desktop Core

`src-tauri/src/` 负责操作系统边界和长期进程：

- `lib.rs`：Tauri command 注册与应用启动；
- `sidecar/`：Node sidecar 生命周期、端口和 owner 管理；
- `management_api.rs`：受 capability token 保护的本地管理 API；
- `im/`：Agent Channel 配置、连接、消息和路由；
- `cron_task/`：定时任务；
- `workspace_files/`：文件访问与路径安全；
- `updater.rs`：签名更新；
- `proxy_config.rs`：受控代理配置。
- `memory_hub/`：本地活动账本、分层记忆、产出物、中文索引与工作回顾投影。

Sidecar 的 Runtime identity 统一归一为 `builtin`。旧 sessions/config 中的其他字符串不得导致 Rust 注入外部 Runtime 环境变量或启动第三方 CLI。

## 5. Node Sidecar 与管理 API

`src/server/` 承担 Agent 会话和应用内部服务：

- `index.ts`：HTTP/SSE 路由；
- `agent-session.ts`：Claude Agent SDK 会话主入口；
- `builtin-session/`：builtin 会话状态；
- `session-engine/`：所有调用方共享的会话 facade；
- `admin-api.ts`：内部 `blexagent` CLI 的命令处理；
- `openai-bridge/`：兼容供应商协议转换；
- `plugin-bridge/`：隔离运行经过审核的 OpenClaw Channel 插件；
- `tools/`：应用工具和安全边界；
- `inbox/`：跨入口消息投递。

管理 API 仅监听本机，并要求 Rust 启动时生成的 capability token。合法客户端统一使用带固定认证头的 helper；缺少或错误 token 返回通用 `401`。

## 6. Agent Runtime

会话链路固定为：

```text
caller → SessionEngine → builtin adapter → agent-session → Claude Agent SDK
```

供应商决定 SDK 请求发往哪里，但不改变 Runtime。模型、permission mode、reasoning effort、MCP 和 Skill 继续受 Agent 配置、workspace 配置与 session snapshot 约束。

详细规则见 [Agent Runtime 架构](./tech_docs/multi_agent_runtime.md)。

## 7. Agent Channel

内置 Channel：

| Channel | 连接方式 | 实现 |
| --- | --- | --- |
| 飞书 | WebSocket / 官方开放平台 | Rust adapter 与扫码创建流程 |
| 钉钉 | Stream / 官方开放平台 | Rust adapter |
| OpenClaw | 子进程 Bridge | Node plugin bridge |

原生 Telegram Channel 已移除。配置读取层会删除历史 Telegram 项，命令入口拒绝创建 Telegram Channel。第三方 OpenClaw 插件必须经过 BlexAgent 审核，且仍受插件自身许可和平台条款约束。

Channel 消息经 Router 映射到 Agent/workspace/session，随后统一走 builtin SessionEngine。媒体、审批、AskUserQuestion、心跳和 Cron 结果必须保留现有 payload 合同。

## 8. AgentHub

AgentHub catalogue 只读取随应用打包并通过校验的 manifest，不从用户可写目录或任意远端地址自动加载模板。安装流程必须：

1. 校验模板 ID、版本、文件清单和路径；
2. 预览将要写入的提示词、Skill 和配置；
3. 创建或更新工作区；
4. 失败时回滚；
5. 记录来源与版本。

内容与外部投稿要求见仓库根目录的 AgentHub 内容政策和投稿协议说明。

## 9. 数据与配置

主要数据默认保存在 `~/.blexagent/`，工作区文件保存在用户选择的位置。配置写入必须 disk-first，避免 React 内存状态覆盖其他进程刚写入的数据。

典型数据：

- `config.json`：应用、Agent、Provider、MCP 和 Channel 配置；
- `sessions.json` 与 session transcript：会话索引和历史；
- tasks/thoughts/cron stores：任务与调度；
- logs：统一日志；
- plugins/templates：受控安装资源。

访问外部模型、MCP、网页或聊天平台时，完成操作所需数据可能离开本机，具体规则见隐私声明。

## 10. 安全边界

- Excel 等富内容预览不得使用未经消毒的 HTML 注入；
- 附件下载只允许 HTTPS 和全球可路由单播地址，并保持 DNS pinning、禁止重定向、超时和体积限制；
- 管理 API 使用进程 capability token；
- 工作区路径统一经过安全校验；
- 插件运行在独立进程并使用受限协议；
- 密钥不得写入仓库、日志或公开 Issue；
- 更新包和正式安装包必须通过平台签名验证。

## 11. 构建与发布

Web、server、bridge 和内部 CLI 分别构建，Tauri 将所需资源打入桌面安装包。正式发布要求：

- `npm run validate:docs`、类型检查、lint 和测试通过；
- Windows 安装包使用公司代码签名证书；
- macOS 使用 Developer ID Application 签名并完成 Apple 公证；
- Tauri updater 产物签名；
- 第三方许可证清单无未知项；
- EULA、隐私声明、支持和安全政策与当前公司主体一致。

`0.7.x` 当前属于预览版本；缺少任何正式签名材料时只能产出明确标记的内部/预览构建。

## 12. 相关文档

- [开发说明](../docs/internal/DEVELOPMENT.md)
- [Agent Runtime](./tech_docs/multi_agent_runtime.md)
- [IM 集成](./tech_docs/im_integration_architecture.md)
- [Plugin Bridge](./tech_docs/plugin_bridge_architecture.md)
- [Session 架构](./tech_docs/session_architecture.md)
- [MemoryHub 与工作回顾](./tech_docs/memory_hub.md)
- [构建与发布指南](./guides/build_and_release_guide.md)
- [安全政策](../SECURITY.md)
- [隐私声明](./legal/PRIVACY.md)
