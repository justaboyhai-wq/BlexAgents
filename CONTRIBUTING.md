# Contributing to BlexAgent

Thank you for helping improve BlexAgent. The project is developed in public
under the Apache License, Version 2.0. Contributions are welcome from users,
creators, educators, designers, security researchers, and developers.

## Before opening an issue or pull request

- Search existing issues and pull requests before creating a duplicate.
- Do not post credentials, private conversations, personal data, signing
  material, or unredacted logs. Report vulnerabilities through
  [SECURITY.md](SECURITY.md), not a public issue.
- Discuss large product, architecture, persistence, security, privacy, or
  dependency changes before investing in an implementation.
- AgentHub templates and Skills must also satisfy
  [AGENTHUB_CONTENT_POLICY.md](AGENTHUB_CONTENT_POLICY.md) and preserve their
  source and license attribution.

## Contribution license and provenance

Unless you explicitly mark a submission as “Not a Contribution”, a contribution
intentionally submitted for inclusion in BlexAgent is provided under Section 5
of Apache License 2.0, without additional terms. You must have the right to
submit it.

Record the origin and license of third-party code, packages, fonts, images,
screenshots, templates, datasets, prompts, and generated assets. AI-assisted
changes require the same human review, testing, and provenance checks as other
changes. Do not submit material copied from an incompatible or unknown source.

The Apache license does not grant permission to use the BlexAgent name or logo
to represent a fork as an official release. Descriptive references to the
project and preservation of required notices remain permitted.

## Development workflow

1. Read `AGENTS.md`, `CLAUDE.md`, and the architecture document named by the
   changed subsystem.
2. Create a focused branch from the current default branch.
3. Reuse existing project patterns and keep unrelated local changes untouched.
4. Add or update tests and documentation for changed behavior.
5. Use Conventional Commits and explain the product or engineering reason.
6. Open a pull request describing behavior, verification, compatibility impact,
   security or privacy considerations, and rollback steps when relevant.

Maintainers may request changes, split an oversized pull request, or decline a
change that conflicts with the product direction, safety requirements, or
maintainability goals.

## Required verification

Run the narrowest relevant check first. The normal baseline is:

```text
npm run typecheck
npm run lint
npm run test:classification
npm run test:unit
```

Also run `npm run test:dom` for renderer changes, `npm run test:integration`
for shared contracts and runtime boundaries, and the repository Rust test and
clippy commands for Rust changes. Dependency changes require
`npm run legal:third-party` and manual review of the generated notices.

## Releases and secrets

Only maintainers publish official BlexAgent installers. Official Windows and
macOS artifacts are distinguished by Company-controlled signing identities,
not by a different source-code license. Never commit API keys, tokens,
certificates, private keys, certificate passwords, production environment
files, customer data, or unredacted support logs.

Unsigned, ad-hoc-signed, or unnotarized artifacts must be labelled as community
or test builds and must not be represented as official releases.

## Community

All participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Use [SUPPORT.md](SUPPORT.md) for product support and [SECURITY.md](SECURITY.md)
for private vulnerability reporting.
