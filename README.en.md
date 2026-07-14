<div align="center">

# BlexAgent

**A personal desktop Agent that helps turn ideas and information into completed work**

[Website](https://blexagent.com) · [Download](https://blexagent.com) · [Support](SUPPORT.md) · [Security](SECURITY.md) · [Privacy](specs/legal/PRIVACY.md) · [License](LICENSE) · [中文](README.md)

</div>

## About BlexAgent

BlexAgent is an Apache-2.0 open-source desktop Agent developed by 杭州波粒二象文化科技有限公司 (the “Company”). It brings conversations, local workspaces, files, models, tools, tasks, long-term memory, and messaging Channels into one application.

BlexAgent is designed for creators, educators, students, families, knowledge workers, and people who want practical help with everyday work. Users do not need to install or learn command-line AI runtimes. Agent execution is provided through the built-in Claude Agent SDK and controlled through the desktop interface.

The `0.7.x` line is a preview release. Official distribution builds must complete platform code signing, macOS notarization, and update signing. The open-source license does not make every third-party build an official BlexAgent release; verify its source, signature, and checksum.

## Main capabilities

- Local workspaces with file preview, search, references, and reusable Skills.
- Ideas, tasks, recurring schedules, execution history, and review workflows.
- A curated AgentHub for reviewed Agent templates and Skills.
- Curated model selection through Volcengine Agent Plan.
- MCP integrations for authorized tools and data sources.
- Feishu, DingTalk, and reviewed OpenClaw Channel plugins.
- Main-window, helper, floating-window, messaging, and scheduled-task entry points.

BlexAgent works with Volcengine Agent Plan to provide a focused, convenient model experience for creators, educators, and everyday users. The application offers selected models such as Ark Code Latest, Doubao Seed 2.0 Code, and Doubao Seed 2.0 Pro; actual availability is shown inside the application and may differ between preview releases.

## Data and privacy

BlexAgent is local-first: configuration, conversations, tasks, logs, and workspace references are stored on the device by default. When a user enables a model provider, MCP server, website, Feishu, DingTalk, or a plugin, the prompt, context, files, messages, or metadata required for that action may be sent to the selected third party.

Review permissions and third-party privacy terms before enabling an integration. See the [Privacy Notice](specs/legal/PRIVACY.md) for details.

## Platforms and distribution

- macOS 13 or later. Apple Silicon is the primary preview target.
- Windows 10 or later.

Only install packages obtained from [blexagent.com](https://blexagent.com) or another location explicitly identified by the Company as official. Unsigned, unnotarized, community, internal, and preview packages are not supported official releases.

## Contact

- Product support: [support@blexagent.com](mailto:support@blexagent.com)
- Security reports: [security@blexagent.com](mailto:security@blexagent.com)
- Privacy requests: [privacy@blexagent.com](mailto:privacy@blexagent.com)
- Licensing and legal: [legal@blexagent.com](mailto:legal@blexagent.com)

Do not submit vulnerabilities, credentials, conversations, user data, or other sensitive information through public issues.

## Open-source license and brand

BlexAgent-owned source and object code is licensed under the [Apache License 2.0](LICENSE). Attribution information is provided in [NOTICE](NOTICE), and third-party components remain under the licenses listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Terms accompanying an official build do not restrict rights already granted by Apache-2.0.

The BlexAgent name and logo belong to the Company. Apache-2.0 does not grant trademark rights, and community builds must not imply that they are Company-signed official releases. See the [Trademark Policy](TRADEMARKS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
