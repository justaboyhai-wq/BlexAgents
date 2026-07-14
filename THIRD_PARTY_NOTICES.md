# BlexAgent Third-Party Notices

Generated from `package-lock.json` and `src-tauri/Cargo.lock`. Run
`npm run legal:third-party` after changing dependencies. This inventory is a
compliance aid, not a replacement for the complete license files supplied by
each upstream component.

BlexAgent-owned material is available under Apache License 2.0. The third-party
components below remain under their respective licenses. Copyright
notices and license texts shipped inside dependency packages, bundled skills,
runtime distributions, templates, and default-workspace resources must be
preserved.

## Bundled resources with separate notices

- **OpenMino default workspace** — MIT; attribution is preserved in
  `branding/default-workspace/OPENMINO_NOTICE.md` and copied into the bundled
  workspace.
- **AgentHub reviewed templates** — upstream attribution and pinned source
  information live in each `agenthub/templates/*/ATTRIBUTIONS.md`; corresponding
  MIT texts live under `agenthub/licenses/`.
- **Bundled document, spreadsheet, presentation, PDF, pet, and skill-creator
  skills** — their license files live beside the relevant skill under
  `bundled-skills/*/LICENSE.txt`.
- **Bundled Node.js runtime** — Node.js and its included dependencies retain the
  notices shipped in `src-tauri/resources/nodejs/LICENSE` and the runtime's own
  distribution.
- **Claude Agent SDK** — Anthropic's SDK and platform-specific packages use the
  license files shipped in their npm packages. Provider service use is also
  subject to Anthropic's applicable service terms.
- **SheetJS xlsx** — distributed from SheetJS CDN at the version pinned in
  `package-lock.json`; its package license and notices must remain intact.

## Review status

- npm package records: 1064
- Rust crate records: 863
- Records without a machine-readable license declaration: 0

No missing machine-readable license declarations were found.

Packages declaring LGPL, GPL, MPL, CC, custom, or `SEE LICENSE IN ...` terms
require release-by-release review to confirm that the shipped form and notice
delivery satisfy those terms. An official release must not proceed on
the generated table alone.

## npm production and build dependency inventory

