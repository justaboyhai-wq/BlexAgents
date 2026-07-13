# BlexAgent Security Policy

[English](#english) | [中文](#中文)

<a id="english"></a>

## English

### Supported versions

Only the latest generally available release receives security fixes. During the
0.7 release line, this means the latest `0.7.x` version. Preview, unsigned, and
internal builds are not supported distributions.

### Report a vulnerability

Email **team@blexagent.com**. Do not publish the report, open a public issue, or
include live credentials or unnecessary personal data. Include the affected
version/platform, impact, reproduction steps, and a minimal proof of concept.

We aim to acknowledge a complete report within 48 hours and provide a status
update within 7 days. Remediation and disclosure timing depend on severity,
exploitability, affected users, and release requirements.

### User security

- Install only BlexAgent packages from an official BlexAgent download location.
- Public Windows and macOS releases must be platform-signed; macOS releases must
  also be notarized. Verify the publisher/signature before installation.
- Protect `~/.blexagent/`, workspaces, API keys, bot credentials, and provider
  accounts. Revoke any credential that may have been exposed.
- Review tool, MCP, plugin, Channel, and workspace permissions before enabling
  them, and keep BlexAgent and the operating system current.

<a id="中文"></a>

## 中文

### 支持版本

仅最新正式发布版本接收安全修复。在 0.7 版本线中，指最新的 `0.7.x`。预览版、
无签名包和内部构建不属于受支持的正式发行版。

### 报告漏洞

请发送邮件至 **team@blexagent.com**。不要公开披露、创建公开 Issue，也不要附带
真实凭据或不必要的个人数据。请包含受影响版本与平台、影响、复现步骤和最小化证明。

完整报告的目标确认时间为 48 小时内，状态更新时间为 7 天内；修复和披露时间取决于
严重性、可利用性、影响用户和发布要求。

### 用户安全

- 只从 BlexAgent 官方下载位置安装发行包。
- 公开 Windows 与 macOS 发行包必须完成平台签名，macOS 还必须完成 Apple 公证；
  安装前请验证发布者与签名。
- 保护 `~/.blexagent/`、工作区、API Key、机器人凭据和供应商账户；疑似泄露后立即撤销。
- 启用工具、MCP、插件、Channel 或工作区权限前先审查，并及时更新应用和操作系统。
