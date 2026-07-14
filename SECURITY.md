# BlexAgent Security Policy

This policy is maintained by 杭州波粒二象文化科技有限公司 (the Company), the developer and operator of BlexAgent.

[English](#english) | [中文](#中文)

<a id="english"></a>

## English

### Supported releases

Only the latest generally available, platform-signed release receives standard security fixes. The `0.7.x` line is currently a preview line. Preview, internal, unsigned, ad-hoc-signed, and unnotarized builds may be replaced without backward-compatibility guarantees and are not generally available commercial distributions.

The supported status of a release is stated on the official BlexAgent download page. Security fixes may require upgrading to the newest release.

### Scope

Reports may cover the BlexAgent desktop application, official installer and updater, official website or download service, first-party AgentHub packages, built-in Feishu or DingTalk integrations, and security boundaries in the reviewed plugin or MCP integration flows.

Third-party model providers, messaging platforms, websites, plugins, MCP servers, and user-created templates remain primarily governed by their operators. We will help route a credible report when the issue is caused by BlexAgent’s integration or packaging.

### Report a vulnerability

Email **security@blexagent.com**. Do not open a public issue or publish the report before coordination. Include:

- affected version, operating system, architecture, and installation source;
- impact and the security boundary that is crossed;
- reproducible steps and a minimal proof of concept;
- relevant redacted logs or screenshots;
- whether the issue is known to be actively exploited.

Do not send live API keys, passwords, signing keys, complete workspaces, unredacted conversations, customer data, or unnecessary personal information. Use synthetic data and redact local paths where possible. If sensitive transfer is required, ask for an approved channel first.

We aim to acknowledge a complete report within 48 hours and provide a status update within 7 calendar days. Remediation and coordinated disclosure timing depend on severity, exploitability, affected users, third-party dependencies, and release requirements.

### Coordinated disclosure and good-faith research

Give the Company a reasonable opportunity to investigate and ship a fix before public disclosure. Do not access data that is not your own, disrupt services, degrade availability, persist access, deploy malware, use social engineering, or test third-party systems without their authorization. Stop and report promptly if testing exposes personal data, credentials, or another person’s content.

The Company will not pursue a claim solely for good-faith research that follows this policy and applicable law. This statement does not authorize violations of law, third-party terms, privacy rights, or access to systems and data outside the researcher’s authorization.

BlexAgent does not currently operate a public bug-bounty program and does not promise payment or other reward for a report.

### Security updates

Confirmed issues are prioritized using impact, exploitability, exposure, and affected-user scope. The Company may revoke a download, disable an integration, rotate credentials, require an update, or publish an advisory when needed to protect users. Public advisories should identify affected and fixed versions without exposing unnecessary exploit detail before users can update.

Install only from an official BlexAgent location. Public Windows and macOS releases must be platform-signed; macOS releases must also be notarized. Protect `~/.blexagent/`, workspaces, API keys, bot credentials, provider accounts, plugins, and MCP permissions.

<a id="中文"></a>

## 中文

### 支持版本

仅最新的正式、完成平台签名的公开发行版获得常规安全修复。`0.7.x` 当前属于预览版本；内部包、预览包、无签名包、临时签名包和未公证包不是正式商业发行版，可能在不保证向后兼容的情况下被替换。

具体支持状态以 BlexAgent 官方下载页为准。安全修复可能要求升级到最新版本。

### 报告范围

可以报告 BlexAgent 桌面应用、官方安装与更新程序、官网或下载服务、第一方 AgentHub 内容包、内置飞书或钉钉集成，以及经审核插件和 MCP 接入流程中的 BlexAgent 安全边界问题。

第三方模型供应商、聊天平台、网站、插件、MCP Server 和用户自建模板主要受其运营方规则约束；如果问题源于 BlexAgent 的集成或打包方式，我们会协助处理或转交。

### 报告漏洞

请发送邮件至 **security@blexagent.com**，不要创建公开 Issue，也不要在协调修复前公开披露。报告应包含：

- 受影响版本、操作系统、架构和安装来源；
- 安全影响及被突破的边界；
- 可复现步骤和最小化证明；
- 已脱敏的日志或截图；
- 是否发现正在被利用。

不要发送真实 API Key、密码、签名私钥、完整工作区、未脱敏对话、客户数据或无关个人信息。优先使用合成数据并隐藏本地路径；确需传输敏感资料时，请先申请受认可的安全通道。

我们的目标是在收到完整报告后 48 小时内确认，并在 7 个自然日内提供状态更新。修复和协调披露时间取决于严重性、可利用性、影响范围、第三方依赖和发行要求。

### 协调披露与善意研究

公开披露前，请给予公司合理的调查和修复时间。不得访问不属于你的数据、干扰服务、降低可用性、维持未授权访问、部署恶意软件、进行社会工程，或在未经授权的情况下测试第三方系统。测试中如接触个人信息、凭据或他人内容，应立即停止并报告。

对于遵守本政策和适用法律的善意研究，公司不会仅因该研究行为主张责任。本声明不授权违反法律、第三方条款、隐私权，或访问研究者无权访问的系统和数据。

BlexAgent 目前没有公开漏洞奖励计划，也不承诺为报告支付报酬。

### 安全更新

公司根据影响、可利用性、暴露范围和受影响用户确定优先级。必要时可以撤回下载、停用集成、轮换凭据、强制更新或发布安全公告。公告应说明受影响版本和修复版本，并避免在用户能够升级前披露不必要的利用细节。

请只从 BlexAgent 官方位置安装软件。公开 Windows 和 macOS 发行包必须完成平台签名，macOS 还必须完成 Apple 公证。请妥善保护 `~/.blexagent/`、工作区、API Key、机器人凭据、供应商账号、插件和 MCP 权限。