| Package                                           | Version       | Declared license                         |
| ------------------------------------------------- | ------------- | ---------------------------------------- |
| @adobe/css-tools                                  | 4.5.0         | MIT                                      |
| @aiden0z/pptx-renderer                            | 1.0.2         | Apache-2.0                               |
| @ampproject/remapping                             | 2.3.0         | Apache-2.0                               |
| @antfu/install-pkg                                | 1.1.0         | MIT                                      |
| @anthropic-ai/claude-agent-sdk                    | 0.3.201       | SEE LICENSE IN README.md                 |
| @anthropic-ai/claude-agent-sdk-darwin-arm64       | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/claude-agent-sdk-darwin-x64         | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/claude-agent-sdk-linux-arm64        | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/claude-agent-sdk-linux-arm64-musl   | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/claude-agent-sdk-linux-x64          | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/claude-agent-sdk-linux-x64-musl     | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/claude-agent-sdk-win32-arm64        | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/claude-agent-sdk-win32-x64          | 0.3.201       | SEE LICENSE IN LICENSE.md                |
| @anthropic-ai/sdk                                 | 0.100.1       | MIT                                      |
| @asamuzakjp/css-color                             | 4.1.2         | MIT                                      |
| @asamuzakjp/dom-selector                          | 6.8.1         | MIT                                      |
| @asamuzakjp/nwsapi                                | 2.3.9         | MIT                                      |
| @babel/code-frame                                 | 7.27.1        | MIT                                      |
| @babel/compat-data                                | 7.28.5        | MIT                                      |
| @babel/core                                       | 7.28.5        | MIT                                      |
| @babel/generator                                  | 7.28.5        | MIT                                      |
| @babel/helper-compilation-targets                 | 7.27.2        | MIT                                      |
| @babel/helper-globals                             | 7.28.0        | MIT                                      |
| @babel/helper-module-imports                      | 7.27.1        | MIT                                      |
| @babel/helper-module-transforms                   | 7.28.3        | MIT                                      |
| @babel/helper-plugin-utils                        | 7.27.1        | MIT                                      |
| @babel/helper-string-parser                       | 7.27.1        | MIT                                      |
| @babel/helper-validator-identifier                | 7.28.5        | MIT                                      |
| @babel/helper-validator-option                    | 7.27.1        | MIT                                      |
| @babel/helpers                                    | 7.28.4        | MIT                                      |
| @babel/parser                                     | 7.28.5        | MIT                                      |
| @babel/plugin-transform-react-jsx-self            | 7.27.1        | MIT                                      |
| @babel/plugin-transform-react-jsx-source          | 7.27.1        | MIT                                      |
| @babel/runtime                                    | 7.29.7        | MIT                                      |
| @babel/template                                   | 7.27.2        | MIT                                      |
| @babel/traverse                                   | 7.28.5        | MIT                                      |
| @babel/types                                      | 7.28.5        | MIT                                      |
| @bcoe/v8-coverage                                 | 1.0.2         | MIT                                      |
| @braintree/sanitize-url                           | 7.1.2         | MIT                                      |
| @chevrotain/types                                 | 11.1.2        | Apache-2.0                               |
| @csstools/color-helpers                           | 6.0.2         | MIT-0                                    |
| @csstools/css-calc                                | 3.2.1         | MIT                                      |
| @csstools/css-color-parser                        | 4.1.1         | MIT                                      |
| @csstools/css-parser-algorithms                   | 4.0.0         | MIT                                      |
| @csstools/css-syntax-patches-for-csstree          | 1.1.4         | MIT-0                                    |
| @csstools/css-tokenizer                           | 4.0.0         | MIT                                      |
| @dnd-kit/accessibility                            | 3.1.1         | MIT                                      |
| @dnd-kit/core                                     | 6.3.1         | MIT                                      |
| @dnd-kit/sortable                                 | 10.0.0        | MIT                                      |
| @dnd-kit/utilities                                | 3.2.2         | MIT                                      |
| @emnapi/core                                      | 1.6.0         | MIT                                      |
| @emnapi/runtime                                   | 1.11.1        | MIT                                      |
| @emnapi/runtime                                   | 1.6.0         | MIT                                      |
| @emnapi/wasi-threads                              | 1.1.0         | MIT                                      |
| @esbuild/aix-ppc64                                | 0.25.12       | MIT                                      |
| @esbuild/aix-ppc64                                | 0.27.7        | MIT                                      |
| @esbuild/android-arm                              | 0.25.12       | MIT                                      |
| @esbuild/android-arm                              | 0.27.7        | MIT                                      |
| @esbuild/android-arm64                            | 0.25.12       | MIT                                      |
| @esbuild/android-arm64                            | 0.27.7        | MIT                                      |
| @esbuild/android-x64                              | 0.25.12       | MIT                                      |
| @esbuild/android-x64                              | 0.27.7        | MIT                                      |
| @esbuild/darwin-arm64                             | 0.25.12       | MIT                                      |
| @esbuild/darwin-arm64                             | 0.27.7        | MIT                                      |
| @esbuild/darwin-x64                               | 0.25.12       | MIT                                      |
| @esbuild/darwin-x64                               | 0.27.7        | MIT                                      |
| @esbuild/freebsd-arm64                            | 0.25.12       | MIT                                      |
| @esbuild/freebsd-arm64                            | 0.27.7        | MIT                                      |
| @esbuild/freebsd-x64                              | 0.25.12       | MIT                                      |
| @esbuild/freebsd-x64                              | 0.27.7        | MIT                                      |
| @esbuild/linux-arm                                | 0.25.12       | MIT                                      |
| @esbuild/linux-arm                                | 0.27.7        | MIT                                      |
| @esbuild/linux-arm64                              | 0.25.12       | MIT                                      |
| @esbuild/linux-arm64                              | 0.27.7        | MIT                                      |
| @esbuild/linux-ia32                               | 0.25.12       | MIT                                      |
| @esbuild/linux-ia32                               | 0.27.7        | MIT                                      |
| @esbuild/linux-loong64                            | 0.25.12       | MIT                                      |
| @esbuild/linux-loong64                            | 0.27.7        | MIT                                      |
| @esbuild/linux-mips64el                           | 0.25.12       | MIT                                      |
| @esbuild/linux-mips64el                           | 0.27.7        | MIT                                      |
| @esbuild/linux-ppc64                              | 0.25.12       | MIT                                      |
| @esbuild/linux-ppc64                              | 0.27.7        | MIT                                      |
| @esbuild/linux-riscv64                            | 0.25.12       | MIT                                      |
| @esbuild/linux-riscv64                            | 0.27.7        | MIT                                      |
| @esbuild/linux-s390x                              | 0.25.12       | MIT                                      |
| @esbuild/linux-s390x                              | 0.27.7        | MIT                                      |
| @esbuild/linux-x64                                | 0.25.12       | MIT                                      |
| @esbuild/linux-x64                                | 0.27.7        | MIT                                      |
| @esbuild/netbsd-arm64                             | 0.25.12       | MIT                                      |
| @esbuild/netbsd-arm64                             | 0.27.7        | MIT                                      |
| @esbuild/netbsd-x64                               | 0.25.12       | MIT                                      |
| @esbuild/netbsd-x64                               | 0.27.7        | MIT                                      |
| @esbuild/openbsd-arm64                            | 0.25.12       | MIT                                      |
| @esbuild/openbsd-arm64                            | 0.27.7        | MIT                                      |
| @esbuild/openbsd-x64                              | 0.25.12       | MIT                                      |
| @esbuild/openbsd-x64                              | 0.27.7        | MIT                                      |
| @esbuild/openharmony-arm64                        | 0.25.12       | MIT                                      |
| @esbuild/openharmony-arm64                        | 0.27.7        | MIT                                      |
| @esbuild/sunos-x64                                | 0.25.12       | MIT                                      |
| @esbuild/sunos-x64                                | 0.27.7        | MIT                                      |
| @esbuild/win32-arm64                              | 0.25.12       | MIT                                      |
| @esbuild/win32-arm64                              | 0.27.7        | MIT                                      |
| @esbuild/win32-ia32                               | 0.25.12       | MIT                                      |
| @esbuild/win32-ia32                               | 0.27.7        | MIT                                      |
| @esbuild/win32-x64                                | 0.25.12       | MIT                                      |
| @esbuild/win32-x64                                | 0.27.7        | MIT                                      |
| @eslint-community/eslint-utils                    | 4.9.0         | MIT                                      |
| @eslint-community/regexpp                         | 4.12.2        | MIT                                      |
| @eslint/compat                                    | 2.0.0         | Apache-2.0                               |
| @eslint/config-array                              | 0.21.1        | Apache-2.0                               |
| @eslint/config-helpers                            | 0.4.2         | Apache-2.0                               |
| @eslint/core                                      | 0.17.0        | Apache-2.0                               |
| @eslint/core                                      | 1.0.0         | Apache-2.0                               |
| @eslint/eslintrc                                  | 3.3.1         | MIT                                      |
| @eslint/js                                        | 9.39.1        | MIT                                      |
| @eslint/object-schema                             | 2.1.7         | Apache-2.0                               |
| @eslint/plugin-kit                                | 0.4.1         | Apache-2.0                               |
| @floating-ui/core                                 | 1.7.5         | MIT                                      |
| @floating-ui/dom                                  | 1.7.6         | MIT                                      |
| @floating-ui/react                                | 0.27.19       | MIT                                      |
| @floating-ui/react-dom                            | 2.1.8         | MIT                                      |
| @floating-ui/utils                                | 0.2.11        | MIT                                      |
| @hono/node-server                                 | 1.19.14       | MIT                                      |
| @hono/node-server                                 | 2.0.0         | MIT                                      |
| @humanfs/core                                     | 0.19.1        | Apache-2.0                               |
| @humanfs/node                                     | 0.16.7        | Apache-2.0                               |
| @humanwhocodes/module-importer                    | 1.0.1         | Apache-2.0                               |
| @humanwhocodes/retry                              | 0.4.3         | Apache-2.0                               |
| @ianvs/prettier-plugin-sort-imports               | 4.7.0         | Apache-2.0                               |
| @iconify/types                                    | 2.0.0         | MIT                                      |
| @iconify/utils                                    | 3.1.0         | MIT                                      |
| @img/colour                                       | 1.1.0         | MIT                                      |
| @img/sharp-darwin-arm64                           | 0.34.5        | Apache-2.0                               |
| @img/sharp-darwin-x64                             | 0.34.5        | Apache-2.0                               |
| @img/sharp-libvips-darwin-arm64                   | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-darwin-x64                     | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linux-arm                      | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linux-arm64                    | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linux-ppc64                    | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linux-riscv64                  | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linux-s390x                    | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linux-x64                      | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linuxmusl-arm64                | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-libvips-linuxmusl-x64                  | 1.2.4         | LGPL-3.0-or-later                        |
| @img/sharp-linux-arm                              | 0.34.5        | Apache-2.0                               |
| @img/sharp-linux-arm64                            | 0.34.5        | Apache-2.0                               |
| @img/sharp-linux-ppc64                            | 0.34.5        | Apache-2.0                               |
| @img/sharp-linux-riscv64                          | 0.34.5        | Apache-2.0                               |
| @img/sharp-linux-s390x                            | 0.34.5        | Apache-2.0                               |
| @img/sharp-linux-x64                              | 0.34.5        | Apache-2.0                               |
| @img/sharp-linuxmusl-arm64                        | 0.34.5        | Apache-2.0                               |
| @img/sharp-linuxmusl-x64                          | 0.34.5        | Apache-2.0                               |
| @img/sharp-wasm32                                 | 0.34.5        | Apache-2.0 AND LGPL-3.0-or-later AND MIT |
| @img/sharp-win32-arm64                            | 0.34.5        | Apache-2.0 AND LGPL-3.0-or-later         |
| @img/sharp-win32-ia32                             | 0.34.5        | Apache-2.0 AND LGPL-3.0-or-later         |
| @img/sharp-win32-x64                              | 0.34.5        | Apache-2.0 AND LGPL-3.0-or-later         |
| @isaacs/cliui                                     | 8.0.2         | ISC                                      |
| @istanbuljs/schema                                | 0.1.6         | MIT                                      |
| @jridgewell/gen-mapping                           | 0.3.13        | MIT                                      |
| @jridgewell/remapping                             | 2.3.5         | MIT                                      |
| @jridgewell/resolve-uri                           | 3.1.2         | MIT                                      |
| @jridgewell/sourcemap-codec                       | 1.5.5         | MIT                                      |
| @jridgewell/trace-mapping                         | 0.3.31        | MIT                                      |
| @kurkle/color                                     | 0.3.4         | MIT                                      |
| @larksuiteoapi/node-sdk                           | 1.70.0        | MIT                                      |
| @mermaid-js/parser                                | 1.2.0         | MIT                                      |
| @modelcontextprotocol/sdk                         | 1.29.0        | MIT                                      |
| @monaco-editor/loader                             | 1.7.0         | MIT                                      |
| @monaco-editor/react                              | 4.7.0         | MIT                                      |
| @napi-rs/canvas                                   | 0.1.100       | MIT                                      |
| @napi-rs/canvas-android-arm64                     | 0.1.100       | MIT                                      |
| @napi-rs/canvas-darwin-arm64                      | 0.1.100       | MIT                                      |
| @napi-rs/canvas-darwin-x64                        | 0.1.100       | MIT                                      |
| @napi-rs/canvas-linux-arm-gnueabihf               | 0.1.100       | MIT                                      |
| @napi-rs/canvas-linux-arm64-gnu                   | 0.1.100       | MIT                                      |
| @napi-rs/canvas-linux-arm64-musl                  | 0.1.100       | MIT                                      |
| @napi-rs/canvas-linux-riscv64-gnu                 | 0.1.100       | MIT                                      |
| @napi-rs/canvas-linux-x64-gnu                     | 0.1.100       | MIT                                      |
| @napi-rs/canvas-linux-x64-musl                    | 0.1.100       | MIT                                      |
| @napi-rs/canvas-win32-arm64-msvc                  | 0.1.100       | MIT                                      |
| @napi-rs/canvas-win32-x64-msvc                    | 0.1.100       | MIT                                      |
| @napi-rs/wasm-runtime                             | 1.0.7         | MIT                                      |
| @pkgjs/parseargs                                  | 0.11.0        | MIT                                      |
| @protobufjs/aspromise                             | 1.1.2         | BSD-3-Clause                             |
| @protobufjs/base64                                | 1.1.2         | BSD-3-Clause                             |
| @protobufjs/codegen                               | 2.0.5         | BSD-3-Clause                             |
| @protobufjs/eventemitter                          | 1.1.1         | BSD-3-Clause                             |
| @protobufjs/fetch                                 | 1.1.1         | BSD-3-Clause                             |
| @protobufjs/float                                 | 1.0.2         | BSD-3-Clause                             |
| @protobufjs/path                                  | 1.1.2         | BSD-3-Clause                             |
| @protobufjs/pool                                  | 1.1.0         | BSD-3-Clause                             |
| @protobufjs/utf8                                  | 1.1.2         | BSD-3-Clause                             |
| @rolldown/pluginutils                             | 1.0.0-beta.47 | MIT                                      |
| @rollup/rollup-android-arm-eabi                   | 4.53.3        | MIT                                      |
| @rollup/rollup-android-arm64                      | 4.53.3        | MIT                                      |
| @rollup/rollup-darwin-arm64                       | 4.53.3        | MIT                                      |
| @rollup/rollup-darwin-x64                         | 4.53.3        | MIT                                      |
| @rollup/rollup-freebsd-arm64                      | 4.53.3        | MIT                                      |
| @rollup/rollup-freebsd-x64                        | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-arm-gnueabihf                | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-arm-musleabihf               | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-arm64-gnu                    | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-arm64-musl                   | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-loong64-gnu                  | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-ppc64-gnu                    | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-riscv64-gnu                  | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-riscv64-musl                 | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-s390x-gnu                    | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-x64-gnu                      | 4.53.3        | MIT                                      |
| @rollup/rollup-linux-x64-musl                     | 4.53.3        | MIT                                      |
| @rollup/rollup-openharmony-arm64                  | 4.53.3        | MIT                                      |
| @rollup/rollup-win32-arm64-msvc                   | 4.53.3        | MIT                                      |
| @rollup/rollup-win32-ia32-msvc                    | 4.53.3        | MIT                                      |
| @rollup/rollup-win32-x64-gnu                      | 4.53.3        | MIT                                      |
| @rollup/rollup-win32-x64-msvc                     | 4.53.3        | MIT                                      |
| @stablelib/base64                                 | 1.0.1         | MIT                                      |
| @tailwindcss/node                                 | 4.1.17        | MIT                                      |
| @tailwindcss/oxide                                | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-android-arm64                  | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-darwin-arm64                   | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-darwin-x64                     | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-freebsd-x64                    | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-linux-arm-gnueabihf            | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-linux-arm64-gnu                | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-linux-arm64-musl               | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-linux-x64-gnu                  | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-linux-x64-musl                 | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-wasm32-wasi                    | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-win32-arm64-msvc               | 4.1.17        | MIT                                      |
| @tailwindcss/oxide-win32-x64-msvc                 | 4.1.17        | MIT                                      |
| @tailwindcss/vite                                 | 4.1.17        | MIT                                      |
| @tauri-apps/api                                   | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli                                   | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-darwin-arm64                      | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-darwin-x64                        | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-linux-arm-gnueabihf               | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-linux-arm64-gnu                   | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-linux-arm64-musl                  | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-linux-riscv64-gnu                 | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-linux-x64-gnu                     | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-linux-x64-musl                    | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-win32-arm64-msvc                  | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-win32-ia32-msvc                   | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/cli-win32-x64-msvc                    | 2.10.1        | Apache-2.0 OR MIT                        |
| @tauri-apps/plugin-autostart                      | 2.5.1         | MIT OR Apache-2.0                        |
| @tauri-apps/plugin-dialog                         | 2.7.0         | MIT OR Apache-2.0                        |
| @tauri-apps/plugin-fs                             | 2.5.0         | MIT OR Apache-2.0                        |
| @tauri-apps/plugin-process                        | 2.3.1         | MIT OR Apache-2.0                        |
| @tauri-apps/plugin-shell                          | 2.3.4         | MIT OR Apache-2.0                        |
| @tauri-apps/plugin-updater                        | 2.10.0        | MIT OR Apache-2.0                        |
| @testing-library/dom                              | 10.4.1        | MIT                                      |
| @testing-library/jest-dom                         | 6.9.1         | MIT                                      |
| @testing-library/react                            | 16.3.2        | MIT                                      |
| @testing-library/user-event                       | 14.6.1        | MIT                                      |
| @tybys/wasm-util                                  | 0.10.1        | MIT                                      |
| @types/adm-zip                                    | 0.5.7         | MIT                                      |
| @types/aria-query                                 | 5.0.4         | MIT                                      |
| @types/babel\_\_core                              | 7.20.5        | MIT                                      |
| @types/babel\_\_generator                         | 7.27.0        | MIT                                      |
| @types/babel\_\_template                          | 7.4.4         | MIT                                      |
| @types/babel\_\_traverse                          | 7.28.0        | MIT                                      |
| @types/chai                                       | 5.2.3         | MIT                                      |
| @types/d3                                         | 7.4.3         | MIT                                      |
| @types/d3-array                                   | 3.2.2         | MIT                                      |
| @types/d3-axis                                    | 3.0.6         | MIT                                      |
| @types/d3-brush                                   | 3.0.6         | MIT                                      |
| @types/d3-chord                                   | 3.0.6         | MIT                                      |
| @types/d3-color                                   | 3.1.3         | MIT                                      |
| @types/d3-contour                                 | 3.0.6         | MIT                                      |
| @types/d3-delaunay                                | 6.0.4         | MIT                                      |
| @types/d3-dispatch                                | 3.0.7         | MIT                                      |
| @types/d3-drag                                    | 3.0.7         | MIT                                      |
| @types/d3-dsv                                     | 3.0.7         | MIT                                      |
| @types/d3-ease                                    | 3.0.2         | MIT                                      |
| @types/d3-fetch                                   | 3.0.7         | MIT                                      |
| @types/d3-force                                   | 3.0.10        | MIT                                      |
| @types/d3-format                                  | 3.0.4         | MIT                                      |
| @types/d3-geo                                     | 3.1.0         | MIT                                      |
| @types/d3-hierarchy                               | 3.1.7         | MIT                                      |
| @types/d3-interpolate                             | 3.0.4         | MIT                                      |
| @types/d3-path                                    | 3.1.1         | MIT                                      |
| @types/d3-polygon                                 | 3.0.2         | MIT                                      |
| @types/d3-quadtree                                | 3.0.6         | MIT                                      |
| @types/d3-random                                  | 3.0.3         | MIT                                      |
| @types/d3-scale                                   | 4.0.9         | MIT                                      |
| @types/d3-scale-chromatic                         | 3.1.0         | MIT                                      |
| @types/d3-selection                               | 3.0.11        | MIT                                      |
| @types/d3-shape                                   | 3.1.8         | MIT                                      |
| @types/d3-time                                    | 3.0.4         | MIT                                      |
| @types/d3-time-format                             | 4.0.3         | MIT                                      |
| @types/d3-timer                                   | 3.0.2         | MIT                                      |
| @types/d3-transition                              | 3.0.9         | MIT                                      |
| @types/d3-zoom                                    | 3.0.8         | MIT                                      |
| @types/debug                                      | 4.1.12        | MIT                                      |
| @types/deep-eql                                   | 4.0.2         | MIT                                      |
| @types/estree                                     | 1.0.8         | MIT                                      |
| @types/estree-jsx                                 | 1.0.5         | MIT                                      |
| @types/geojson                                    | 7946.0.16     | MIT                                      |
| @types/hast                                       | 3.0.4         | MIT                                      |
| @types/js-yaml                                    | 4.0.9         | MIT                                      |
| @types/json-schema                                | 7.0.15        | MIT                                      |
| @types/katex                                      | 0.16.8        | MIT                                      |
| @types/mdast                                      | 4.0.4         | MIT                                      |
| @types/ms                                         | 2.1.0         | MIT                                      |
| @types/node                                       | 24.10.1       | MIT                                      |
| @types/prismjs                                    | 1.26.5        | MIT                                      |
| @types/qrcode                                     | 1.5.6         | MIT                                      |
| @types/react                                      | 19.2.7        | MIT                                      |
| @types/react-dom                                  | 19.2.3        | MIT                                      |
| @types/react-syntax-highlighter                   | 15.5.13       | MIT                                      |
| @types/trusted-types                              | 2.0.7         | MIT                                      |
| @types/unist                                      | 2.0.11        | MIT                                      |
| @types/unist                                      | 3.0.3         | MIT                                      |
| @typescript-eslint/eslint-plugin                  | 8.48.0        | MIT                                      |
| @typescript-eslint/parser                         | 8.48.0        | MIT                                      |
| @typescript-eslint/project-service                | 8.48.0        | MIT                                      |
| @typescript-eslint/scope-manager                  | 8.48.0        | MIT                                      |
| @typescript-eslint/tsconfig-utils                 | 8.48.0        | MIT                                      |
| @typescript-eslint/type-utils                     | 8.48.0        | MIT                                      |
| @typescript-eslint/types                          | 8.48.0        | MIT                                      |
| @typescript-eslint/typescript-estree              | 8.48.0        | MIT                                      |
| @typescript-eslint/utils                          | 8.48.0        | MIT                                      |
| @typescript-eslint/visitor-keys                   | 8.48.0        | MIT                                      |
| @ungap/structured-clone                           | 1.3.0         | ISC                                      |
| @upsetjs/venn.js                                  | 2.0.0         | MIT                                      |
| @vitejs/plugin-react                              | 5.1.1         | MIT                                      |
| @vitest/coverage-v8                               | 3.2.4         | MIT                                      |
| @vitest/expect                                    | 3.2.4         | MIT                                      |
| @vitest/mocker                                    | 3.2.4         | MIT                                      |
| @vitest/pretty-format                             | 3.2.4         | MIT                                      |
| @vitest/runner                                    | 3.2.4         | MIT                                      |
| @vitest/snapshot                                  | 3.2.4         | MIT                                      |
| @vitest/spy                                       | 3.2.4         | MIT                                      |
| @vitest/utils                                     | 3.2.4         | MIT                                      |
| @xterm/addon-fit                                  | 0.11.0        | MIT                                      |
| @xterm/addon-web-links                            | 0.12.0        | MIT                                      |
| @xterm/xterm                                      | 6.0.0         | MIT                                      |
| accepts                                           | 2.0.0         | MIT                                      |
| acorn                                             | 8.15.0        | MIT                                      |
| acorn-jsx                                         | 5.3.2         | MIT                                      |
| acorn-jsx-walk                                    | 2.0.0         | MIT                                      |
| acorn-loose                                       | 8.5.2         | MIT                                      |
| acorn-walk                                        | 8.3.5         | MIT                                      |
| adm-zip                                           | 0.5.16        | MIT                                      |
| agent-base                                        | 6.0.2         | MIT                                      |
| agent-base                                        | 7.1.4         | MIT                                      |
| ajv                                               | 6.12.6        | MIT                                      |
| ajv                                               | 8.18.0        | MIT                                      |
| ajv                                               | 8.20.0        | MIT                                      |
| ajv-formats                                       | 3.0.1         | MIT                                      |
| ansi-regex                                        | 5.0.1         | MIT                                      |
| ansi-regex                                        | 6.2.2         | MIT                                      |
| ansi-styles                                       | 4.3.0         | MIT                                      |
| ansi-styles                                       | 5.2.0         | MIT                                      |
| ansi-styles                                       | 6.2.3         | MIT                                      |
| argparse                                          | 2.0.1         | Python-2.0                               |
| aria-query                                        | 5.3.0         | Apache-2.0                               |
| array-buffer-byte-length                          | 1.0.2         | MIT                                      |
| array-includes                                    | 3.1.9         | MIT                                      |
| array.prototype.findlast                          | 1.2.5         | MIT                                      |
| array.prototype.flat                              | 1.3.3         | MIT                                      |
| array.prototype.flatmap                           | 1.3.3         | MIT                                      |
| array.prototype.tosorted                          | 1.1.4         | MIT                                      |
| arraybuffer.prototype.slice                       | 1.0.4         | MIT                                      |
| assertion-error                                   | 2.0.1         | MIT                                      |
| ast-v8-to-istanbul                                | 0.3.12        | MIT                                      |
| async-function                                    | 1.0.0         | MIT                                      |
| asynckit                                          | 0.4.0         | MIT                                      |
| autoprefixer                                      | 10.4.22       | MIT                                      |
| available-typed-arrays                            | 1.0.7         | MIT                                      |
| axios                                             | 1.18.1        | MIT                                      |
| bail                                              | 2.0.2         | MIT                                      |
| balanced-match                                    | 1.0.2         | MIT                                      |
| balanced-match                                    | 4.0.4         | MIT                                      |
| baseline-browser-mapping                          | 2.8.30        | Apache-2.0                               |
| bidi-js                                           | 1.0.3         | MIT                                      |
| body-parser                                       | 2.2.2         | MIT                                      |
| brace-expansion                                   | 1.1.12        | MIT                                      |
| brace-expansion                                   | 2.0.2         | MIT                                      |
| brace-expansion                                   | 2.1.0         | MIT                                      |
| brace-expansion                                   | 5.0.6         | MIT                                      |
| browserslist                                      | 4.28.0        | MIT                                      |
| bytes                                             | 3.1.2         | MIT                                      |
| cac                                               | 6.7.14        | MIT                                      |
| call-bind                                         | 1.0.8         | MIT                                      |
| call-bind-apply-helpers                           | 1.0.2         | MIT                                      |
| call-bound                                        | 1.0.4         | MIT                                      |
| callsites                                         | 3.1.0         | MIT                                      |
| camelcase                                         | 5.3.1         | MIT                                      |
| caniuse-lite                                      | 1.0.30001756  | CC-BY-4.0                                |
| ccount                                            | 2.0.1         | MIT                                      |
| chai                                              | 5.3.3         | MIT                                      |
| chalk                                             | 4.1.2         | MIT                                      |
| character-entities                                | 2.0.2         | MIT                                      |
| character-entities-html4                          | 2.1.0         | MIT                                      |
| character-entities-legacy                         | 3.0.0         | MIT                                      |
| character-reference-invalid                       | 2.0.1         | MIT                                      |
| chart.js                                          | 4.4.7         | MIT                                      |
| check-error                                       | 2.1.3         | MIT                                      |
| cliui                                             | 6.0.0         | ISC                                      |
| color-convert                                     | 2.0.1         | MIT                                      |
| color-name                                        | 1.1.4         | MIT                                      |
| combined-stream                                   | 1.0.8         | MIT                                      |
| comma-separated-tokens                            | 2.0.3         | MIT                                      |
| commander                                         | 13.1.0        | MIT                                      |
| commander                                         | 7.2.0         | MIT                                      |
| commander                                         | 8.3.0         | MIT                                      |
| concat-map                                        | 0.0.1         | MIT                                      |
| confbox                                           | 0.1.8         | MIT                                      |
| content-disposition                               | 1.1.0         | MIT                                      |
| content-type                                      | 1.0.5         | MIT                                      |
| convert-source-map                                | 2.0.0         | MIT                                      |
| cookie                                            | 0.7.2         | MIT                                      |
| cookie-signature                                  | 1.2.2         | MIT                                      |
| core-util-is                                      | 1.0.3         | MIT                                      |
| cors                                              | 2.8.6         | MIT                                      |
| cose-base                                         | 1.0.3         | MIT                                      |
| cose-base                                         | 2.2.0         | MIT                                      |
| cron-parser                                       | 5.5.0         | MIT                                      |
| cronstrue                                         | 3.13.0        | MIT                                      |
| cross-spawn                                       | 7.0.6         | MIT                                      |
| css-tree                                          | 3.2.1         | MIT                                      |
| css.escape                                        | 1.5.1         | MIT                                      |
| cssstyle                                          | 5.3.7         | MIT                                      |
| csstype                                           | 3.2.3         | MIT                                      |
| cytoscape                                         | 3.34.0        | MIT                                      |
| cytoscape-cose-bilkent                            | 4.1.0         | MIT                                      |
| cytoscape-fcose                                   | 2.2.0         | MIT                                      |
| d3                                                | 7.9.0         | ISC                                      |
| d3-array                                          | 2.12.1        | BSD-3-Clause                             |
| d3-array                                          | 3.2.4         | ISC                                      |
| d3-axis                                           | 3.0.0         | ISC                                      |
| d3-brush                                          | 3.0.0         | ISC                                      |
| d3-chord                                          | 3.0.1         | ISC                                      |
| d3-color                                          | 3.1.0         | ISC                                      |
| d3-contour                                        | 4.0.2         | ISC                                      |
| d3-delaunay                                       | 6.0.4         | ISC                                      |
| d3-dispatch                                       | 3.0.1         | ISC                                      |
| d3-drag                                           | 3.0.0         | ISC                                      |
| d3-dsv                                            | 3.0.1         | ISC                                      |
| d3-ease                                           | 3.0.1         | BSD-3-Clause                             |
| d3-fetch                                          | 3.0.1         | ISC                                      |
| d3-force                                          | 3.0.0         | ISC                                      |
| d3-format                                         | 3.1.2         | ISC                                      |
| d3-geo                                            | 3.1.1         | ISC                                      |
| d3-hierarchy                                      | 3.1.2         | ISC                                      |
| d3-interpolate                                    | 3.0.1         | ISC                                      |
| d3-path                                           | 1.0.9         | BSD-3-Clause                             |
| d3-path                                           | 3.1.0         | ISC                                      |
| d3-polygon                                        | 3.0.1         | ISC                                      |
| d3-quadtree                                       | 3.0.1         | ISC                                      |
| d3-random                                         | 3.0.1         | ISC                                      |
| d3-sankey                                         | 0.12.3        | BSD-3-Clause                             |
| d3-scale                                          | 4.0.2         | ISC                                      |
| d3-scale-chromatic                                | 3.1.0         | ISC                                      |
| d3-selection                                      | 3.0.0         | ISC                                      |
| d3-shape                                          | 1.3.7         | BSD-3-Clause                             |
| d3-shape                                          | 3.2.0         | ISC                                      |
| d3-time                                           | 3.1.0         | ISC                                      |
| d3-time-format                                    | 4.1.0         | ISC                                      |
| d3-timer                                          | 3.0.1         | ISC                                      |
| d3-transition                                     | 3.0.1         | ISC                                      |
| d3-zoom                                           | 3.0.0         | ISC                                      |
| dagre-d3-es                                       | 7.0.14        | MIT                                      |
| data-urls                                         | 6.0.1         | MIT                                      |
| data-view-buffer                                  | 1.0.2         | MIT                                      |
| data-view-byte-length                             | 1.0.2         | MIT                                      |
| data-view-byte-offset                             | 1.0.1         | MIT                                      |
| dayjs                                             | 1.11.21       | MIT                                      |
| debug                                             | 4.4.3         | MIT                                      |
| decamelize                                        | 1.2.0         | MIT                                      |
| decimal.js                                        | 10.6.0        | MIT                                      |
| decode-named-character-reference                  | 1.2.0         | MIT                                      |
| deep-eql                                          | 5.0.2         | MIT                                      |
| deep-is                                           | 0.1.4         | MIT                                      |
| define-data-property                              | 1.1.4         | MIT                                      |
| define-properties                                 | 1.2.1         | MIT                                      |
| delaunator                                        | 5.0.1         | ISC                                      |
| delayed-stream                                    | 1.0.0         | MIT                                      |
| depd                                              | 2.0.0         | MIT                                      |
| dependency-cruiser                                | 16.10.4       | MIT                                      |
| dequal                                            | 2.0.3         | MIT                                      |
| detect-libc                                       | 2.1.2         | Apache-2.0                               |
| devlop                                            | 1.1.0         | MIT                                      |
| dijkstrajs                                        | 1.0.3         | MIT                                      |
| doctrine                                          | 2.1.0         | Apache-2.0                               |
| docx-preview                                      | 0.3.7         | Apache-2.0                               |
| dom-accessibility-api                             | 0.5.16        | MIT                                      |
| dom-accessibility-api                             | 0.6.3         | MIT                                      |
| dompurify                                         | 3.4.12        | (MPL-2.0 OR Apache-2.0)                  |
| dunder-proto                                      | 1.0.1         | MIT                                      |
| eastasianwidth                                    | 0.2.0         | MIT                                      |
| echarts                                           | 6.1.0         | Apache-2.0                               |
| ee-first                                          | 1.1.1         | MIT                                      |
| electron-to-chromium                              | 1.5.259       | ISC                                      |
| emoji-regex                                       | 8.0.0         | MIT                                      |
| emoji-regex                                       | 9.2.2         | MIT                                      |
| encodeurl                                         | 2.0.0         | MIT                                      |
| enhanced-resolve                                  | 5.18.3        | MIT                                      |
| entities                                          | 6.0.1         | BSD-2-Clause                             |
| entities                                          | 8.0.0         | BSD-2-Clause                             |
| es-abstract                                       | 1.24.0        | MIT                                      |
| es-define-property                                | 1.0.1         | MIT                                      |
| es-errors                                         | 1.3.0         | MIT                                      |
| es-iterator-helpers                               | 1.2.1         | MIT                                      |
| es-module-lexer                                   | 1.7.0         | MIT                                      |
| es-object-atoms                                   | 1.1.1         | MIT                                      |
| es-set-tostringtag                                | 2.1.0         | MIT                                      |
| es-shim-unscopables                               | 1.1.0         | MIT                                      |
| es-to-primitive                                   | 1.3.0         | MIT                                      |
| es-toolkit                                        | 1.49.0        | MIT                                      |
| esbuild                                           | 0.25.12       | MIT                                      |
| esbuild                                           | 0.27.7        | MIT                                      |
| escalade                                          | 3.2.0         | MIT                                      |
| escape-html                                       | 1.0.3         | MIT                                      |
| escape-string-regexp                              | 1.0.5         | MIT                                      |
| escape-string-regexp                              | 4.0.0         | MIT                                      |
| escape-string-regexp                              | 5.0.0         | MIT                                      |
| eslint                                            | 9.39.1        | MIT                                      |
| eslint-config-prettier                            | 10.1.8        | MIT                                      |
| eslint-plugin-eslint-comments                     | 3.2.0         | MIT                                      |
| eslint-plugin-react                               | 7.37.5        | MIT                                      |
| eslint-plugin-react-hooks                         | 7.0.1         | MIT                                      |
| eslint-scope                                      | 8.4.0         | BSD-2-Clause                             |
| eslint-visitor-keys                               | 3.4.3         | Apache-2.0                               |
| eslint-visitor-keys                               | 4.2.1         | Apache-2.0                               |
| espree                                            | 10.4.0        | BSD-2-Clause                             |
| esquery                                           | 1.6.0         | BSD-3-Clause                             |
| esrecurse                                         | 4.3.0         | BSD-2-Clause                             |
| estraverse                                        | 5.3.0         | BSD-2-Clause                             |
| estree-util-is-identifier-name                    | 3.0.0         | MIT                                      |
| estree-walker                                     | 3.0.3         | MIT                                      |
| esutils                                           | 2.0.3         | BSD-2-Clause                             |
| etag                                              | 1.8.1         | MIT                                      |
| eventsource                                       | 3.0.7         | MIT                                      |
| eventsource-parser                                | 3.0.8         | MIT                                      |
| expect-type                                       | 1.3.0         | Apache-2.0                               |
| express                                           | 5.2.1         | MIT                                      |
| express-rate-limit                                | 8.4.0         | MIT                                      |
| extend                                            | 3.0.2         | MIT                                      |
| fast-deep-equal                                   | 3.1.3         | MIT                                      |
| fast-json-stable-stringify                        | 2.1.0         | MIT                                      |
| fast-levenshtein                                  | 2.0.6         | MIT                                      |
| fast-sha256                                       | 1.3.0         | Unlicense                                |
| fast-uri                                          | 3.1.3         | BSD-3-Clause                             |
| fault                                             | 1.0.4         | MIT                                      |
| fdir                                              | 6.5.0         | MIT                                      |
| file-entry-cache                                  | 8.0.0         | MIT                                      |
| finalhandler                                      | 2.1.1         | MIT                                      |
| find-up                                           | 4.1.0         | MIT                                      |
| find-up                                           | 5.0.0         | MIT                                      |
| flat-cache                                        | 4.0.1         | MIT                                      |
| flatted                                           | 3.3.3         | ISC                                      |
| follow-redirects                                  | 1.16.0        | MIT                                      |
| for-each                                          | 0.3.5         | MIT                                      |
| foreground-child                                  | 3.3.1         | ISC                                      |
| form-data                                         | 4.0.6         | MIT                                      |
| format                                            | 0.2.2         | MIT                                      |
| forwarded                                         | 0.2.0         | MIT                                      |
| fraction.js                                       | 5.3.4         | MIT                                      |
| fresh                                             | 2.0.0         | MIT                                      |
| fsevents                                          | 2.3.3         | MIT                                      |
| function-bind                                     | 1.1.2         | MIT                                      |
| function.prototype.name                           | 1.1.8         | MIT                                      |
| functions-have-names                              | 1.2.3         | MIT                                      |
| generator-function                                | 2.0.1         | MIT                                      |
| gensync                                           | 1.0.0-beta.2  | MIT                                      |
| get-caller-file                                   | 2.0.5         | ISC                                      |
| get-intrinsic                                     | 1.3.0         | MIT                                      |
| get-proto                                         | 1.0.1         | MIT                                      |
| get-symbol-description                            | 1.1.0         | MIT                                      |
| get-tsconfig                                      | 4.14.0        | MIT                                      |
| glob                                              | 10.5.0        | ISC                                      |
| glob-parent                                       | 6.0.2         | ISC                                      |
| global-directory                                  | 4.0.1         | MIT                                      |
| globals                                           | 14.0.0        | MIT                                      |
| globalthis                                        | 1.0.4         | MIT                                      |
| gopd                                              | 1.2.0         | MIT                                      |
| graceful-fs                                       | 4.2.11        | ISC                                      |
| graphemer                                         | 1.4.0         | MIT                                      |
| hachure-fill                                      | 0.5.2         | MIT                                      |
| has-bigints                                       | 1.1.0         | MIT                                      |
| has-flag                                          | 4.0.0         | MIT                                      |
| has-property-descriptors                          | 1.0.2         | MIT                                      |
| has-proto                                         | 1.2.0         | MIT                                      |
| has-symbols                                       | 1.1.0         | MIT                                      |
| has-tostringtag                                   | 1.0.2         | MIT                                      |
| hasown                                            | 2.0.4         | MIT                                      |
| hast-util-from-dom                                | 5.0.1         | ISC                                      |
| hast-util-from-html                               | 2.0.3         | MIT                                      |
| hast-util-from-html-isomorphic                    | 2.0.0         | MIT                                      |
| hast-util-from-parse5                             | 8.0.3         | MIT                                      |
| hast-util-is-element                              | 3.0.0         | MIT                                      |
| hast-util-parse-selector                          | 4.0.0         | MIT                                      |
| hast-util-raw                                     | 9.1.0         | MIT                                      |
| hast-util-sanitize                                | 5.0.2         | MIT                                      |
| hast-util-to-jsx-runtime                          | 2.3.6         | MIT                                      |
| hast-util-to-parse5                               | 8.0.1         | MIT                                      |
| hast-util-to-text                                 | 4.0.2         | MIT                                      |
| hast-util-whitespace                              | 3.0.0         | MIT                                      |
| hastscript                                        | 9.0.1         | MIT                                      |
| hermes-estree                                     | 0.25.1        | MIT                                      |
| hermes-parser                                     | 0.25.1        | MIT                                      |
| highlight.js                                      | 10.7.3        | BSD-3-Clause                             |
| highlightjs-vue                                   | 1.0.0         | CC0-1.0                                  |
| hono                                              | 4.12.30       | MIT                                      |
| html-encoding-sniffer                             | 4.0.0         | MIT                                      |
| html-escaper                                      | 2.0.2         | MIT                                      |
| html-parse-stringify                              | 3.0.1         | MIT                                      |
| html-url-attributes                               | 3.0.1         | MIT                                      |
| html-void-elements                                | 3.0.0         | MIT                                      |
| http-errors                                       | 2.0.1         | MIT                                      |
| http-proxy-agent                                  | 7.0.2         | MIT                                      |
| https-proxy-agent                                 | 5.0.1         | MIT                                      |
| https-proxy-agent                                 | 7.0.6         | MIT                                      |
| i18next                                           | 26.3.3        | MIT                                      |
| iconv-lite                                        | 0.6.3         | MIT                                      |
| iconv-lite                                        | 0.7.2         | MIT                                      |
| ignore                                            | 5.3.2         | MIT                                      |
| ignore                                            | 7.0.5         | MIT                                      |
| immediate                                         | 3.0.6         | MIT                                      |
| import-fresh                                      | 3.3.1         | MIT                                      |
| imurmurhash                                       | 0.1.4         | MIT                                      |
| indent-string                                     | 4.0.0         | MIT                                      |
| inherits                                          | 2.0.4         | ISC                                      |
| ini                                               | 4.1.1         | ISC                                      |
| inline-style-parser                               | 0.2.7         | MIT                                      |
| internal-slot                                     | 1.1.0         | MIT                                      |
| internmap                                         | 1.0.1         | ISC                                      |
| interpret                                         | 3.1.1         | MIT                                      |
| ip-address                                        | 10.2.0        | MIT                                      |
| ipaddr.js                                         | 1.9.1         | MIT                                      |
| ipaddr.js                                         | 2.2.0         | MIT                                      |
| is-alphabetical                                   | 2.0.1         | MIT                                      |
| is-alphanumerical                                 | 2.0.1         | MIT                                      |
| is-array-buffer                                   | 3.0.5         | MIT                                      |
| is-async-function                                 | 2.1.1         | MIT                                      |
| is-bigint                                         | 1.1.0         | MIT                                      |
| is-boolean-object                                 | 1.2.2         | MIT                                      |
| is-callable                                       | 1.2.7         | MIT                                      |
| is-core-module                                    | 2.16.1        | MIT                                      |
| is-data-view                                      | 1.0.2         | MIT                                      |
| is-date-object                                    | 1.1.0         | MIT                                      |
| is-decimal                                        | 2.0.1         | MIT                                      |
| is-extglob                                        | 2.1.1         | MIT                                      |
| is-finalizationregistry                           | 1.1.1         | MIT                                      |
| is-fullwidth-code-point                           | 3.0.0         | MIT                                      |
| is-generator-function                             | 1.1.2         | MIT                                      |
| is-glob                                           | 4.0.3         | MIT                                      |
| is-hexadecimal                                    | 2.0.1         | MIT                                      |
| is-installed-globally                             | 1.0.0         | MIT                                      |
| is-map                                            | 2.0.3         | MIT                                      |
| is-negative-zero                                  | 2.0.3         | MIT                                      |
| is-number-object                                  | 1.1.1         | MIT                                      |
| is-path-inside                                    | 4.0.0         | MIT                                      |
| is-plain-obj                                      | 4.1.0         | MIT                                      |
| is-potential-custom-element-name                  | 1.0.1         | MIT                                      |
| is-promise                                        | 4.0.0         | MIT                                      |
| is-regex                                          | 1.2.1         | MIT                                      |
| is-set                                            | 2.0.3         | MIT                                      |
| is-shared-array-buffer                            | 1.0.4         | MIT                                      |
| is-string                                         | 1.1.1         | MIT                                      |
| is-symbol                                         | 1.1.1         | MIT                                      |
| is-typed-array                                    | 1.1.15        | MIT                                      |
| is-weakmap                                        | 2.0.2         | MIT                                      |
| is-weakref                                        | 1.1.1         | MIT                                      |
| is-weakset                                        | 2.0.4         | MIT                                      |
| isarray                                           | 1.0.0         | MIT                                      |
| isarray                                           | 2.0.5         | MIT                                      |
| isexe                                             | 2.0.0         | ISC                                      |
| istanbul-lib-coverage                             | 3.2.2         | BSD-3-Clause                             |
| istanbul-lib-report                               | 3.0.1         | BSD-3-Clause                             |
| istanbul-lib-source-maps                          | 5.0.6         | BSD-3-Clause                             |
| istanbul-reports                                  | 3.2.0         | BSD-3-Clause                             |
| iterator.prototype                                | 1.1.5         | MIT                                      |
| jackspeak                                         | 3.4.3         | BlueOak-1.0.0                            |
| jiti                                              | 2.6.1         | MIT                                      |
| jose                                              | 6.2.2         | MIT                                      |
| js-tokens                                         | 10.0.0        | MIT                                      |
| js-tokens                                         | 4.0.0         | MIT                                      |
| js-tokens                                         | 9.0.1         | MIT                                      |
| js-yaml                                           | 4.3.0         | MIT                                      |
| jsdom                                             | 27.0.1        | MIT                                      |
| jsesc                                             | 3.1.0         | MIT                                      |
| json-buffer                                       | 3.0.1         | MIT                                      |
| json-schema-to-ts                                 | 3.1.1         | MIT                                      |
| json-schema-traverse                              | 0.4.1         | MIT                                      |
| json-schema-traverse                              | 1.0.0         | MIT                                      |
| json-schema-typed                                 | 8.0.2         | BSD-2-Clause                             |
| json-stable-stringify-without-jsonify             | 1.0.1         | MIT                                      |
| json5                                             | 2.2.3         | MIT                                      |
| jsx-ast-utils                                     | 3.3.5         | MIT                                      |
| jszip                                             | 3.10.1        | (MIT OR GPL-3.0-or-later)                |
| katex                                             | 0.16.47       | MIT                                      |
| keyv                                              | 4.5.4         | MIT                                      |
| khroma                                            | 2.1.0         | MIT                                      |
| kleur                                             | 3.0.3         | MIT                                      |
| layout-base                                       | 1.0.2         | MIT                                      |
| layout-base                                       | 2.0.1         | MIT                                      |
| levn                                              | 0.4.1         | MIT                                      |
| lie                                               | 3.3.0         | MIT                                      |
| lightningcss                                      | 1.30.2        | MPL-2.0                                  |
| lightningcss-android-arm64                        | 1.30.2        | MPL-2.0                                  |
| lightningcss-darwin-arm64                         | 1.30.2        | MPL-2.0                                  |
| lightningcss-darwin-x64                           | 1.30.2        | MPL-2.0                                  |
| lightningcss-freebsd-x64                          | 1.30.2        | MPL-2.0                                  |
| lightningcss-linux-arm-gnueabihf                  | 1.30.2        | MPL-2.0                                  |
| lightningcss-linux-arm64-gnu                      | 1.30.2        | MPL-2.0                                  |
| lightningcss-linux-arm64-musl                     | 1.30.2        | MPL-2.0                                  |
| lightningcss-linux-x64-gnu                        | 1.30.2        | MPL-2.0                                  |
| lightningcss-linux-x64-musl                       | 1.30.2        | MPL-2.0                                  |
| lightningcss-win32-arm64-msvc                     | 1.30.2        | MPL-2.0                                  |
| lightningcss-win32-x64-msvc                       | 1.30.2        | MPL-2.0                                  |
| locate-path                                       | 5.0.0         | MIT                                      |
| locate-path                                       | 6.0.0         | MIT                                      |
| lodash-es                                         | 4.18.1        | MIT                                      |
| lodash.identity                                   | 3.0.0         | MIT                                      |
| lodash.merge                                      | 4.6.2         | MIT                                      |
| lodash.pickby                                     | 4.6.0         | MIT                                      |
| long                                              | 5.3.2         | Apache-2.0                               |
| longest-streak                                    | 3.1.0         | MIT                                      |
| loose-envify                                      | 1.4.0         | MIT                                      |
| loupe                                             | 3.2.1         | MIT                                      |
| lowlight                                          | 1.20.0        | MIT                                      |
| lru-cache                                         | 10.4.3        | ISC                                      |
| lru-cache                                         | 11.5.0        | BlueOak-1.0.0                            |
| lru-cache                                         | 5.1.1         | ISC                                      |
| lucide                                            | 0.554.0       | ISC                                      |
| lucide-react                                      | 0.554.0       | ISC                                      |
| luxon                                             | 3.7.2         | MIT                                      |
| lz-string                                         | 1.5.0         | MIT                                      |
| magic-string                                      | 0.30.21       | MIT                                      |
| magicast                                          | 0.3.5         | MIT                                      |
| make-dir                                          | 4.0.0         | MIT                                      |
| markdown-table                                    | 3.0.4         | MIT                                      |
| marked                                            | 14.0.0        | MIT                                      |
| marked                                            | 16.4.2        | MIT                                      |
| math-intrinsics                                   | 1.1.0         | MIT                                      |
| mdast-util-find-and-replace                       | 3.0.2         | MIT                                      |
| mdast-util-from-markdown                          | 2.0.2         | MIT                                      |
| mdast-util-gfm                                    | 3.1.0         | MIT                                      |
| mdast-util-gfm-autolink-literal                   | 2.0.1         | MIT                                      |
| mdast-util-gfm-footnote                           | 2.1.0         | MIT                                      |
| mdast-util-gfm-strikethrough                      | 2.0.0         | MIT                                      |
| mdast-util-gfm-table                              | 2.0.0         | MIT                                      |
| mdast-util-gfm-task-list-item                     | 2.0.0         | MIT                                      |
| mdast-util-math                                   | 3.0.0         | MIT                                      |
| mdast-util-mdx-expression                         | 2.0.1         | MIT                                      |
| mdast-util-mdx-jsx                                | 3.2.0         | MIT                                      |
| mdast-util-mdxjs-esm                              | 2.0.1         | MIT                                      |
| mdast-util-newline-to-break                       | 2.0.0         | MIT                                      |
| mdast-util-phrasing                               | 4.1.0         | MIT                                      |
| mdast-util-to-hast                                | 13.2.1        | MIT                                      |
| mdast-util-to-markdown                            | 2.1.2         | MIT                                      |
| mdast-util-to-string                              | 4.0.0         | MIT                                      |
| mdn-data                                          | 2.27.1        | CC0-1.0                                  |
| media-typer                                       | 1.1.0         | MIT                                      |
| memoize                                           | 10.2.0        | MIT                                      |
| merge-descriptors                                 | 2.0.0         | MIT                                      |
| mermaid                                           | 11.16.0       | MIT                                      |
| micromark                                         | 4.0.2         | MIT                                      |
| micromark-core-commonmark                         | 2.0.3         | MIT                                      |
| micromark-extension-gfm                           | 3.0.0         | MIT                                      |
| micromark-extension-gfm-autolink-literal          | 2.1.0         | MIT                                      |
| micromark-extension-gfm-footnote                  | 2.1.0         | MIT                                      |
| micromark-extension-gfm-strikethrough             | 2.1.0         | MIT                                      |
| micromark-extension-gfm-table                     | 2.1.1         | MIT                                      |
| micromark-extension-gfm-tagfilter                 | 2.0.0         | MIT                                      |
| micromark-extension-gfm-task-list-item            | 2.1.0         | MIT                                      |
| micromark-extension-math                          | 3.1.0         | MIT                                      |
| micromark-factory-destination                     | 2.0.1         | MIT                                      |
| micromark-factory-label                           | 2.0.1         | MIT                                      |
| micromark-factory-space                           | 2.0.1         | MIT                                      |
| micromark-factory-title                           | 2.0.1         | MIT                                      |
| micromark-factory-whitespace                      | 2.0.1         | MIT                                      |
| micromark-util-character                          | 2.1.1         | MIT                                      |
| micromark-util-chunked                            | 2.0.1         | MIT                                      |
| micromark-util-classify-character                 | 2.0.1         | MIT                                      |
| micromark-util-combine-extensions                 | 2.0.1         | MIT                                      |
| micromark-util-decode-numeric-character-reference | 2.0.2         | MIT                                      |
| micromark-util-decode-string                      | 2.0.1         | MIT                                      |
| micromark-util-encode                             | 2.0.1         | MIT                                      |
| micromark-util-html-tag-name                      | 2.0.1         | MIT                                      |
| micromark-util-normalize-identifier               | 2.0.1         | MIT                                      |
| micromark-util-resolve-all                        | 2.0.1         | MIT                                      |
| micromark-util-sanitize-uri                       | 2.0.1         | MIT                                      |
| micromark-util-subtokenize                        | 2.1.0         | MIT                                      |
| micromark-util-symbol                             | 2.0.1         | MIT                                      |
| micromark-util-types                              | 2.0.2         | MIT                                      |
| mime-db                                           | 1.52.0        | MIT                                      |
| mime-db                                           | 1.54.0        | MIT                                      |
| mime-types                                        | 2.1.35        | MIT                                      |
| mime-types                                        | 3.0.2         | MIT                                      |
| mimic-function                                    | 5.0.1         | MIT                                      |
| min-indent                                        | 1.0.1         | MIT                                      |
| minimatch                                         | 10.2.5        | BlueOak-1.0.0                            |
| minimatch                                         | 3.1.2         | ISC                                      |
| minimatch                                         | 9.0.5         | ISC                                      |
| minimatch                                         | 9.0.9         | ISC                                      |
| minimist                                          | 1.2.8         | MIT                                      |
| minipass                                          | 7.1.3         | BlueOak-1.0.0                            |
| mlly                                              | 1.8.0         | MIT                                      |
| monaco-editor                                     | 0.55.1        | MIT                                      |
| ms                                                | 2.1.3         | MIT                                      |
| nanoid                                            | 3.3.11        | MIT                                      |
| natural-compare                                   | 1.4.0         | MIT                                      |
| negotiator                                        | 1.0.0         | MIT                                      |
| node-releases                                     | 2.0.27        | MIT                                      |
| normalize-range                                   | 0.1.2         | MIT                                      |
| object-assign                                     | 4.1.1         | MIT                                      |
| object-inspect                                    | 1.13.4        | MIT                                      |
| object-keys                                       | 1.1.1         | MIT                                      |
| object.assign                                     | 4.1.7         | MIT                                      |
| object.entries                                    | 1.1.9         | MIT                                      |
| object.fromentries                                | 2.0.8         | MIT                                      |
| object.values                                     | 1.2.1         | MIT                                      |
| on-finished                                       | 2.4.1         | MIT                                      |
| once                                              | 1.4.0         | ISC                                      |
| optionator                                        | 0.9.4         | MIT                                      |
| own-keys                                          | 1.0.1         | MIT                                      |
| p-limit                                           | 2.3.0         | MIT                                      |
| p-limit                                           | 3.1.0         | MIT                                      |
| p-locate                                          | 4.1.0         | MIT                                      |
| p-locate                                          | 5.0.0         | MIT                                      |
| p-try                                             | 2.2.0         | MIT                                      |
| package-json-from-dist                            | 1.0.1         | BlueOak-1.0.0                            |
| package-manager-detector                          | 1.6.0         | MIT                                      |
| pako                                              | 1.0.11        | (MIT AND Zlib)                           |
| parent-module                                     | 1.0.1         | MIT                                      |
| parse-entities                                    | 4.0.2         | MIT                                      |
| parse5                                            | 7.3.0         | MIT                                      |
| parse5                                            | 8.0.1         | MIT                                      |
| parseurl                                          | 1.3.3         | MIT                                      |
| path-data-parser                                  | 0.1.0         | MIT                                      |
| path-exists                                       | 4.0.0         | MIT                                      |
| path-key                                          | 3.1.1         | MIT                                      |
| path-parse                                        | 1.0.7         | MIT                                      |
| path-scurry                                       | 1.11.1        | BlueOak-1.0.0                            |
| path-to-regexp                                    | 8.4.2         | MIT                                      |
| pathe                                             | 2.0.3         | MIT                                      |
| pathval                                           | 2.0.1         | MIT                                      |
| pdfjs-dist                                        | 5.7.284       | Apache-2.0                               |
| picocolors                                        | 1.1.1         | ISC                                      |
| picomatch                                         | 4.0.3         | MIT                                      |
| pinyin-pro                                        | 3.28.1        | MIT                                      |
| pkce-challenge                                    | 5.0.1         | MIT                                      |
| pkg-types                                         | 1.3.1         | MIT                                      |
| pngjs                                             | 5.0.0         | MIT                                      |
| points-on-curve                                   | 0.2.0         | MIT                                      |
| points-on-path                                    | 0.2.1         | MIT                                      |
| possible-typed-array-names                        | 1.1.0         | MIT                                      |
| postcss                                           | 8.5.6         | MIT                                      |
| postcss-value-parser                              | 4.2.0         | MIT                                      |
| prelude-ls                                        | 1.2.1         | MIT                                      |
| prettier                                          | 3.6.2         | MIT                                      |
| prettier-plugin-tailwindcss                       | 0.7.1         | MIT                                      |
| pretty-format                                     | 27.5.1        | MIT                                      |
| prismjs                                           | 1.30.0        | MIT                                      |
| process-nextick-args                              | 2.0.1         | MIT                                      |
| prompts                                           | 2.4.2         | MIT                                      |
| prop-types                                        | 15.8.1        | MIT                                      |
| property-information                              | 7.1.0         | MIT                                      |
| protobufjs                                        | 7.6.5         | BSD-3-Clause                             |
| proxy-addr                                        | 2.0.7         | MIT                                      |
| proxy-from-env                                    | 2.1.0         | MIT                                      |
| punycode                                          | 2.3.1         | MIT                                      |
| qrcode                                            | 1.5.4         | MIT                                      |
| qs                                                | 6.15.3        | BSD-3-Clause                             |
| range-parser                                      | 1.2.1         | MIT                                      |
| raw-body                                          | 3.0.2         | MIT                                      |
| react                                             | 19.2.0        | MIT                                      |
| react-dom                                         | 19.2.0        | MIT                                      |
| react-i18next                                     | 17.0.8        | MIT                                      |
| react-is                                          | 16.13.1       | MIT                                      |
| react-is                                          | 17.0.2        | MIT                                      |
| react-markdown                                    | 10.1.0        | MIT                                      |
| react-refresh                                     | 0.18.0        | MIT                                      |
| react-syntax-highlighter                          | 16.1.0        | MIT                                      |
| react-virtuoso                                    | 4.18.3        | MIT                                      |
| readable-stream                                   | 2.3.8         | MIT                                      |
| rechoir                                           | 0.8.0         | MIT                                      |
| redent                                            | 3.0.0         | MIT                                      |
| reflect.getprototypeof                            | 1.0.10        | MIT                                      |
| refractor                                         | 5.0.0         | MIT                                      |
| regexp-tree                                       | 0.1.27        | MIT                                      |
| regexp.prototype.flags                            | 1.5.4         | MIT                                      |
| rehype-katex                                      | 7.0.1         | MIT                                      |
| rehype-raw                                        | 7.0.0         | MIT                                      |
| rehype-sanitize                                   | 6.0.0         | MIT                                      |
| remark-breaks                                     | 4.0.0         | MIT                                      |
| remark-gfm                                        | 4.0.1         | MIT                                      |
| remark-math                                       | 6.0.0         | MIT                                      |
| remark-parse                                      | 11.0.0        | MIT                                      |
| remark-rehype                                     | 11.1.2        | MIT                                      |
| remark-stringify                                  | 11.0.0        | MIT                                      |
| require-directory                                 | 2.1.1         | MIT                                      |
| require-from-string                               | 2.0.2         | MIT                                      |
| require-main-filename                             | 2.0.0         | ISC                                      |
| resolve                                           | 1.22.12       | MIT                                      |
| resolve                                           | 2.0.0-next.5  | MIT                                      |
| resolve-from                                      | 4.0.0         | MIT                                      |
| resolve-pkg-maps                                  | 1.0.0         | MIT                                      |
| robust-predicates                                 | 3.0.2         | Unlicense                                |
| rollup                                            | 4.53.3        | MIT                                      |
| roughjs                                           | 4.6.6         | MIT                                      |
| router                                            | 2.2.0         | MIT                                      |
| rrweb-cssom                                       | 0.8.0         | MIT                                      |
| rw                                                | 1.3.3         | BSD-3-Clause                             |
| safe-array-concat                                 | 1.1.3         | MIT                                      |
| safe-buffer                                       | 5.1.2         | MIT                                      |
| safe-push-apply                                   | 1.0.0         | MIT                                      |
| safe-regex                                        | 2.1.1         | MIT                                      |
| safe-regex-test                                   | 1.1.0         | MIT                                      |
| safer-buffer                                      | 2.1.2         | MIT                                      |
| saxes                                             | 6.0.0         | ISC                                      |
| scheduler                                         | 0.27.0        | MIT                                      |
| semver                                            | 6.3.1         | ISC                                      |
| semver                                            | 7.7.3         | ISC                                      |
| send                                              | 1.2.1         | MIT                                      |
| serve-static                                      | 2.2.1         | MIT                                      |
| set-blocking                                      | 2.0.0         | ISC                                      |
| set-function-length                               | 1.2.2         | MIT                                      |
| set-function-name                                 | 2.0.2         | MIT                                      |
| set-proto                                         | 1.0.0         | MIT                                      |
| setimmediate                                      | 1.0.5         | MIT                                      |
| setprototypeof                                    | 1.2.0         | ISC                                      |
| sharp                                             | 0.34.5        | Apache-2.0                               |
| shebang-command                                   | 2.0.0         | MIT                                      |
| shebang-regex                                     | 3.0.0         | MIT                                      |
| side-channel                                      | 1.1.1         | MIT                                      |
| side-channel-list                                 | 1.0.1         | MIT                                      |
| side-channel-map                                  | 1.0.1         | MIT                                      |
| side-channel-weakmap                              | 1.0.2         | MIT                                      |
| siginfo                                           | 2.0.0         | ISC                                      |
| signal-exit                                       | 4.1.0         | ISC                                      |
| sisteransi                                        | 1.0.5         | MIT                                      |
| smart-buffer                                      | 4.2.0         | MIT                                      |
| socks                                             | 2.8.7         | MIT                                      |
| source-map-js                                     | 1.2.1         | BSD-3-Clause                             |
| space-separated-tokens                            | 2.0.2         | MIT                                      |
| stackback                                         | 0.0.2         | MIT                                      |
| standardwebhooks                                  | 1.0.0         | MIT                                      |
| state-local                                       | 1.0.7         | MIT                                      |
| statuses                                          | 2.0.2         | MIT                                      |
| std-env                                           | 3.10.0        | MIT                                      |
| stop-iteration-iterator                           | 1.1.0         | MIT                                      |
| string_decoder                                    | 1.1.1         | MIT                                      |
| string-width                                      | 4.2.3         | MIT                                      |
| string-width                                      | 5.1.2         | MIT                                      |
| string-width-cjs                                  | 4.2.3         | MIT                                      |
| string.prototype.matchall                         | 4.0.12        | MIT                                      |
| string.prototype.repeat                           | 1.0.0         | MIT                                      |
| string.prototype.trim                             | 1.2.10        | MIT                                      |
| string.prototype.trimend                          | 1.0.9         | MIT                                      |
| string.prototype.trimstart                        | 1.0.8         | MIT                                      |
| stringify-entities                                | 4.0.4         | MIT                                      |
| strip-ansi                                        | 6.0.1         | MIT                                      |
| strip-ansi                                        | 7.2.0         | MIT                                      |
| strip-ansi-cjs                                    | 6.0.1         | MIT                                      |
| strip-bom                                         | 3.0.0         | MIT                                      |
| strip-indent                                      | 3.0.0         | MIT                                      |
| strip-json-comments                               | 3.1.1         | MIT                                      |
| strip-literal                                     | 3.1.0         | MIT                                      |
| style-to-js                                       | 1.1.21        | MIT                                      |
| style-to-object                                   | 1.0.14        | MIT                                      |
| stylis                                            | 4.3.6         | MIT                                      |
| supports-color                                    | 7.2.0         | MIT                                      |
| supports-preserve-symlinks-flag                   | 1.0.0         | MIT                                      |
| symbol-tree                                       | 3.2.4         | MIT                                      |
| tabbable                                          | 6.4.0         | MIT                                      |
| tailwindcss                                       | 4.1.17        | MIT                                      |
| tapable                                           | 2.3.0         | MIT                                      |
| teamcity-service-messages                         | 0.1.14        | MIT                                      |
| test-exclude                                      | 7.0.2         | ISC                                      |
| tinybench                                         | 2.9.0         | MIT                                      |
| tinyexec                                          | 0.3.2         | MIT                                      |
| tinyexec                                          | 1.0.2         | MIT                                      |
| tinyglobby                                        | 0.2.15        | MIT                                      |
| tinypool                                          | 1.1.1         | MIT                                      |
| tinyrainbow                                       | 2.0.0         | MIT                                      |
| tinyspy                                           | 4.0.4         | MIT                                      |
| tldts                                             | 7.0.31        | MIT                                      |
| tldts-core                                        | 7.0.31        | MIT                                      |
| toidentifier                                      | 1.0.1         | MIT                                      |
| tough-cookie                                      | 6.0.1         | BSD-3-Clause                             |
| tr46                                              | 6.0.0         | MIT                                      |
| trim-lines                                        | 3.0.1         | MIT                                      |
| trough                                            | 2.2.0         | MIT                                      |
| ts-algebra                                        | 2.0.0         | MIT                                      |
| ts-api-utils                                      | 2.1.0         | MIT                                      |
| ts-dedent                                         | 2.2.0         | MIT                                      |
| tsconfig-paths                                    | 4.2.0         | MIT                                      |
| tsconfig-paths-webpack-plugin                     | 4.2.0         | MIT                                      |
| tslib                                             | 2.3.0         | 0BSD                                     |
| tslib                                             | 2.8.1         | 0BSD                                     |
| tsx                                               | 4.21.0        | MIT                                      |
| type-check                                        | 0.4.0         | MIT                                      |
| type-is                                           | 2.0.1         | MIT                                      |
| typed-array-buffer                                | 1.0.3         | MIT                                      |
| typed-array-byte-length                           | 1.0.3         | MIT                                      |
| typed-array-byte-offset                           | 1.0.4         | MIT                                      |
| typed-array-length                                | 1.0.7         | MIT                                      |
| typescript                                        | 5.9.3         | Apache-2.0                               |
| typescript-eslint                                 | 8.48.0        | MIT                                      |
| ufo                                               | 1.6.3         | MIT                                      |
| unbox-primitive                                   | 1.1.0         | MIT                                      |
| undici                                            | 8.7.0         | MIT                                      |
| undici-types                                      | 7.16.0        | MIT                                      |
| unified                                           | 11.0.5        | MIT                                      |
| unist-util-find-after                             | 5.0.0         | MIT                                      |
| unist-util-is                                     | 6.0.1         | MIT                                      |
| unist-util-position                               | 5.0.0         | MIT                                      |
| unist-util-remove-position                        | 5.0.0         | MIT                                      |
| unist-util-stringify-position                     | 4.0.0         | MIT                                      |
| unist-util-visit                                  | 5.0.0         | MIT                                      |
| unist-util-visit-parents                          | 6.0.2         | MIT                                      |
| unpipe                                            | 1.0.0         | MIT                                      |
| update-browserslist-db                            | 1.1.4         | MIT                                      |
| uri-js                                            | 4.4.1         | BSD-2-Clause                             |
| use-sync-external-store                           | 1.6.0         | MIT                                      |
| util-deprecate                                    | 1.0.2         | MIT                                      |
| uuid                                              | 11.1.1        | MIT                                      |
| vary                                              | 1.1.2         | MIT                                      |
| vfile                                             | 6.0.3         | MIT                                      |
| vfile-location                                    | 5.0.3         | MIT                                      |
| vfile-message                                     | 4.0.3         | MIT                                      |
| vite                                              | 7.2.4         | MIT                                      |
| vite-node                                         | 3.2.4         | MIT                                      |
| vitest                                            | 3.2.4         | MIT                                      |
| void-elements                                     | 3.1.0         | MIT                                      |
| w3c-xmlserializer                                 | 5.0.0         | MIT                                      |
| watskeburt                                        | 4.2.3         | MIT                                      |
| web-namespaces                                    | 2.0.1         | MIT                                      |
| webidl-conversions                                | 8.0.1         | BSD-2-Clause                             |
| whatwg-encoding                                   | 3.1.1         | MIT                                      |
| whatwg-mimetype                                   | 4.0.0         | MIT                                      |
| whatwg-mimetype                                   | 5.0.0         | MIT                                      |
| whatwg-url                                        | 15.1.0        | MIT                                      |
| which                                             | 2.0.2         | ISC                                      |
| which-boxed-primitive                             | 1.1.1         | MIT                                      |
| which-builtin-type                                | 1.2.1         | MIT                                      |
| which-collection                                  | 1.0.2         | MIT                                      |
| which-module                                      | 2.0.1         | ISC                                      |
| which-typed-array                                 | 1.1.19        | MIT                                      |
| why-is-node-running                               | 2.3.0         | MIT                                      |
| word-wrap                                         | 1.2.5         | MIT                                      |
| wrap-ansi                                         | 6.2.0         | MIT                                      |
| wrap-ansi                                         | 8.1.0         | MIT                                      |
| wrap-ansi-cjs                                     | 7.0.0         | MIT                                      |
| wrappy                                            | 1.0.2         | ISC                                      |
| ws                                                | 8.21.0        | MIT                                      |
| xlsx                                              | 0.20.3        | Apache-2.0                               |
| xml-name-validator                                | 5.0.0         | Apache-2.0                               |
| xmlchars                                          | 2.2.0         | MIT                                      |
| y18n                                              | 4.0.3         | ISC                                      |
| yallist                                           | 3.1.1         | ISC                                      |
| yargs                                             | 15.4.1        | MIT                                      |
| yargs-parser                                      | 18.1.3        | ISC                                      |
| yocto-queue                                       | 0.1.0         | MIT                                      |
| zod                                               | 4.1.12        | MIT                                      |
| zod-to-json-schema                                | 3.25.2        | ISC                                      |
| zod-validation-error                              | 4.0.2         | MIT                                      |
| zrender                                           | 6.1.0         | BSD-3-Clause                             |
| zwitch                                            | 2.0.4         | MIT                                      |

