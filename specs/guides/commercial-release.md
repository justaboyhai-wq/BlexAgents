# BlexAgent Official Release Guide

This is the release runbook for Company-signed builds of the Apache-2.0 project. Official release
artifacts must be signed, notarized where required, updater-signed, checksummed,
and approved. Ad-hoc signed, unnotarized artifacts are internal test material
only and cannot replace a Developer ID release.

## 1. One-time ownership decisions

Before the first official release, the owner must provide and have counsel
approve:

- registered licensor/controller legal name and address;
- governing law, dispute venue, consumer terms, refund/subscription terms;
- privacy request process, retention periods, subprocessors, transfer terms;
- trademark ownership and the exact publisher name shown in certificates.

Replace the release-gate paragraphs in `specs/legal/OFFICIAL_DISTRIBUTION_TERMS.md` and
`specs/legal/PRIVACY.md`. The formal workflow intentionally fails while those
paragraphs remain.

## 2. Windows Authenticode

1. Purchase an organization-validated or extended-validation code-signing
   certificate from a CA trusted by Windows. The certificate subject must match
   the approved publisher identity. Hardware-backed or cloud signing may require
   adapting the current PFX import step.
2. Export a CI-appropriate PFX only if the CA and organizational policy permit
   it. Never commit the PFX or password.
3. Add the base64-encoded PFX and password to the protected GitHub Environment
   `production-release` as `WINDOWS_CERTIFICATE_PFX_BASE64` and
   `WINDOWS_CERTIFICATE_PASSWORD`.
4. The workflow imports the certificate into the ephemeral runner, injects only
   its thumbprint into a temporary Tauri config, applies an RFC 3161 timestamp,
   builds with `-RequireSigning`, and verifies the resulting installer signature.

Local verification:

```powershell
Get-AuthenticodeSignature -LiteralPath '.\BlexAgent_x64-setup.exe' | Format-List
Get-FileHash -Algorithm SHA256 -LiteralPath '.\BlexAgent_x64-setup.exe'
```

Expected status is `Valid`, with the approved publisher subject and a timestamp.

## 3. Apple Developer ID and notarization

1. Enroll the legal organization in the Apple Developer Program. The Account
   Holder creates a **Developer ID Application** certificate for direct
   distribution outside the Mac App Store.
2. Export the certificate/private key to a password-protected `.p12` and create
   an App Store Connect API key authorized for notarization.
3. Store the following only in the protected `production-release` environment:
   `APPLE_CERTIFICATE_P12_BASE64`, `APPLE_CERTIFICATE_PASSWORD`,
   `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_ISSUER`,
   `APPLE_API_KEY`, and `APPLE_API_KEY_P8_BASE64`.
4. The workflow creates an ephemeral keychain, signs with hardened runtime,
   submits using `notarytool`, waits for acceptance, staples the ticket, and runs
   signature/Gatekeeper verification through `build_macos.sh`.

Local verification on each architecture:

```bash
codesign --verify --deep --strict --verbose=2 BlexAgent.app
spctl --assess --type execute --verbose=4 BlexAgent.app
xcrun stapler validate BlexAgent.dmg
```

## 4. Tauri updater signing

Generate the updater key pair on an isolated trusted machine using the Tauri CLI.
Store the private key and password only as `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in `production-release`. The public key in
`src-tauri/tauri.conf.json` must be reviewed and intentionally replaced if a new
key pair is created. Archive the old private key securely while users still run
versions that trust it; an accidental key loss breaks the trusted update path.

Never publish an update manifest with an empty signature. Never use the internal
ad-hoc workflow to populate `download.blexagent.com/update/`.

## 5. GitHub protection and secrets

The repository has a GitHub Environment named `production-release`, restricted
to the `main` branch and `v*` tags. Add required reviewers when the repository's
GitHub billing plan supports private-repository environment approvals, then add
all signing secrets. The formal workflow is fail-closed: missing secrets,
version mismatches, legal placeholders, signing failures, notarization failures,
or missing artifacts stop the release.

The manual `Internal Package · Ad-hoc macOS` workflow has seven-day retention,
contains `INTERNAL-ADHOC-UNNOTARIZED` in its artifact name, and must not be
linked from a public download page. It runs the same nested-code and DMG
integrity checks as the release path, but Gatekeeper approval remains manual
because the artifact has no Apple notarization ticket.

The manual `Official Preview · Notarized macOS ARM64` workflow is the preferred
test channel for non-technical testers. It requires the production Apple and
updater signing secrets, builds only Apple Silicon, performs notarization and
Gatekeeper verification, and uploads a short-lived Actions artifact without
creating a GitHub Release.

## 6. Per-release checklist

1. Confirm the working tree is clean and the intended commit is reviewed.
2. Update `CHANGELOG.md`; synchronize versions in npm, Cargo, and Tauri.
3. Run `npm ci`, `npm run legal:third-party`, and manually review every unknown,
   custom, copyleft, and `SEE LICENSE IN ...` entry.
4. Run typecheck, lint, classification, unit, DOM, integration, Rust tests, and
   clippy. Test real IM/provider flows with dedicated non-production credentials.
5. Confirm analytics remains off unless the event registry, endpoint, consent
   requirements, and privacy notice have received release-specific approval.
6. Dispatch `Release` with the exact semver or push the protected `vX.Y.Z` tag.
7. Verify Windows publisher/timestamp, Apple signature/notarization/staple,
   updater signatures, filenames, version, and SHA-256 values on clean machines.
8. Promote only approved Company-signed artifacts to the official download/CDN path. Community builds remain permitted by Apache-2.0 but must not be presented as official releases.
9. Verify every update manifest and download URL from outside the build network.
10. Retain checksums, workflow URL, commit, tag, certificate identity, notarization
    submission ID, approvals, and a rollback record.

## 7. Directory policy

- Source, tests, and maintained product resources stay in their current tracked
  directories.
- `dist/`, `src-tauri/target/`, `mino/`, `artifacts/`, and `release-artifacts/`
  are local/generated and ignored.
- Formal CI artifacts live in the workflow and approved release storage, not in
  Git history.
- Do not rename compatibility paths such as `mino/` without a migration; a tidy
  directory name is not worth breaking existing installations.
