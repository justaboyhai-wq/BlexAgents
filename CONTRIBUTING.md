# BlexAgent Internal Development Policy

BlexAgent is proprietary commercial software. This repository is not accepting
public pull requests, forks, redistribution, or source-code contributions. Only
people with explicit repository access and a current written employment,
contractor, or contribution agreement may submit changes.

## Authorization and confidentiality

- Treat source code, product plans, unreleased builds, credentials, signing
  material, customer data, and internal discussions as confidential.
- Do not copy repository content into public issues, paste sites, public AI
  tools, or personal repositories.
- Do not commit API keys, tokens, certificates, private keys, passwords, user
  data, or production `.env` files.
- Third-party code and assets require license and provenance review before they
  are committed or shipped.

## Development workflow

1. Work from a tracked internal issue or approved task.
2. Create a short-lived branch; do not develop directly on the protected branch.
3. Reuse existing architecture and keep changes scoped.
4. Update tests, technical documentation, privacy disclosures, and third-party
   notices when the behavior or dependency graph changes.
5. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
   `build:`, `chore:`).
6. Obtain review before merging. Security, privacy, authentication, release, and
   licensing changes require an owner review.

## Required checks

Run the narrowest relevant checks first, then at least:

```text
npm run typecheck
npm run lint
npm run test:classification
npm run test:unit
```

Also run `npm run test:dom` for renderer changes, `npm run test:integration` for
backend or shared-contract changes, and `cargo test` plus clippy for Rust changes.
Dependency changes must run `npm run legal:third-party` and review every
`UNKNOWN`, copyleft, custom, and `SEE LICENSE IN ...` entry.

## Releases

Only the protected formal release workflow may produce a public commercial
release. It must use platform code signing, macOS notarization, Tauri updater
signing, provenance checks, and the release checklist in
`specs/guides/commercial-release.md`. Unsigned artifacts are internal testing
material and must never be presented as a public release.

Contact: team@blexagent.com
