# BlexAgent Internal Development Guide

This guide is for employees, contractors, and other contributors explicitly authorized by 杭州波粒二象文化科技有限公司. BlexAgent is proprietary software; this document does not invite public source contributions.

Start with the repository `CLAUDE.md`, `AGENTS.md`, [CONTRIBUTING.md](../../CONTRIBUTING.md), and the architecture document matching the changed subsystem.

## Technology stack

| Layer | Technology |
| --- | --- |
| Desktop | Tauri v2 and Rust |
| Renderer | React 19, TypeScript, Vite, Tailwind CSS |
| Sidecar | Bundled Node.js v24 and Claude Agent SDK |
| Communication | Tauri IPC and Rust HTTP/SSE proxy |
| Integrations | MCP, Skills, reviewed OpenClaw plugins, Feishu, DingTalk |
| Search | Tantivy and tantivy-jieba |

The supported product Agent runtime is the built-in Claude Agent SDK. The internal `blexagent` administration CLI is a product-control surface used by trusted application processes and bundled system Skills; it is not a user-selectable AI runtime.

## Repository layout

```text
src/renderer/                 React renderer
src/server/                   Node.js Sidecar
src/server/plugin-bridge/     reviewed OpenClaw plugin bridge
src/cli/                      internal blexagent administration CLI
src/shared/                   cross-process types and pure helpers
src-tauri/                    Tauri and Rust application layer
agenthub/                     curated offline AgentHub catalogue
bundled-agents/               built-in Agents
bundled-skills/               built-in Skills
specs/                        architecture, design, legal, and release documents
```

## Setup

This repository is private. Clone it only through a Company-authorized account and device. Do not copy the repository URL or source into public support material.

Requirements:

- Node.js `>=22`; the repository declares its npm package-manager version.
- Rust through `rustup`; the repository `rust-toolchain.toml` pins the build toolchain.
- macOS 13+, Windows 10+, or the Linux environment documented by the build guide.

Use the existing repository setup and build scripts. Do not install global tooling or change machine-wide configuration unless the task explicitly requires and approves it.

## Verification

Run checks according to the changed surface:

```text
npm run typecheck
npm run lint
npm run test:classification
npm run test:unit
npm run test:dom
npm run test:integration
```

Rust changes also require the pinned-toolchain formatting, test, and clippy commands documented in `CLAUDE.md`. Dependency changes require `npm run legal:third-party` and review of the generated notices.

Credentialed provider tests are explicit local checks and must never use customer credentials or enter default CI.

## Releases

Preview, internal, and formal releases are different channels. Only the protected formal workflow may produce a generally available commercial release. Follow [commercial-release.md](../../specs/guides/commercial-release.md) for Windows signing, Apple Developer ID signing and notarization, updater signing, provenance, approval, and artifact verification.

Never commit signing keys, certificates, passwords, API credentials, production environment files, or unredacted release logs.
