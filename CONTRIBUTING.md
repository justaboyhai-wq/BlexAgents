# BlexAgent Internal Development and Authorized Contribution Policy

BlexAgent is proprietary commercial software owned by 杭州波粒二象文化科技有限公司 (the “Company”). This private repository does not accept public pull requests, public forks, redistribution, or unsolicited source-code contributions.

Only employees, contractors, and other people with explicit repository access and a current written agreement covering confidentiality and intellectual-property ownership may submit changes. AgentHub template and Skill submissions follow a separate content-review process and do not grant access to this source repository.

## Authorization and confidentiality

- Treat source code, product plans, unreleased builds, credentials, signing material, customer information, user data, support cases, and internal discussions as confidential.
- Do not copy repository content into public issues, paste sites, personal repositories, or AI services that the Company has not approved for confidential source code.
- Never commit API keys, tokens, certificates, private keys, passwords, production environment files, customer data, or unredacted logs.
- Use only Company-approved accounts, devices, repositories, build systems, and release channels.
- Access ends when the related employment, contractor, or written authorization ends. Return or securely destroy copies when directed.

## Intellectual property and provenance

- Changes submitted to this repository must be owned by the Company or covered by a written assignment or license that permits the intended proprietary distribution.
- Record the origin and license of third-party code, packages, fonts, images, screenshots, templates, datasets, prompts, and generated assets before they are committed or shipped.
- AI-assisted changes require the same human review, testing, provenance, confidentiality, and license checks as manually written work. Do not assume generated material is original or safe to distribute.
- Dependency changes must update `THIRD_PARTY_NOTICES.md` through the repository's legal tooling and review every unknown, copyleft, custom, or non-standard license entry.
- AgentHub content must satisfy [AGENTHUB_CONTENT_POLICY.md](AGENTHUB_CONTENT_POLICY.md) and, when submitted externally, a signed content submission agreement.

## Development workflow

1. Work from a tracked internal issue or approved task with an identifiable owner.
2. Create a short-lived branch; do not develop directly on a protected release branch.
3. Inspect the current implementation and applicable architecture documents before editing.
4. Keep the change scoped and preserve unrelated user or collaborator work.
5. Add or update tests, technical documentation, privacy disclosures, support guidance, and third-party notices when behavior changes.
6. Use Conventional Commits with a message that explains the product or engineering reason for the change.
7. Obtain review before merging. Security, privacy, authentication, signing, release, licensing, data migration, and dependency changes require the responsible owner’s approval.
8. Document rollback or recovery steps for migrations, persistent-data changes, updater changes, and high-risk infrastructure changes.

## Required verification

Run the narrowest relevant check first, then the repository checks required by the changed surfaces. The default baseline is:

```text
npm run typecheck
npm run lint
npm run test:classification
npm run test:unit
```

Also run:

- `npm run test:dom` for renderer components and browser-like behavior.
- `npm run test:integration` for Sidecar, shared contracts, persistence, runtime, IO, and security boundaries.
- `cargo test --manifest-path src-tauri/Cargo.toml` and the repository clippy command for Rust changes.
- `npm run legal:third-party` for dependency changes.
- Signing, notarization, installer, and updater verification for release changes.

Do not weaken assertions, skip deterministic tests, or use real customer data and production credentials to make a test pass.

## Releases

Only the protected formal release workflow may produce a generally available commercial release. It must satisfy the checklist in `specs/guides/commercial-release.md`, including platform code signing, macOS notarization, updater signing, provenance checks, legal-document validation, and approval.

Unsigned, ad-hoc-signed, unnotarized, or otherwise incomplete artifacts are internal or preview test material and must be clearly labelled. They must not be presented as a generally available commercial release.

## Conduct, security, and support

- Team conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- Product support: [SUPPORT.md](SUPPORT.md)
- Internal development guide: [docs/internal/DEVELOPMENT.md](docs/internal/DEVELOPMENT.md)

Internal development contact: team@blexagent.com