## Rust dependency inventory

| Package                          | Version                        | Declared license                                                                                                                    |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| accessibility-ng                 | 0.1.6                          | MIT / Apache-2.0                                                                                                                    |
| accessibility-sys-ng             | 0.1.3                          | MIT / Apache-2.0                                                                                                                    |
| active-win-pos-rs                | 0.11.0                         | MIT OR Apache-2.0                                                                                                                   |
| active-win-pos-rs                | 0.8.4                          | MIT OR Apache-2.0                                                                                                                   |
| adler2                           | 2.0.1                          | 0BSD OR MIT OR Apache-2.0                                                                                                           |
| adler32                          | 1.2.0                          | Zlib                                                                                                                                |
| ahash                            | 0.7.8                          | MIT OR Apache-2.0                                                                                                                   |
| aho-corasick                     | 1.1.4                          | Unlicense OR MIT                                                                                                                    |
| alloc-no-stdlib                  | 2.0.4                          | BSD-3-Clause                                                                                                                        |
| alloc-stdlib                     | 0.2.2                          | BSD-3-Clause                                                                                                                        |
| allocator-api2                   | 0.2.21                         | MIT OR Apache-2.0                                                                                                                   |
| android_log-sys                  | 0.3.2                          | MIT OR Apache-2.0                                                                                                                   |
| android_logger                   | 0.15.1                         | MIT OR Apache-2.0                                                                                                                   |
| android_system_properties        | 0.1.5                          | MIT/Apache-2.0                                                                                                                      |
| anyhow                           | 1.0.102                        | MIT OR Apache-2.0                                                                                                                   |
| appkit-nsworkspace-bindings      | 0.1.2                          | MIT OR Apache-2.0                                                                                                                   |
| arbitrary                        | 1.4.2                          | MIT OR Apache-2.0                                                                                                                   |
| arboard                          | 3.6.1                          | MIT OR Apache-2.0                                                                                                                   |
| arc-swap                         | 1.9.1                          | MIT OR Apache-2.0                                                                                                                   |
| arrayvec                         | 0.7.6                          | MIT OR Apache-2.0                                                                                                                   |
| ascii                            | 1.1.0                          | Apache-2.0 OR MIT                                                                                                                   |
| async-broadcast                  | 0.7.2                          | MIT OR Apache-2.0                                                                                                                   |
| async-channel                    | 2.5.0                          | Apache-2.0 OR MIT                                                                                                                   |
| async-executor                   | 1.14.0                         | Apache-2.0 OR MIT                                                                                                                   |
| async-io                         | 2.6.0                          | Apache-2.0 OR MIT                                                                                                                   |
| async-lock                       | 3.4.2                          | Apache-2.0 OR MIT                                                                                                                   |
| async-process                    | 2.5.0                          | Apache-2.0 OR MIT                                                                                                                   |
| async-recursion                  | 1.1.1                          | MIT OR Apache-2.0                                                                                                                   |
| async-signal                     | 0.2.14                         | Apache-2.0 OR MIT                                                                                                                   |
| async-stream                     | 0.3.6                          | MIT                                                                                                                                 |
| async-stream-impl                | 0.3.6                          | MIT                                                                                                                                 |
| async-task                       | 4.7.1                          | Apache-2.0 OR MIT                                                                                                                   |
| async-trait                      | 0.1.89                         | MIT OR Apache-2.0                                                                                                                   |
| atk                              | 0.18.2                         | MIT                                                                                                                                 |
| atk-sys                          | 0.18.2                         | MIT                                                                                                                                 |
| atomic-waker                     | 1.1.2                          | Apache-2.0 OR MIT                                                                                                                   |
| auto-launch                      | 0.5.0                          | MIT                                                                                                                                 |
| autocfg                          | 1.5.0                          | Apache-2.0 OR MIT                                                                                                                   |
| aws-lc-rs                        | 1.16.2                         | ISC AND (Apache-2.0 OR ISC)                                                                                                         |
| aws-lc-sys                       | 0.39.1                         | ISC AND (Apache-2.0 OR ISC) AND Apache-2.0 AND MIT AND BSD-3-Clause AND (Apache-2.0 OR ISC OR MIT) AND (Apache-2.0 OR ISC OR MIT-0) |
| axum                             | 0.8.8                          | MIT                                                                                                                                 |
| axum-core                        | 0.5.6                          | MIT                                                                                                                                 |
| base64                           | 0.21.7                         | MIT OR Apache-2.0                                                                                                                   |
| base64                           | 0.22.1                         | MIT OR Apache-2.0                                                                                                                   |
| bindgen                          | 0.68.1                         | BSD-3-Clause                                                                                                                        |
| bit-set                          | 0.8.0                          | Apache-2.0 OR MIT                                                                                                                   |
| bit-vec                          | 0.8.0                          | Apache-2.0 OR MIT                                                                                                                   |
| bitflags                         | 1.3.2                          | MIT/Apache-2.0                                                                                                                      |
| bitflags                         | 2.11.0                         | MIT OR Apache-2.0                                                                                                                   |
| bitpacking                       | 0.9.3                          | MIT                                                                                                                                 |
| bitvec                           | 1.0.1                          | MIT                                                                                                                                 |
| block                            | 0.1.6                          | MIT                                                                                                                                 |
| block-buffer                     | 0.10.4                         | MIT OR Apache-2.0                                                                                                                   |
| block-sys                        | 0.2.1                          | MIT                                                                                                                                 |
| block2                           | 0.4.0                          | MIT                                                                                                                                 |
| block2                           | 0.6.2                          | MIT                                                                                                                                 |
| blocking                         | 1.6.2                          | Apache-2.0 OR MIT                                                                                                                   |
| borsh                            | 1.6.1                          | MIT OR Apache-2.0                                                                                                                   |
| borsh-derive                     | 1.6.1                          | Apache-2.0                                                                                                                          |
| brotli                           | 8.0.2                          | BSD-3-Clause AND MIT                                                                                                                |
| brotli-decompressor              | 5.0.0                          | BSD-3-Clause/MIT                                                                                                                    |
| bumpalo                          | 3.20.2                         | MIT OR Apache-2.0                                                                                                                   |
| byte-unit                        | 5.2.0                          | MIT                                                                                                                                 |
| bytecheck                        | 0.6.12                         | MIT                                                                                                                                 |
| bytecheck_derive                 | 0.6.12                         | MIT                                                                                                                                 |
| bytemuck                         | 1.25.0                         | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| byteorder                        | 1.5.0                          | Unlicense OR MIT                                                                                                                    |
| byteorder-lite                   | 0.1.0                          | Unlicense OR MIT                                                                                                                    |
| bytes                            | 1.11.1                         | MIT                                                                                                                                 |
| cairo-rs                         | 0.18.5                         | MIT                                                                                                                                 |
| cairo-sys-rs                     | 0.18.2                         | MIT                                                                                                                                 |
| camino                           | 1.2.2                          | MIT OR Apache-2.0                                                                                                                   |
| cargo_metadata                   | 0.19.2                         | MIT                                                                                                                                 |
| cargo_toml                       | 0.22.3                         | Apache-2.0 OR MIT                                                                                                                   |
| cargo-platform                   | 0.1.9                          | MIT OR Apache-2.0                                                                                                                   |
| cc                               | 1.2.59                         | MIT OR Apache-2.0                                                                                                                   |
| cedarwood                        | 0.4.6                          | BSD-2-Clause                                                                                                                        |
| census                           | 0.4.2                          | MIT                                                                                                                                 |
| cesu8                            | 1.1.0                          | Apache-2.0/MIT                                                                                                                      |
| cexpr                            | 0.6.0                          | Apache-2.0/MIT                                                                                                                      |
| cfb                              | 0.7.3                          | MIT                                                                                                                                 |
| cfg_aliases                      | 0.2.1                          | MIT                                                                                                                                 |
| cfg-expr                         | 0.15.8                         | MIT OR Apache-2.0                                                                                                                   |
| cfg-if                           | 1.0.4                          | MIT OR Apache-2.0                                                                                                                   |
| chrono                           | 0.4.44                         | MIT OR Apache-2.0                                                                                                                   |
| chrono-tz                        | 0.10.4                         | MIT OR Apache-2.0                                                                                                                   |
| chunked_transfer                 | 1.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| clang-sys                        | 1.8.1                          | Apache-2.0                                                                                                                          |
| clipboard-win                    | 5.4.1                          | BSL-1.0                                                                                                                             |
| cmake                            | 0.1.58                         | MIT OR Apache-2.0                                                                                                                   |
| cocoa                            | 0.24.1                         | MIT / Apache-2.0                                                                                                                    |
| cocoa-foundation                 | 0.1.2                          | MIT OR Apache-2.0                                                                                                                   |
| combine                          | 4.6.7                          | MIT                                                                                                                                 |
| concurrent-queue                 | 2.5.0                          | Apache-2.0 OR MIT                                                                                                                   |
| convert_case                     | 0.10.0                         | MIT                                                                                                                                 |
| convert_case                     | 0.4.0                          | MIT                                                                                                                                 |
| cookie                           | 0.18.1                         | MIT OR Apache-2.0                                                                                                                   |
| core-foundation                  | 0.10.1                         | MIT OR Apache-2.0                                                                                                                   |
| core-foundation                  | 0.9.4                          | MIT OR Apache-2.0                                                                                                                   |
| core-foundation-sys              | 0.8.7                          | MIT OR Apache-2.0                                                                                                                   |
| core-graphics                    | 0.22.3                         | MIT / Apache-2.0                                                                                                                    |
| core-graphics                    | 0.23.2                         | MIT OR Apache-2.0                                                                                                                   |
| core-graphics                    | 0.25.0                         | MIT OR Apache-2.0                                                                                                                   |
| core-graphics-types              | 0.1.3                          | MIT OR Apache-2.0                                                                                                                   |
| core-graphics-types              | 0.2.0                          | MIT OR Apache-2.0                                                                                                                   |
| core2                            | 0.4.0                          | Apache-2.0 OR MIT                                                                                                                   |
| cpufeatures                      | 0.2.17                         | MIT OR Apache-2.0                                                                                                                   |
| crc32fast                        | 1.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| cron                             | 0.15.0                         | MIT OR Apache-2.0                                                                                                                   |
| crossbeam-channel                | 0.5.15                         | MIT OR Apache-2.0                                                                                                                   |
| crossbeam-deque                  | 0.8.6                          | MIT OR Apache-2.0                                                                                                                   |
| crossbeam-epoch                  | 0.9.18                         | MIT OR Apache-2.0                                                                                                                   |
| crossbeam-utils                  | 0.8.21                         | MIT OR Apache-2.0                                                                                                                   |
| crunchy                          | 0.2.4                          | MIT                                                                                                                                 |
| crypto-common                    | 0.1.7                          | MIT OR Apache-2.0                                                                                                                   |
| cssparser                        | 0.29.6                         | MPL-2.0                                                                                                                             |
| cssparser                        | 0.36.0                         | MPL-2.0                                                                                                                             |
| cssparser-macros                 | 0.6.1                          | MPL-2.0                                                                                                                             |
| ctor                             | 0.2.9                          | Apache-2.0 OR MIT                                                                                                                   |
| darling                          | 0.20.11                        | MIT                                                                                                                                 |
| darling                          | 0.23.0                         | MIT                                                                                                                                 |
| darling_core                     | 0.20.11                        | MIT                                                                                                                                 |
| darling_core                     | 0.23.0                         | MIT                                                                                                                                 |
| darling_macro                    | 0.20.11                        | MIT                                                                                                                                 |
| darling_macro                    | 0.23.0                         | MIT                                                                                                                                 |
| dary_heap                        | 0.3.8                          | MIT OR Apache-2.0                                                                                                                   |
| data-encoding                    | 2.10.0                         | MIT                                                                                                                                 |
| data-url                         | 0.3.2                          | MIT OR Apache-2.0                                                                                                                   |
| dbus                             | 0.9.11                         | Apache-2.0/MIT                                                                                                                      |
| debug_print                      | 1.0.0                          | MIT/Apache-2.0                                                                                                                      |
| deranged                         | 0.5.8                          | MIT OR Apache-2.0                                                                                                                   |
| derive_arbitrary                 | 1.4.2                          | MIT OR Apache-2.0                                                                                                                   |
| derive_builder                   | 0.20.2                         | MIT OR Apache-2.0                                                                                                                   |
| derive_builder_core              | 0.20.2                         | MIT OR Apache-2.0                                                                                                                   |
| derive_builder_macro             | 0.20.2                         | MIT OR Apache-2.0                                                                                                                   |
| derive_more                      | 0.99.20                        | MIT                                                                                                                                 |
| derive_more                      | 2.1.1                          | MIT                                                                                                                                 |
| derive_more-impl                 | 2.1.1                          | MIT                                                                                                                                 |
| digest                           | 0.10.7                         | MIT OR Apache-2.0                                                                                                                   |
| dirs                             | 4.0.0                          | MIT OR Apache-2.0                                                                                                                   |
| dirs                             | 6.0.0                          | MIT OR Apache-2.0                                                                                                                   |
| dirs-sys                         | 0.3.7                          | MIT OR Apache-2.0                                                                                                                   |
| dirs-sys                         | 0.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| dispatch2                        | 0.3.1                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| displaydoc                       | 0.2.5                          | MIT OR Apache-2.0                                                                                                                   |
| dlopen2                          | 0.8.2                          | MIT                                                                                                                                 |
| dlopen2_derive                   | 0.4.3                          | MIT                                                                                                                                 |
| dom_query                        | 0.27.0                         | MIT                                                                                                                                 |
| downcast-rs                      | 1.2.1                          | MIT/Apache-2.0                                                                                                                      |
| dpi                              | 0.1.2                          | Apache-2.0 AND MIT                                                                                                                  |
| dtoa                             | 1.0.11                         | MIT OR Apache-2.0                                                                                                                   |
| dtoa-short                       | 0.3.5                          | MPL-2.0                                                                                                                             |
| dunce                            | 1.0.5                          | CC0-1.0 OR MIT-0 OR Apache-2.0                                                                                                      |
| dyn-clone                        | 1.0.20                         | MIT OR Apache-2.0                                                                                                                   |
| either                           | 1.15.0                         | MIT OR Apache-2.0                                                                                                                   |
| embed_plist                      | 1.2.2                          | MIT OR Apache-2.0                                                                                                                   |
| embed-resource                   | 3.0.8                          | MIT                                                                                                                                 |
| encoding_rs                      | 0.8.35                         | (Apache-2.0 OR MIT) AND BSD-3-Clause                                                                                                |
| endi                             | 1.1.1                          | MIT                                                                                                                                 |
| enigo                            | 0.2.1                          | MIT                                                                                                                                 |
| enumflags2                       | 0.7.12                         | MIT OR Apache-2.0                                                                                                                   |
| enumflags2_derive                | 0.7.12                         | MIT OR Apache-2.0                                                                                                                   |
| env_filter                       | 0.1.4                          | MIT OR Apache-2.0                                                                                                                   |
| equivalent                       | 1.0.2                          | Apache-2.0 OR MIT                                                                                                                   |
| erased-serde                     | 0.4.10                         | MIT OR Apache-2.0                                                                                                                   |
| errno                            | 0.3.14                         | MIT OR Apache-2.0                                                                                                                   |
| error-code                       | 3.3.2                          | BSL-1.0                                                                                                                             |
| event-listener                   | 5.4.1                          | Apache-2.0 OR MIT                                                                                                                   |
| event-listener-strategy          | 0.5.4                          | Apache-2.0 OR MIT                                                                                                                   |
| fastdivide                       | 0.4.2                          | zlib-acknowledgement OR MIT                                                                                                         |
| fastrand                         | 2.4.1                          | Apache-2.0 OR MIT                                                                                                                   |
| fax                              | 0.2.7                          | MIT                                                                                                                                 |
| fdeflate                         | 0.3.7                          | MIT OR Apache-2.0                                                                                                                   |
| fern                             | 0.7.1                          | MIT                                                                                                                                 |
| field-offset                     | 0.3.6                          | MIT OR Apache-2.0                                                                                                                   |
| file-id                          | 0.2.3                          | MIT OR Apache-2.0                                                                                                                   |
| filedescriptor                   | 0.8.3                          | MIT                                                                                                                                 |
| filetime                         | 0.2.27                         | MIT/Apache-2.0                                                                                                                      |
| find-msvc-tools                  | 0.1.9                          | MIT OR Apache-2.0                                                                                                                   |
| flate2                           | 1.1.9                          | MIT OR Apache-2.0                                                                                                                   |
| fnv                              | 1.0.7                          | Apache-2.0 / MIT                                                                                                                    |
| foldhash                         | 0.1.5                          | Zlib                                                                                                                                |
| foldhash                         | 0.2.0                          | Zlib                                                                                                                                |
| foreign-types                    | 0.3.2                          | MIT/Apache-2.0                                                                                                                      |
| foreign-types                    | 0.5.0                          | MIT/Apache-2.0                                                                                                                      |
| foreign-types-macros             | 0.2.3                          | MIT/Apache-2.0                                                                                                                      |
| foreign-types-shared             | 0.1.1                          | MIT/Apache-2.0                                                                                                                      |
| foreign-types-shared             | 0.3.1                          | MIT/Apache-2.0                                                                                                                      |
| form_urlencoded                  | 1.2.2                          | MIT OR Apache-2.0                                                                                                                   |
| fs_extra                         | 1.3.0                          | MIT                                                                                                                                 |
| fs4                              | 0.8.4                          | MIT OR Apache-2.0                                                                                                                   |
| fsevent-sys                      | 4.1.0                          | MIT                                                                                                                                 |
| funty                            | 2.0.0                          | MIT                                                                                                                                 |
| futf                             | 0.1.5                          | MIT / Apache-2.0                                                                                                                    |
| futures                          | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-channel                  | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-core                     | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-executor                 | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-io                       | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-lite                     | 2.6.1                          | Apache-2.0 OR MIT                                                                                                                   |
| futures-macro                    | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-sink                     | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-task                     | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| futures-util                     | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| fuzzy-matcher                    | 0.3.7                          | MIT                                                                                                                                 |
| fxhash                           | 0.2.1                          | Apache-2.0/MIT                                                                                                                      |
| gdk                              | 0.18.2                         | MIT                                                                                                                                 |
| gdk-pixbuf                       | 0.18.5                         | MIT                                                                                                                                 |
| gdk-pixbuf-sys                   | 0.18.0                         | MIT                                                                                                                                 |
| gdk-sys                          | 0.18.2                         | MIT                                                                                                                                 |
| gdkwayland-sys                   | 0.18.2                         | MIT                                                                                                                                 |
| gdkx11                           | 0.18.2                         | MIT                                                                                                                                 |
| gdkx11-sys                       | 0.18.2                         | MIT                                                                                                                                 |
| generic-array                    | 0.14.7                         | MIT                                                                                                                                 |
| get-selected-text                | 0.1.6                          | MIT / Apache-2.0                                                                                                                    |
| gethostname                      | 1.1.0                          | Apache-2.0                                                                                                                          |
| getopts                          | 0.2.24                         | MIT OR Apache-2.0                                                                                                                   |
| getrandom                        | 0.1.16                         | MIT OR Apache-2.0                                                                                                                   |
| getrandom                        | 0.2.17                         | MIT OR Apache-2.0                                                                                                                   |
| getrandom                        | 0.3.4                          | MIT OR Apache-2.0                                                                                                                   |
| getrandom                        | 0.4.2                          | MIT OR Apache-2.0                                                                                                                   |
| gio                              | 0.18.4                         | MIT                                                                                                                                 |
| gio-sys                          | 0.18.1                         | MIT                                                                                                                                 |
| glib                             | 0.18.5                         | MIT                                                                                                                                 |
| glib-macros                      | 0.18.5                         | MIT                                                                                                                                 |
| glib-sys                         | 0.18.1                         | MIT                                                                                                                                 |
| glob                             | 0.3.3                          | MIT OR Apache-2.0                                                                                                                   |
| global-hotkey                    | 0.7.0                          | Apache-2.0 OR MIT                                                                                                                   |
| gobject-sys                      | 0.18.0                         | MIT                                                                                                                                 |
| gtk                              | 0.18.2                         | MIT                                                                                                                                 |
| gtk-sys                          | 0.18.2                         | MIT                                                                                                                                 |
| gtk3-macros                      | 0.18.2                         | MIT                                                                                                                                 |
| h2                               | 0.4.13                         | MIT                                                                                                                                 |
| half                             | 2.7.1                          | MIT OR Apache-2.0                                                                                                                   |
| handlebars                       | 6.4.1                          | MIT                                                                                                                                 |
| hashbrown                        | 0.12.3                         | MIT OR Apache-2.0                                                                                                                   |
| hashbrown                        | 0.15.5                         | MIT OR Apache-2.0                                                                                                                   |
| hashbrown                        | 0.16.1                         | MIT OR Apache-2.0                                                                                                                   |
| hashbrown                        | 0.17.0                         | MIT OR Apache-2.0                                                                                                                   |
| heck                             | 0.4.1                          | MIT OR Apache-2.0                                                                                                                   |
| heck                             | 0.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| hermit-abi                       | 0.5.2                          | MIT OR Apache-2.0                                                                                                                   |
| hex                              | 0.4.3                          | MIT OR Apache-2.0                                                                                                                   |
| home                             | 0.5.12                         | MIT OR Apache-2.0                                                                                                                   |
| html5ever                        | 0.29.1                         | MIT OR Apache-2.0                                                                                                                   |
| html5ever                        | 0.38.0                         | MIT OR Apache-2.0                                                                                                                   |
| htmlescape                       | 0.3.1                          | Apache-2.0 / MIT / MPL-2.0                                                                                                          |
| http                             | 1.4.0                          | MIT OR Apache-2.0                                                                                                                   |
| http-body                        | 1.0.1                          | MIT                                                                                                                                 |
| http-body-util                   | 0.1.3                          | MIT                                                                                                                                 |
| http-range                       | 0.1.5                          | MIT                                                                                                                                 |
| httparse                         | 1.10.1                         | MIT OR Apache-2.0                                                                                                                   |
| httpdate                         | 1.0.3                          | MIT OR Apache-2.0                                                                                                                   |
| hyper                            | 1.9.0                          | MIT                                                                                                                                 |
| hyper-rustls                     | 0.27.7                         | Apache-2.0 OR ISC OR MIT                                                                                                            |
| hyper-util                       | 0.1.20                         | MIT                                                                                                                                 |
| hyprland                         | 0.4.0-beta.3                   | GPL-3.0-or-later                                                                                                                    |
| hyprland-macros                  | 0.4.0-beta.3                   | GPL-3.0-or-later                                                                                                                    |
| iana-time-zone                   | 0.1.65                         | MIT OR Apache-2.0                                                                                                                   |
| iana-time-zone-haiku             | 0.1.2                          | MIT OR Apache-2.0                                                                                                                   |
| ico                              | 0.5.0                          | MIT                                                                                                                                 |
| icrate                           | 0.1.2                          | MIT                                                                                                                                 |
| icu_collections                  | 2.2.0                          | Unicode-3.0                                                                                                                         |
| icu_locale_core                  | 2.2.0                          | Unicode-3.0                                                                                                                         |
| icu_normalizer                   | 2.2.0                          | Unicode-3.0                                                                                                                         |
| icu_normalizer_data              | 2.2.0                          | Unicode-3.0                                                                                                                         |
| icu_properties                   | 2.2.0                          | Unicode-3.0                                                                                                                         |
| icu_properties_data              | 2.2.0                          | Unicode-3.0                                                                                                                         |
| icu_provider                     | 2.2.0                          | Unicode-3.0                                                                                                                         |
| id-arena                         | 2.3.0                          | MIT/Apache-2.0                                                                                                                      |
| ident_case                       | 1.0.1                          | MIT/Apache-2.0                                                                                                                      |
| idna                             | 1.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| idna_adapter                     | 1.2.1                          | Apache-2.0 OR MIT                                                                                                                   |
| image                            | 0.25.10                        | MIT OR Apache-2.0                                                                                                                   |
| image-webp                       | 0.2.4                          | MIT OR Apache-2.0                                                                                                                   |
| include-flate                    | 0.3.2                          | Apache-2.0                                                                                                                          |
| include-flate-codegen            | 0.3.2                          | Apache-2.0                                                                                                                          |
| include-flate-compress           | 0.3.2                          | Apache-2.0                                                                                                                          |
| indexmap                         | 1.9.3                          | Apache-2.0 OR MIT                                                                                                                   |
| indexmap                         | 2.14.0                         | Apache-2.0 OR MIT                                                                                                                   |
| infer                            | 0.19.0                         | MIT                                                                                                                                 |
| inotify                          | 0.11.1                         | ISC                                                                                                                                 |
| inotify-sys                      | 0.1.5                          | ISC                                                                                                                                 |
| instant                          | 0.1.13                         | BSD-3-Clause                                                                                                                        |
| ioctl-rs                         | 0.1.6                          | MIT                                                                                                                                 |
| ipnet                            | 2.12.0                         | MIT OR Apache-2.0                                                                                                                   |
| iri-string                       | 0.7.12                         | MIT OR Apache-2.0                                                                                                                   |
| is-docker                        | 0.2.0                          | MIT                                                                                                                                 |
| is-wsl                           | 0.4.0                          | MIT                                                                                                                                 |
| itertools                        | 0.12.1                         | MIT OR Apache-2.0                                                                                                                   |
| itertools                        | 0.14.0                         | MIT OR Apache-2.0                                                                                                                   |
| itoa                             | 1.0.18                         | MIT OR Apache-2.0                                                                                                                   |
| javascriptcore-rs                | 1.1.2                          | MIT                                                                                                                                 |
| javascriptcore-rs-sys            | 1.1.1                          | MIT                                                                                                                                 |
| jieba-macros                     | 0.7.1                          | MIT                                                                                                                                 |
| jieba-rs                         | 0.7.4                          | MIT                                                                                                                                 |
| jni                              | 0.21.1                         | MIT/Apache-2.0                                                                                                                      |
| jni-sys                          | 0.3.1                          | MIT OR Apache-2.0                                                                                                                   |
| jni-sys                          | 0.4.1                          | MIT OR Apache-2.0                                                                                                                   |
| jni-sys-macros                   | 0.4.1                          | MIT OR Apache-2.0                                                                                                                   |
| jobserver                        | 0.1.34                         | MIT OR Apache-2.0                                                                                                                   |
| js-sys                           | 0.3.94                         | MIT OR Apache-2.0                                                                                                                   |
| json-patch                       | 3.0.1                          | MIT/Apache-2.0                                                                                                                      |
| jsonptr                          | 0.6.3                          | MIT OR Apache-2.0                                                                                                                   |
| junction                         | 1.4.2                          | MIT                                                                                                                                 |
| kdotool                          | 0.2.3                          | Apache-2.0                                                                                                                          |
| keyboard-types                   | 0.7.0                          | MIT OR Apache-2.0                                                                                                                   |
| kqueue                           | 1.1.1                          | MIT                                                                                                                                 |
| kqueue-sys                       | 1.0.4                          | MIT                                                                                                                                 |
| kuchikiki                        | 0.8.8-speedreader              | MIT                                                                                                                                 |
| lazy_static                      | 1.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| lazycell                         | 1.3.0                          | MIT/Apache-2.0                                                                                                                      |
| leb128fmt                        | 0.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| levenshtein_automata             | 0.2.1                          | MIT                                                                                                                                 |
| libappindicator                  | 0.9.0                          | Apache-2.0 OR MIT                                                                                                                   |
| libappindicator-sys              | 0.9.0                          | Apache-2.0 OR MIT                                                                                                                   |
| libc                             | 0.2.184                        | MIT OR Apache-2.0                                                                                                                   |
| libdbus-sys                      | 0.2.7                          | Apache-2.0/MIT                                                                                                                      |
| libflate                         | 2.2.1                          | MIT                                                                                                                                 |
| libflate_lz77                    | 2.2.0                          | MIT                                                                                                                                 |
| libloading                       | 0.7.4                          | ISC                                                                                                                                 |
| libloading                       | 0.8.9                          | ISC                                                                                                                                 |
| libm                             | 0.2.16                         | MIT                                                                                                                                 |
| libredox                         | 0.1.15                         | MIT                                                                                                                                 |
| libz-sys                         | 1.1.29                         | MIT OR Apache-2.0                                                                                                                   |
| linux-raw-sys                    | 0.12.1                         | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| linux-raw-sys                    | 0.4.15                         | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| litemap                          | 0.8.2                          | Unicode-3.0                                                                                                                         |
| lock_api                         | 0.4.14                         | MIT OR Apache-2.0                                                                                                                   |
| log                              | 0.4.29                         | MIT OR Apache-2.0                                                                                                                   |
| lru                              | 0.12.5                         | MIT                                                                                                                                 |
| lru-slab                         | 0.1.2                          | MIT OR Apache-2.0 OR Zlib                                                                                                           |
| lz4_flex                         | 0.11.6                         | MIT                                                                                                                                 |
| mac                              | 0.1.1                          | MIT/Apache-2.0                                                                                                                      |
| mac-notification-sys             | 0.6.12                         | MIT/Apache-2.0                                                                                                                      |
| macos-accessibility-client       | 0.0.1                          | MIT OR Apache-2.0                                                                                                                   |
| malloc_buf                       | 0.0.6                          | MIT                                                                                                                                 |
| markup5ever                      | 0.14.1                         | MIT OR Apache-2.0                                                                                                                   |
| markup5ever                      | 0.38.0                         | MIT OR Apache-2.0                                                                                                                   |
| match_token                      | 0.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| matches                          | 0.1.10                         | MIT                                                                                                                                 |
| matchit                          | 0.8.4                          | MIT AND BSD-3-Clause                                                                                                                |
| measure_time                     | 0.8.3                          | MIT                                                                                                                                 |
| memchr                           | 2.8.0                          | Unlicense OR MIT                                                                                                                    |
| memmap2                          | 0.8.0                          | MIT OR Apache-2.0                                                                                                                   |
| memmap2                          | 0.9.10                         | MIT OR Apache-2.0                                                                                                                   |
| memoffset                        | 0.6.5                          | MIT                                                                                                                                 |
| memoffset                        | 0.9.1                          | MIT                                                                                                                                 |
| mime                             | 0.3.17                         | MIT OR Apache-2.0                                                                                                                   |
| mime_guess                       | 2.0.5                          | MIT                                                                                                                                 |
| minimal-lexical                  | 0.2.1                          | MIT/Apache-2.0                                                                                                                      |
| minisign-verify                  | 0.2.5                          | MIT                                                                                                                                 |
| miniz_oxide                      | 0.8.9                          | MIT OR Zlib OR Apache-2.0                                                                                                           |
| mio                              | 1.2.0                          | MIT                                                                                                                                 |
| moxcms                           | 0.8.1                          | BSD-3-Clause OR Apache-2.0                                                                                                          |
| muda                             | 0.17.2                         | Apache-2.0 OR MIT                                                                                                                   |
| murmurhash32                     | 0.3.1                          | MIT                                                                                                                                 |
| native-tls                       | 0.2.18                         | MIT OR Apache-2.0                                                                                                                   |
| ndk                              | 0.9.0                          | MIT OR Apache-2.0                                                                                                                   |
| ndk-context                      | 0.1.1                          | MIT OR Apache-2.0                                                                                                                   |
| ndk-sys                          | 0.6.0+11769913                 | MIT OR Apache-2.0                                                                                                                   |
| new_debug_unreachable            | 1.0.6                          | MIT                                                                                                                                 |
| nix                              | 0.25.1                         | MIT                                                                                                                                 |
| nix                              | 0.29.0                         | MIT                                                                                                                                 |
| nodrop                           | 0.1.14                         | MIT/Apache-2.0                                                                                                                      |
| nom                              | 7.1.3                          | MIT                                                                                                                                 |
| notify                           | 8.2.0                          | CC0-1.0                                                                                                                             |
| notify-debouncer-full            | 0.6.0                          | MIT OR Apache-2.0                                                                                                                   |
| notify-rust                      | 4.14.0                         | MIT/Apache-2.0                                                                                                                      |
| notify-types                     | 2.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| ntapi                            | 0.4.3                          | Apache-2.0 OR MIT                                                                                                                   |
| num_cpus                         | 1.17.0                         | MIT OR Apache-2.0                                                                                                                   |
| num_enum                         | 0.7.6                          | BSD-3-Clause OR MIT OR Apache-2.0                                                                                                   |
| num_enum_derive                  | 0.7.6                          | BSD-3-Clause OR MIT OR Apache-2.0                                                                                                   |
| num_threads                      | 0.1.7                          | MIT OR Apache-2.0                                                                                                                   |
| num-conv                         | 0.2.1                          | MIT OR Apache-2.0                                                                                                                   |
| num-modular                      | 0.6.2                          | Apache-2.0                                                                                                                          |
| num-order                        | 1.2.0                          | Apache-2.0                                                                                                                          |
| num-traits                       | 0.2.19                         | MIT OR Apache-2.0                                                                                                                   |
| objc                             | 0.2.7                          | MIT                                                                                                                                 |
| objc-sys                         | 0.3.5                          | MIT                                                                                                                                 |
| objc2                            | 0.5.2                          | MIT                                                                                                                                 |
| objc2                            | 0.6.4                          | MIT                                                                                                                                 |
| objc2-app-kit                    | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-cloud-kit                  | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-core-data                  | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-core-foundation            | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-core-graphics              | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-core-image                 | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-core-text                  | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-core-video                 | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-encode                     | 4.1.0                          | MIT                                                                                                                                 |
| objc2-exception-helper           | 0.1.1                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-foundation                 | 0.3.2                          | MIT                                                                                                                                 |
| objc2-io-surface                 | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-javascript-core            | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-osa-kit                    | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-quartz-core                | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-security                   | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-ui-kit                     | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| objc2-web-kit                    | 0.3.2                          | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| once_cell                        | 1.21.4                         | MIT OR Apache-2.0                                                                                                                   |
| oneshot                          | 0.1.13                         | MIT OR Apache-2.0                                                                                                                   |
| open                             | 5.3.3                          | MIT                                                                                                                                 |
| openssl                          | 0.10.76                        | Apache-2.0                                                                                                                          |
| openssl-macros                   | 0.1.1                          | MIT/Apache-2.0                                                                                                                      |
| openssl-probe                    | 0.2.1                          | MIT OR Apache-2.0                                                                                                                   |
| openssl-sys                      | 0.9.112                        | MIT                                                                                                                                 |
| option-ext                       | 0.2.0                          | MPL-2.0                                                                                                                             |
| ordered-stream                   | 0.2.0                          | MIT OR Apache-2.0                                                                                                                   |
| os_pipe                          | 1.2.3                          | MIT                                                                                                                                 |
| osakit                           | 0.3.1                          | MIT OR Apache-2.0                                                                                                                   |
| ownedbytes                       | 0.7.0                          | MIT                                                                                                                                 |
| pango                            | 0.18.3                         | MIT                                                                                                                                 |
| pango-sys                        | 0.18.0                         | MIT                                                                                                                                 |
| parking                          | 2.2.1                          | Apache-2.0 OR MIT                                                                                                                   |
| parking_lot                      | 0.12.5                         | MIT OR Apache-2.0                                                                                                                   |
| parking_lot_core                 | 0.9.12                         | MIT OR Apache-2.0                                                                                                                   |
| pastey                           | 0.1.1                          | MIT OR Apache-2.0                                                                                                                   |
| pastey                           | 0.2.3                          | MIT OR Apache-2.0                                                                                                                   |
| pathdiff                         | 0.2.3                          | MIT/Apache-2.0                                                                                                                      |
| peeking_take_while               | 0.1.2                          | Apache-2.0/MIT                                                                                                                      |
| percent-encoding                 | 2.3.2                          | MIT OR Apache-2.0                                                                                                                   |
| pest                             | 2.8.6                          | MIT OR Apache-2.0                                                                                                                   |
| pest_derive                      | 2.8.6                          | MIT OR Apache-2.0                                                                                                                   |
| pest_generator                   | 2.8.6                          | MIT OR Apache-2.0                                                                                                                   |
| pest_meta                        | 2.8.6                          | MIT OR Apache-2.0                                                                                                                   |
| phf                              | 0.10.1                         | MIT                                                                                                                                 |
| phf                              | 0.11.3                         | MIT                                                                                                                                 |
| phf                              | 0.12.1                         | MIT                                                                                                                                 |
| phf                              | 0.13.1                         | MIT                                                                                                                                 |
| phf                              | 0.8.0                          | MIT                                                                                                                                 |
| phf_codegen                      | 0.11.3                         | MIT                                                                                                                                 |
| phf_codegen                      | 0.13.1                         | MIT                                                                                                                                 |
| phf_codegen                      | 0.8.0                          | MIT                                                                                                                                 |
| phf_generator                    | 0.10.0                         | MIT                                                                                                                                 |
| phf_generator                    | 0.11.3                         | MIT                                                                                                                                 |
| phf_generator                    | 0.13.1                         | MIT                                                                                                                                 |
| phf_generator                    | 0.8.0                          | MIT                                                                                                                                 |
| phf_macros                       | 0.10.0                         | MIT                                                                                                                                 |
| phf_macros                       | 0.11.3                         | MIT                                                                                                                                 |
| phf_macros                       | 0.13.1                         | MIT                                                                                                                                 |
| phf_shared                       | 0.10.0                         | MIT                                                                                                                                 |
| phf_shared                       | 0.11.3                         | MIT                                                                                                                                 |
| phf_shared                       | 0.12.1                         | MIT                                                                                                                                 |
| phf_shared                       | 0.13.1                         | MIT                                                                                                                                 |
| phf_shared                       | 0.8.0                          | MIT                                                                                                                                 |
| pin-project-lite                 | 0.2.17                         | Apache-2.0 OR MIT                                                                                                                   |
| pin-utils                        | 0.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| piper                            | 0.2.5                          | MIT OR Apache-2.0                                                                                                                   |
| pkg-config                       | 0.3.32                         | MIT OR Apache-2.0                                                                                                                   |
| plain                            | 0.2.3                          | MIT/Apache-2.0                                                                                                                      |
| plist                            | 1.8.0                          | MIT                                                                                                                                 |
| png                              | 0.17.16                        | MIT OR Apache-2.0                                                                                                                   |
| png                              | 0.18.1                         | MIT OR Apache-2.0                                                                                                                   |
| polling                          | 3.11.0                         | Apache-2.0 OR MIT                                                                                                                   |
| portable-pty                     | 0.8.1                          | MIT                                                                                                                                 |
| potential_utf                    | 0.1.5                          | Unicode-3.0                                                                                                                         |
| powerfmt                         | 0.2.0                          | MIT OR Apache-2.0                                                                                                                   |
| ppv-lite86                       | 0.2.21                         | MIT OR Apache-2.0                                                                                                                   |
| precomputed-hash                 | 0.1.1                          | MIT                                                                                                                                 |
| prettyplease                     | 0.2.37                         | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-crate                 | 1.3.1                          | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-crate                 | 2.0.2                          | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-crate                 | 3.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-error                 | 1.0.4                          | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-error-attr            | 1.0.4                          | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-error-attr2           | 2.0.0                          | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-error2                | 2.0.1                          | MIT OR Apache-2.0                                                                                                                   |
| proc-macro-hack                  | 0.5.20+deprecated              | MIT OR Apache-2.0                                                                                                                   |
| proc-macro2                      | 1.0.106                        | MIT OR Apache-2.0                                                                                                                   |
| prost                            | 0.13.5                         | Apache-2.0                                                                                                                          |
| prost-derive                     | 0.13.5                         | Apache-2.0                                                                                                                          |
| ptr_meta                         | 0.1.4                          | MIT                                                                                                                                 |
| ptr_meta_derive                  | 0.1.4                          | MIT                                                                                                                                 |
| pulldown-cmark                   | 0.12.2                         | MIT                                                                                                                                 |
| pulldown-cmark-escape            | 0.11.0                         | MIT                                                                                                                                 |
| pxfm                             | 0.1.28                         | BSD-3-Clause OR Apache-2.0                                                                                                          |
| quick-error                      | 2.0.1                          | MIT/Apache-2.0                                                                                                                      |
| quick-xml                        | 0.30.0                         | MIT                                                                                                                                 |
| quick-xml                        | 0.37.5                         | MIT                                                                                                                                 |
| quick-xml                        | 0.38.4                         | MIT                                                                                                                                 |
| quinn                            | 0.11.9                         | MIT OR Apache-2.0                                                                                                                   |
| quinn-proto                      | 0.11.14                        | MIT OR Apache-2.0                                                                                                                   |
| quinn-udp                        | 0.5.14                         | MIT OR Apache-2.0                                                                                                                   |
| quote                            | 1.0.45                         | MIT OR Apache-2.0                                                                                                                   |
| r-efi                            | 5.3.0                          | MIT OR Apache-2.0 OR LGPL-2.1-or-later                                                                                              |
| r-efi                            | 6.0.0                          | MIT OR Apache-2.0 OR LGPL-2.1-or-later                                                                                              |
| radium                           | 0.7.0                          | MIT                                                                                                                                 |
| rand                             | 0.7.3                          | MIT OR Apache-2.0                                                                                                                   |
| rand                             | 0.8.5                          | MIT OR Apache-2.0                                                                                                                   |
| rand                             | 0.9.2                          | MIT OR Apache-2.0                                                                                                                   |
| rand_chacha                      | 0.2.2                          | MIT OR Apache-2.0                                                                                                                   |
| rand_chacha                      | 0.3.1                          | MIT OR Apache-2.0                                                                                                                   |
| rand_chacha                      | 0.9.0                          | MIT OR Apache-2.0                                                                                                                   |
| rand_core                        | 0.5.1                          | MIT OR Apache-2.0                                                                                                                   |
| rand_core                        | 0.6.4                          | MIT OR Apache-2.0                                                                                                                   |
| rand_core                        | 0.9.5                          | MIT OR Apache-2.0                                                                                                                   |
| rand_distr                       | 0.4.3                          | MIT OR Apache-2.0                                                                                                                   |
| rand_hc                          | 0.2.0                          | MIT/Apache-2.0                                                                                                                      |
| rand_pcg                         | 0.2.1                          | MIT OR Apache-2.0                                                                                                                   |
| raw-window-handle                | 0.6.2                          | MIT OR Apache-2.0 OR Zlib                                                                                                           |
| rayon                            | 1.11.0                         | MIT OR Apache-2.0                                                                                                                   |
| rayon-core                       | 1.13.0                         | MIT OR Apache-2.0                                                                                                                   |
| redox_syscall                    | 0.5.18                         | MIT                                                                                                                                 |
| redox_syscall                    | 0.7.3                          | MIT                                                                                                                                 |
| redox_users                      | 0.4.6                          | MIT                                                                                                                                 |
| redox_users                      | 0.5.2                          | MIT                                                                                                                                 |
| ref-cast                         | 1.0.25                         | MIT OR Apache-2.0                                                                                                                   |
| ref-cast-impl                    | 1.0.25                         | MIT OR Apache-2.0                                                                                                                   |
| regex                            | 1.12.3                         | MIT OR Apache-2.0                                                                                                                   |
| regex-automata                   | 0.4.14                         | MIT OR Apache-2.0                                                                                                                   |
| regex-syntax                     | 0.8.10                         | MIT OR Apache-2.0                                                                                                                   |
| rend                             | 0.4.2                          | MIT                                                                                                                                 |
| reqwest                          | 0.13.2                         | MIT OR Apache-2.0                                                                                                                   |
| rfd                              | 0.16.0                         | MIT                                                                                                                                 |
| ring                             | 0.17.14                        | Apache-2.0 AND ISC                                                                                                                  |
| rkyv                             | 0.7.46                         | MIT                                                                                                                                 |
| rkyv_derive                      | 0.7.46                         | MIT                                                                                                                                 |
| rle-decode-fast                  | 1.0.3                          | MIT OR Apache-2.0                                                                                                                   |
| rust_decimal                     | 1.41.0                         | MIT                                                                                                                                 |
| rust-stemmers                    | 1.2.0                          | MIT/BSD-3-Clause                                                                                                                    |
| rustc_version                    | 0.4.1                          | MIT OR Apache-2.0                                                                                                                   |
| rustc-hash                       | 1.1.0                          | Apache-2.0/MIT                                                                                                                      |
| rustc-hash                       | 2.1.2                          | Apache-2.0 OR MIT                                                                                                                   |
| rustix                           | 0.38.44                        | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| rustix                           | 1.1.4                          | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| rustls                           | 0.23.37                        | Apache-2.0 OR ISC OR MIT                                                                                                            |
| rustls-native-certs              | 0.8.3                          | Apache-2.0 OR ISC OR MIT                                                                                                            |
| rustls-pki-types                 | 1.14.0                         | MIT OR Apache-2.0                                                                                                                   |
| rustls-platform-verifier         | 0.6.2                          | MIT OR Apache-2.0                                                                                                                   |
| rustls-platform-verifier-android | 0.1.1                          | MIT OR Apache-2.0                                                                                                                   |
| rustls-webpki                    | 0.103.10                       | ISC                                                                                                                                 |
| rustversion                      | 1.0.22                         | MIT OR Apache-2.0                                                                                                                   |
| ryu                              | 1.0.23                         | Apache-2.0 OR BSL-1.0                                                                                                               |
| same-file                        | 1.0.6                          | Unlicense/MIT                                                                                                                       |
| schannel                         | 0.1.29                         | MIT                                                                                                                                 |
| schemars                         | 0.8.22                         | MIT                                                                                                                                 |
| schemars                         | 0.9.0                          | MIT                                                                                                                                 |
| schemars                         | 1.2.1                          | MIT                                                                                                                                 |
| schemars_derive                  | 0.8.22                         | MIT                                                                                                                                 |
| scopeguard                       | 1.2.0                          | MIT OR Apache-2.0                                                                                                                   |
| seahash                          | 4.1.0                          | MIT                                                                                                                                 |
| security-framework               | 3.7.0                          | MIT OR Apache-2.0                                                                                                                   |
| security-framework-sys           | 2.17.0                         | MIT OR Apache-2.0                                                                                                                   |
| selectors                        | 0.24.0                         | MPL-2.0                                                                                                                             |
| selectors                        | 0.36.1                         | MPL-2.0                                                                                                                             |
| semver                           | 1.0.28                         | MIT OR Apache-2.0                                                                                                                   |
| serde                            | 1.0.228                        | MIT OR Apache-2.0                                                                                                                   |
| serde_core                       | 1.0.228                        | MIT OR Apache-2.0                                                                                                                   |
| serde_derive                     | 1.0.228                        | MIT OR Apache-2.0                                                                                                                   |
| serde_derive_internals           | 0.29.1                         | MIT OR Apache-2.0                                                                                                                   |
| serde_json                       | 1.0.149                        | MIT OR Apache-2.0                                                                                                                   |
| serde_path_to_error              | 0.1.20                         | MIT OR Apache-2.0                                                                                                                   |
| serde_repr                       | 0.1.20                         | MIT OR Apache-2.0                                                                                                                   |
| serde_spanned                    | 0.6.9                          | MIT OR Apache-2.0                                                                                                                   |
| serde_spanned                    | 1.1.1                          | MIT OR Apache-2.0                                                                                                                   |
| serde_urlencoded                 | 0.7.1                          | MIT/Apache-2.0                                                                                                                      |
| serde_with                       | 3.18.0                         | MIT OR Apache-2.0                                                                                                                   |
| serde_with_macros                | 3.18.0                         | MIT OR Apache-2.0                                                                                                                   |
| serde_yaml                       | 0.9.34+deprecated              | MIT OR Apache-2.0                                                                                                                   |
| serde-untagged                   | 0.1.9                          | MIT OR Apache-2.0                                                                                                                   |
| serial                           | 0.4.0                          | MIT                                                                                                                                 |
| serial-core                      | 0.4.0                          | MIT                                                                                                                                 |
| serial-unix                      | 0.4.0                          | MIT                                                                                                                                 |
| serial-windows                   | 0.4.0                          | MIT                                                                                                                                 |
| serialize-to-javascript          | 0.1.2                          | MIT OR Apache-2.0                                                                                                                   |
| serialize-to-javascript-impl     | 0.1.2                          | MIT OR Apache-2.0                                                                                                                   |
| servo_arc                        | 0.2.0                          | MIT OR Apache-2.0                                                                                                                   |
| servo_arc                        | 0.4.3                          | MIT OR Apache-2.0                                                                                                                   |
| sha1                             | 0.10.6                         | MIT OR Apache-2.0                                                                                                                   |
| sha2                             | 0.10.9                         | MIT OR Apache-2.0                                                                                                                   |
| shared_child                     | 1.1.1                          | MIT                                                                                                                                 |
| shared_library                   | 0.1.9                          | Apache-2.0/MIT                                                                                                                      |
| shell-words                      | 1.1.1                          | MIT/Apache-2.0                                                                                                                      |
| shlex                            | 1.3.0                          | MIT OR Apache-2.0                                                                                                                   |
| sigchld                          | 0.2.4                          | MIT                                                                                                                                 |
| signal-hook                      | 0.3.18                         | Apache-2.0/MIT                                                                                                                      |
| signal-hook-registry             | 1.4.8                          | MIT OR Apache-2.0                                                                                                                   |
| simd-adler32                     | 0.3.9                          | MIT                                                                                                                                 |
| simdutf8                         | 0.1.5                          | MIT OR Apache-2.0                                                                                                                   |
| siphasher                        | 0.3.11                         | MIT/Apache-2.0                                                                                                                      |
| siphasher                        | 1.0.2                          | MIT/Apache-2.0                                                                                                                      |
| sketches-ddsketch                | 0.2.2                          | Apache-2.0                                                                                                                          |
| slab                             | 0.4.12                         | MIT                                                                                                                                 |
| smallvec                         | 1.15.1                         | MIT OR Apache-2.0                                                                                                                   |
| socket2                          | 0.6.3                          | MIT OR Apache-2.0                                                                                                                   |
| softbuffer                       | 0.4.8                          | MIT OR Apache-2.0                                                                                                                   |
| soup3                            | 0.5.0                          | MIT                                                                                                                                 |
| soup3-sys                        | 0.5.0                          | MIT                                                                                                                                 |
| stable_deref_trait               | 1.2.1                          | MIT OR Apache-2.0                                                                                                                   |
| string_cache                     | 0.8.9                          | MIT OR Apache-2.0                                                                                                                   |
| string_cache                     | 0.9.0                          | MIT OR Apache-2.0                                                                                                                   |
| string_cache_codegen             | 0.5.4                          | MIT OR Apache-2.0                                                                                                                   |
| string_cache_codegen             | 0.6.1                          | MIT OR Apache-2.0                                                                                                                   |
| strsim                           | 0.11.1                         | MIT                                                                                                                                 |
| subtle                           | 2.6.1                          | BSD-3-Clause                                                                                                                        |
| swift-rs                         | 1.0.7                          | MIT OR Apache-2.0                                                                                                                   |
| syn                              | 1.0.109                        | MIT OR Apache-2.0                                                                                                                   |
| syn                              | 2.0.117                        | MIT OR Apache-2.0                                                                                                                   |
| sync_wrapper                     | 1.0.2                          | Apache-2.0                                                                                                                          |
| synstructure                     | 0.13.2                         | MIT                                                                                                                                 |
| sys-locale                       | 0.3.2                          | MIT OR Apache-2.0                                                                                                                   |
| sysinfo                          | 0.33.1                         | MIT                                                                                                                                 |
| system-configuration             | 0.7.0                          | MIT OR Apache-2.0                                                                                                                   |
| system-configuration-sys         | 0.6.0                          | MIT OR Apache-2.0                                                                                                                   |
| system-deps                      | 6.2.2                          | MIT OR Apache-2.0                                                                                                                   |
| tantivy                          | 0.22.1                         | MIT                                                                                                                                 |
| tantivy-bitpacker                | 0.6.0                          | MIT                                                                                                                                 |
| tantivy-columnar                 | 0.3.0                          | MIT                                                                                                                                 |
| tantivy-common                   | 0.7.0                          | MIT                                                                                                                                 |
| tantivy-fst                      | 0.5.0                          | Unlicense/MIT                                                                                                                       |
| tantivy-jieba                    | 0.11.0                         | MIT                                                                                                                                 |
| tantivy-query-grammar            | 0.22.0                         | MIT                                                                                                                                 |
| tantivy-sstable                  | 0.3.0                          | MIT                                                                                                                                 |
| tantivy-stacker                  | 0.3.0                          | MIT                                                                                                                                 |
| tantivy-tokenizer-api            | 0.3.0                          | MIT                                                                                                                                 |
| tao                              | 0.34.8                         | Apache-2.0                                                                                                                          |
| tao-macros                       | 0.1.3                          | MIT OR Apache-2.0                                                                                                                   |
| tap                              | 1.0.1                          | MIT                                                                                                                                 |
| tar                              | 0.4.45                         | MIT OR Apache-2.0                                                                                                                   |
| target-lexicon                   | 0.12.16                        | Apache-2.0 WITH LLVM-exception                                                                                                      |
| tauri                            | 2.10.3                         | Apache-2.0 OR MIT                                                                                                                   |
| tauri-build                      | 2.5.6                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-codegen                    | 2.5.5                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-macros                     | 2.5.5                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-nspanel                    | 2.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| tauri-plugin                     | 2.5.4                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-autostart           | 2.5.1                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-dialog              | 2.7.0                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-fs                  | 2.5.0                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-global-shortcut     | 2.3.1                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-localhost           | 2.3.2                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-log                 | 2.8.0                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-notification        | 2.3.3                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-process             | 2.3.1                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-shell               | 2.3.5                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-single-instance     | 2.4.1                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-plugin-updater             | 2.10.1                         | Apache-2.0 OR MIT                                                                                                                   |
| tauri-runtime                    | 2.10.1                         | Apache-2.0 OR MIT                                                                                                                   |
| tauri-runtime-wry                | 2.10.1                         | Apache-2.0 OR MIT                                                                                                                   |
| tauri-utils                      | 2.8.3                          | Apache-2.0 OR MIT                                                                                                                   |
| tauri-winres                     | 0.3.5                          | MIT                                                                                                                                 |
| tauri-winrt-notification         | 0.7.2                          | MIT OR Apache-2.0                                                                                                                   |
| tempfile                         | 3.27.0                         | MIT OR Apache-2.0                                                                                                                   |
| tendril                          | 0.4.3                          | MIT/Apache-2.0                                                                                                                      |
| tendril                          | 0.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| termios                          | 0.2.2                          | MIT                                                                                                                                 |
| thiserror                        | 1.0.69                         | MIT OR Apache-2.0                                                                                                                   |
| thiserror                        | 2.0.18                         | MIT OR Apache-2.0                                                                                                                   |
| thiserror-impl                   | 1.0.69                         | MIT OR Apache-2.0                                                                                                                   |
| thiserror-impl                   | 2.0.18                         | MIT OR Apache-2.0                                                                                                                   |
| thread_local                     | 1.1.9                          | MIT OR Apache-2.0                                                                                                                   |
| tiff                             | 0.11.3                         | MIT                                                                                                                                 |
| time                             | 0.3.47                         | MIT OR Apache-2.0                                                                                                                   |
| time-core                        | 0.1.8                          | MIT OR Apache-2.0                                                                                                                   |
| time-macros                      | 0.2.27                         | MIT OR Apache-2.0                                                                                                                   |
| tiny_http                        | 0.12.0                         | MIT OR Apache-2.0                                                                                                                   |
| tinystr                          | 0.8.3                          | Unicode-3.0                                                                                                                         |
| tinyvec                          | 1.11.0                         | Zlib OR Apache-2.0 OR MIT                                                                                                           |
| tinyvec_macros                   | 0.1.1                          | MIT OR Apache-2.0 OR Zlib                                                                                                           |
| tokio                            | 1.51.1                         | MIT                                                                                                                                 |
| tokio-macros                     | 2.7.0                          | MIT                                                                                                                                 |
| tokio-native-tls                 | 0.3.1                          | MIT                                                                                                                                 |
| tokio-rustls                     | 0.26.4                         | MIT OR Apache-2.0                                                                                                                   |
| tokio-tungstenite                | 0.24.0                         | MIT                                                                                                                                 |
| tokio-util                       | 0.7.18                         | MIT                                                                                                                                 |
| toml                             | 0.8.2                          | MIT OR Apache-2.0                                                                                                                   |
| toml                             | 0.9.12+spec-1.1.0              | MIT OR Apache-2.0                                                                                                                   |
| toml_datetime                    | 0.6.3                          | MIT OR Apache-2.0                                                                                                                   |
| toml_datetime                    | 0.7.5+spec-1.1.0               | MIT OR Apache-2.0                                                                                                                   |
| toml_datetime                    | 1.1.1+spec-1.1.0               | MIT OR Apache-2.0                                                                                                                   |
| toml_edit                        | 0.19.15                        | MIT OR Apache-2.0                                                                                                                   |
| toml_edit                        | 0.20.2                         | MIT OR Apache-2.0                                                                                                                   |
| toml_edit                        | 0.25.11+spec-1.1.0             | MIT OR Apache-2.0                                                                                                                   |
| toml_parser                      | 1.1.2+spec-1.1.0               | MIT OR Apache-2.0                                                                                                                   |
| toml_writer                      | 1.1.1+spec-1.1.0               | MIT OR Apache-2.0                                                                                                                   |
| tower                            | 0.5.3                          | MIT                                                                                                                                 |
| tower-http                       | 0.6.8                          | MIT                                                                                                                                 |
| tower-layer                      | 0.3.3                          | MIT                                                                                                                                 |
| tower-service                    | 0.3.3                          | MIT                                                                                                                                 |
| tracing                          | 0.1.44                         | MIT                                                                                                                                 |
| tracing-attributes               | 0.1.31                         | MIT                                                                                                                                 |
| tracing-core                     | 0.1.36                         | MIT                                                                                                                                 |
| trash                            | 5.2.6                          | MIT                                                                                                                                 |
| tray-icon                        | 0.21.3                         | MIT OR Apache-2.0                                                                                                                   |
| try-lock                         | 0.2.5                          | MIT                                                                                                                                 |
| tungstenite                      | 0.24.0                         | MIT OR Apache-2.0                                                                                                                   |
| typeid                           | 1.0.3                          | MIT OR Apache-2.0                                                                                                                   |
| typenum                          | 1.19.0                         | MIT OR Apache-2.0                                                                                                                   |
| ucd-trie                         | 0.1.7                          | MIT OR Apache-2.0                                                                                                                   |
| uds_windows                      | 1.2.1                          | MIT                                                                                                                                 |
| unic-char-property               | 0.9.0                          | MIT/Apache-2.0                                                                                                                      |
| unic-char-range                  | 0.9.0                          | MIT/Apache-2.0                                                                                                                      |
| unic-common                      | 0.9.0                          | MIT/Apache-2.0                                                                                                                      |
| unic-ucd-ident                   | 0.9.0                          | MIT/Apache-2.0                                                                                                                      |
| unic-ucd-version                 | 0.9.0                          | MIT/Apache-2.0                                                                                                                      |
| unicase                          | 2.9.0                          | MIT OR Apache-2.0                                                                                                                   |
| unicode-ident                    | 1.0.24                         | (MIT OR Apache-2.0) AND Unicode-3.0                                                                                                 |
| unicode-segmentation             | 1.13.2                         | MIT OR Apache-2.0                                                                                                                   |
| unicode-width                    | 0.2.2                          | MIT OR Apache-2.0                                                                                                                   |
| unicode-xid                      | 0.2.6                          | MIT OR Apache-2.0                                                                                                                   |
| unsafe-libyaml                   | 0.2.11                         | MIT                                                                                                                                 |
| untrusted                        | 0.9.0                          | ISC                                                                                                                                 |
| url                              | 2.5.8                          | MIT OR Apache-2.0                                                                                                                   |
| urlencoding                      | 2.1.3                          | MIT                                                                                                                                 |
| urlpattern                       | 0.3.0                          | MIT                                                                                                                                 |
| utf-8                            | 0.7.6                          | MIT OR Apache-2.0                                                                                                                   |
| utf8_iter                        | 1.0.4                          | Apache-2.0 OR MIT                                                                                                                   |
| utf8-ranges                      | 1.0.5                          | Unlicense/MIT                                                                                                                       |
| utf8-width                       | 0.1.8                          | MIT                                                                                                                                 |
| uuid                             | 1.23.0                         | Apache-2.0 OR MIT                                                                                                                   |
| value-bag                        | 1.12.0                         | Apache-2.0 OR MIT                                                                                                                   |
| vcpkg                            | 0.2.15                         | MIT/Apache-2.0                                                                                                                      |
| version_check                    | 0.9.5                          | MIT/Apache-2.0                                                                                                                      |
| version-compare                  | 0.2.1                          | MIT                                                                                                                                 |
| vswhom                           | 0.1.0                          | MIT                                                                                                                                 |
| vswhom-sys                       | 0.1.3                          | MIT                                                                                                                                 |
| walkdir                          | 2.5.0                          | Unlicense/MIT                                                                                                                       |
| want                             | 0.3.1                          | MIT                                                                                                                                 |
| wasi                             | 0.11.1+wasi-snapshot-preview1  | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wasi                             | 0.9.0+wasi-snapshot-preview1   | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wasip2                           | 1.0.2+wasi-0.2.9               | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wasip3                           | 0.4.0+wasi-0.3.0-rc-2026-01-06 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wasm-bindgen                     | 0.2.117                        | MIT OR Apache-2.0                                                                                                                   |
| wasm-bindgen-futures             | 0.4.67                         | MIT OR Apache-2.0                                                                                                                   |
| wasm-bindgen-macro               | 0.2.117                        | MIT OR Apache-2.0                                                                                                                   |
| wasm-bindgen-macro-support       | 0.2.117                        | MIT OR Apache-2.0                                                                                                                   |
| wasm-bindgen-shared              | 0.2.117                        | MIT OR Apache-2.0                                                                                                                   |
| wasm-encoder                     | 0.244.0                        | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wasm-metadata                    | 0.244.0                        | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wasm-streams                     | 0.5.0                          | MIT OR Apache-2.0                                                                                                                   |
| wasmparser                       | 0.244.0                        | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| web_atoms                        | 0.2.3                          | MIT OR Apache-2.0                                                                                                                   |
| web-sys                          | 0.3.94                         | MIT OR Apache-2.0                                                                                                                   |
| web-time                         | 1.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| webkit2gtk                       | 2.0.2                          | MIT                                                                                                                                 |
| webkit2gtk-sys                   | 2.0.2                          | MIT                                                                                                                                 |
| webpki-root-certs                | 1.0.6                          | CDLA-Permissive-2.0                                                                                                                 |
| webview2-com                     | 0.38.2                         | MIT                                                                                                                                 |
| webview2-com-macros              | 0.8.1                          | MIT                                                                                                                                 |
| webview2-com-sys                 | 0.38.2                         | MIT                                                                                                                                 |
| weezl                            | 0.1.12                         | MIT OR Apache-2.0                                                                                                                   |
| which                            | 4.4.2                          | MIT                                                                                                                                 |
| which                            | 8.0.2                          | MIT                                                                                                                                 |
| winapi                           | 0.3.9                          | MIT/Apache-2.0                                                                                                                      |
| winapi-i686-pc-windows-gnu       | 0.4.0                          | MIT/Apache-2.0                                                                                                                      |
| winapi-util                      | 0.1.11                         | Unlicense OR MIT                                                                                                                    |
| winapi-x86_64-pc-windows-gnu     | 0.4.0                          | MIT/Apache-2.0                                                                                                                      |
| window-vibrancy                  | 0.6.0                          | Apache-2.0 OR MIT                                                                                                                   |
| windows                          | 0.48.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows                          | 0.56.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows                          | 0.57.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows                          | 0.61.3                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_gnullvm          | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_gnullvm          | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_gnullvm          | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_gnullvm          | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_msvc             | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_msvc             | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_msvc             | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_aarch64_msvc             | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_gnu                 | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_gnu                 | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_gnu                 | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_gnu                 | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_gnullvm             | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_gnullvm             | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_msvc                | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_msvc                | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_msvc                | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_i686_msvc                | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnu               | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnu               | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnu               | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnu               | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnullvm           | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnullvm           | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnullvm           | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_gnullvm           | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_msvc              | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_msvc              | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_msvc              | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows_x86_64_msvc              | 0.53.1                         | MIT OR Apache-2.0                                                                                                                   |
| windows-collections              | 0.2.0                          | MIT OR Apache-2.0                                                                                                                   |
| windows-core                     | 0.56.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-core                     | 0.57.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-core                     | 0.61.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows-core                     | 0.62.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows-future                   | 0.2.1                          | MIT OR Apache-2.0                                                                                                                   |
| windows-implement                | 0.56.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-implement                | 0.57.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-implement                | 0.60.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows-interface                | 0.56.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-interface                | 0.57.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-interface                | 0.59.3                         | MIT OR Apache-2.0                                                                                                                   |
| windows-link                     | 0.1.3                          | MIT OR Apache-2.0                                                                                                                   |
| windows-link                     | 0.2.1                          | MIT OR Apache-2.0                                                                                                                   |
| windows-numerics                 | 0.2.0                          | MIT OR Apache-2.0                                                                                                                   |
| windows-registry                 | 0.6.1                          | MIT OR Apache-2.0                                                                                                                   |
| windows-result                   | 0.1.2                          | MIT OR Apache-2.0                                                                                                                   |
| windows-result                   | 0.3.4                          | MIT OR Apache-2.0                                                                                                                   |
| windows-result                   | 0.4.1                          | MIT OR Apache-2.0                                                                                                                   |
| windows-strings                  | 0.4.2                          | MIT OR Apache-2.0                                                                                                                   |
| windows-strings                  | 0.5.1                          | MIT OR Apache-2.0                                                                                                                   |
| windows-sys                      | 0.45.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-sys                      | 0.52.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-sys                      | 0.59.0                         | MIT OR Apache-2.0                                                                                                                   |
| windows-sys                      | 0.60.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows-sys                      | 0.61.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows-targets                  | 0.42.2                         | MIT OR Apache-2.0                                                                                                                   |
| windows-targets                  | 0.48.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows-targets                  | 0.52.6                         | MIT OR Apache-2.0                                                                                                                   |
| windows-targets                  | 0.53.5                         | MIT OR Apache-2.0                                                                                                                   |
| windows-threading                | 0.1.0                          | MIT OR Apache-2.0                                                                                                                   |
| windows-version                  | 0.1.7                          | MIT OR Apache-2.0                                                                                                                   |
| winnow                           | 0.5.40                         | MIT                                                                                                                                 |
| winnow                           | 0.6.26                         | MIT                                                                                                                                 |
| winnow                           | 0.7.15                         | MIT                                                                                                                                 |
| winnow                           | 1.0.1                          | MIT                                                                                                                                 |
| winreg                           | 0.10.1                         | MIT                                                                                                                                 |
| winreg                           | 0.55.0                         | MIT                                                                                                                                 |
| wit-bindgen                      | 0.51.0                         | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wit-bindgen-core                 | 0.51.0                         | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wit-bindgen-rust                 | 0.51.0                         | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wit-bindgen-rust-macro           | 0.51.0                         | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wit-component                    | 0.244.0                        | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| wit-parser                       | 0.244.0                        | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT                                                                                 |
| writeable                        | 0.6.3                          | Unicode-3.0                                                                                                                         |
| wry                              | 0.54.4                         | Apache-2.0 OR MIT                                                                                                                   |
| wyz                              | 0.5.1                          | MIT                                                                                                                                 |
| x11                              | 2.21.0                         | MIT                                                                                                                                 |
| x11-dl                           | 2.21.0                         | MIT                                                                                                                                 |
| x11rb                            | 0.13.2                         | MIT OR Apache-2.0                                                                                                                   |
| x11rb-protocol                   | 0.13.2                         | MIT OR Apache-2.0                                                                                                                   |
| xattr                            | 1.6.1                          | MIT OR Apache-2.0                                                                                                                   |
| xcb                              | 1.7.0                          | MIT                                                                                                                                 |
| xkbcommon                        | 0.7.0                          | MIT                                                                                                                                 |
| xkeysym                          | 0.2.1                          | MIT OR Apache-2.0 OR Zlib                                                                                                           |
| yoke                             | 0.8.2                          | Unicode-3.0                                                                                                                         |
| yoke-derive                      | 0.8.2                          | Unicode-3.0                                                                                                                         |
| zbus                             | 5.14.0                         | MIT                                                                                                                                 |
| zbus_macros                      | 5.14.0                         | MIT                                                                                                                                 |
| zbus_names                       | 4.3.1                          | MIT                                                                                                                                 |
| zerocopy                         | 0.8.48                         | BSD-2-Clause OR Apache-2.0 OR MIT                                                                                                   |
| zerocopy-derive                  | 0.8.48                         | BSD-2-Clause OR Apache-2.0 OR MIT                                                                                                   |
| zerofrom                         | 0.1.7                          | Unicode-3.0                                                                                                                         |
| zerofrom-derive                  | 0.1.7                          | Unicode-3.0                                                                                                                         |
| zeroize                          | 1.8.2                          | Apache-2.0 OR MIT                                                                                                                   |
| zerotrie                         | 0.2.4                          | Unicode-3.0                                                                                                                         |
| zerovec                          | 0.11.6                         | Unicode-3.0                                                                                                                         |
| zerovec-derive                   | 0.11.3                         | Unicode-3.0                                                                                                                         |
| zip                              | 2.4.2                          | MIT                                                                                                                                 |
| zip                              | 4.6.1                          | MIT                                                                                                                                 |
| zmij                             | 1.0.21                         | MIT                                                                                                                                 |
| zstd                             | 0.13.3                         | MIT                                                                                                                                 |
| zstd-safe                        | 7.2.4                          | MIT OR Apache-2.0                                                                                                                   |
| zstd-sys                         | 2.0.16+zstd.1.5.7              | MIT/Apache-2.0                                                                                                                      |
| zune-core                        | 0.5.1                          | MIT OR Apache-2.0 OR Zlib                                                                                                           |
| zune-jpeg                        | 0.5.15                         | MIT OR Apache-2.0 OR Zlib                                                                                                           |
| zvariant                         | 5.10.0                         | MIT                                                                                                                                 |
| zvariant_derive                  | 5.10.0                         | MIT                                                                                                                                 |
| zvariant_utils                   | 3.3.0                          | MIT                                                                                                                                 |
