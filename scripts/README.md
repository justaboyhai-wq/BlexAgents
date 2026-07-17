# Project scripts

This directory contains repeatable build, validation, generation, and cleanup entry points. Hardware and protocol diagnostics live under `tools/` so they cannot be mistaken for production build steps.

## Main groups

- **Build/runtime provisioning**: `download_nodejs.sh`, `download_cuse.*`, `ensure_*`, `setup-tsx-runtime.mjs`, and `windows-build-helpers.ps1`.
- **Bundling/generation**: `esbuild-bundle.mjs`, `generate-*`, `apply-default-workspace-branding.mjs`, and `sync-version.js`.
- **Validation**: `validate-*`, `check-test-classification.mjs`, `test-windows-build-scripts.ps1`, and `verify-macos-distribution.sh`.
- **Cleanup**: `npm run clean` removes generated build/cache/temp output while preserving bundled runtimes and packaging resources. `npm run clean:all` additionally removes `node_modules` and generated `src-tauri` resources; rerun the platform setup/build entry point (`setup_windows.ps1`, `setup.sh`, or the relevant platform build script) before developing or packaging afterward. Use `node scripts/clean-generated.mjs --dry-run` to preview the default cleanup, or add `--resources --dependencies` to preview the full cleanup.

Packet captures are treated as disposable only at the repository root. Diagnostic captures stored under `tools/` are neither ignored nor recursively removed.

Keep one-off migration, packet-capture, and UI prototype files outside this directory. Retained PowerShell scripts use UTF-8 with BOM for Windows PowerShell 5.1 compatibility.
