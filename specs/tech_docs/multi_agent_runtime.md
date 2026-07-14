# Agent Runtime 架构

> 状态：当前有效
> 更新：2026-07-14

## 产品约束

BlexAgent 只提供一个 Agent Runtime：随应用打包的 Claude Agent SDK（代码中历史名称为 `builtin`）。用户不需要安装 Claude Code、Codex、Gemini、Hermes 或其他命令行 Agent，也不能在界面、配置或内部管理 API 中选择这些外部 Runtime。

项目中的 `blexagent` 可执行文件是桌面应用内部使用的管理 CLI，用于任务、会话、IM Channel 和诊断等受控操作。它不是模型 Runtime，不能与已移除的外部 Agent CLI 混淆。

## 运行链路

```text
Renderer / IM / Cron / Inbox
            |
            v
    SessionEngine facade
            |
            v
      builtin adapter
            |
            v
      agent-session.ts
            |
            v
 Bundled Claude Agent SDK process
```

- `src/server/session-engine/selector.ts` 始终返回 builtin engine。
- `src/server/agent-session.ts` 是 SDK 会话主入口。
- `src/server/builtin-session/` 持有 builtin 会话的可变状态。
- Rust sidecar 会把历史 Runtime 值归一为 `builtin`，不会注入外部 Runtime 环境变量。
- Renderer 加载配置时会清除历史 `multiAgentRuntime`、外部 `agent.runtime`、`runtimeConfig` 和 Managed Codex 状态。

## 会话与配置

新会话必须记录 `runtime: "builtin"`。加载旧会话时，历史外部 Runtime 元数据仅作为迁移输入，不得再次启动外部可执行文件；会话按 builtin 路径打开，必要时由上层提示用户创建新会话。

Agent 的模型、供应商、权限模式和 reasoning effort 仍属于 SDK 配置，并由现有 Agent/Workspace 配置和 session snapshot 规则管理。供应商是 SDK 请求的目标，不是 Runtime 选择器。

## 禁止重新引入的能力

- Runtime 选择器或 `multiAgentRuntime` 产品开关；
- 外部 CLI 检测、安装、登录、升级或 readiness；
- Managed Codex Provider/runtime；
- `BLEXAGENT_RUNTIME` 驱动的外部进程选择；
- 通过 `blexagent runtime ...` 启动或诊断外部 Runtime；
- 为外部 Runtime 保存 model、permission、reasoning 或额外参数。

如未来需要新增 Agent Runtime，必须先形成新的产品决策、安全模型、迁移方案和发布评审，不能复用历史隐藏开关直接恢复。

## 验证要求

- 配置迁移测试：历史外部 Runtime/Managed Codex 字段被移除；
- Node 测试：SessionEngine 始终为 builtin；
- Rust 测试：任意历史 Runtime 输入都归一为 builtin；
- UI 测试：设置、启动页、聊天输入区和任务高级设置不出现 Runtime 选择器；
- 文档校验：产品文档不宣称支持外部 Agent CLI。
