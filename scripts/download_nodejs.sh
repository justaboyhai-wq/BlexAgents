#!/bin/bash
# Download Node.js LTS binaries for bundling with BlexAgent.
#
# This script downloads the official Node.js distribution into an
# architecture-specific cache, then stages the requested runtime into
# src-tauri/resources/nodejs/ for Tauri bundling.
#
# The full distribution includes node, npm, and npx — everything needed
# for MCP servers and AI bash tool execution.
#
# Usage:
#   ./scripts/download_nodejs.sh              # Download for current platform only
#   ./scripts/download_nodejs.sh --target arm64|x64  # Download specific macOS arch
#   ./scripts/download_nodejs.sh --all        # Populate all macOS caches, stage host arch
#   ./scripts/download_nodejs.sh --clean      # Remove staged runtime and all caches first

set -e

# ========================================
# Configuration
# ========================================
NODE_VERSION="24.14.0"  # Active LTS — moltbot 等包要求 >=24，不可降级
NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOURCES_DIR="${PROJECT_DIR}/src-tauri/resources/nodejs"
CACHE_ROOT="${PROJECT_DIR}/src-tauri/resources/nodejs-cache"

# package.json is the single source of truth for the bundled npm version.
# Never query the registry's moving latest tag: identical source revisions
# must produce identical desktop packages.
NPM_VERSION=$(sed -n 's|^[[:space:]]*"packageManager"[[:space:]]*:[[:space:]]*"npm@\([^"]*\)".*|\1|p' \
    "${PROJECT_DIR}/package.json" | head -1)
if [[ ! "$NPM_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "[nodejs] Invalid or missing npm packageManager version in package.json: '${NPM_VERSION}'" >&2
    exit 1
fi
SYSTEM_NODE_BIN=$(command -v node 2>/dev/null || true)
if [[ -z "$SYSTEM_NODE_BIN" || ! -x "$SYSTEM_NODE_BIN" ]]; then
    echo "[nodejs] A host Node.js executable is required to verify the npm package" >&2
    exit 1
fi
NPM_METADATA_URL="https://registry.npmjs.org/npm/${NPM_VERSION}"
NPM_TARBALL_URL="https://registry.npmjs.org/npm/-/npm-${NPM_VERSION}.tgz"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ========================================
# Helpers
# ========================================

log_info()  { echo -e "${BLUE}[nodejs]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[nodejs]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[nodejs]${NC} $1"; }
log_error() { echo -e "${RED}[nodejs]${NC} $1"; }

normalize_arch() {
    case "$1" in
        arm64|aarch64) echo "arm64" ;;
        x64|x86_64) echo "x64" ;;
        *) echo "$1" ;;
    esac
}

cache_dir_for() {
    local platform="$1"
    local arch
    arch=$(normalize_arch "$2")
    echo "${CACHE_ROOT}/${platform}-${arch}-v${NODE_VERSION}"
}

node_bin_for_dir() {
    local dir="$1"
    local platform="$2"
    if [[ "$platform" == "win" ]]; then
        echo "${dir}/node.exe"
    else
        echo "${dir}/bin/node"
    fi
}

write_metadata() {
    local dir="$1"
    local platform="$2"
    local arch
    arch=$(normalize_arch "$3")
    printf "%s\n" "$NODE_VERSION" > "${dir}/.blexagent-nodejs-version"
    printf "%s\n" "$platform" > "${dir}/.blexagent-nodejs-platform"
    printf "%s\n" "$arch" > "${dir}/.blexagent-nodejs-arch"
    printf "%s\n" "$NPM_VERSION" > "${dir}/.blexagent-nodejs-npm-version"

    # One-way migration after the runtime has passed every validation. Readers
    # still accept legacy markers, so interrupted upgrades remain recoverable.
    rm -f "${dir}/.myagents-nodejs-version" \
        "${dir}/.myagents-nodejs-platform" \
        "${dir}/.myagents-nodejs-arch"
}

read_metadata() {
    local dir="$1"
    local key="$2"
    local current="${dir}/.blexagent-nodejs-${key}"
    local legacy="${dir}/.myagents-nodejs-${key}"

    if [[ -f "$current" ]]; then
        cat "$current" 2>/dev/null || true
    elif [[ -f "$legacy" ]]; then
        cat "$legacy" 2>/dev/null || true
    fi
}

npm_dir_for_runtime() {
    local dir="$1"
    local platform="$2"
    if [[ "$platform" == "win" ]]; then
        echo "${dir}/node_modules/npm"
    else
        echo "${dir}/lib/node_modules/npm"
    fi
}

read_npm_manifest_version() {
    local npm_dir="$1"
    "$SYSTEM_NODE_BIN" - "$npm_dir" <<'NODE' 2>/dev/null || true
const fs = require('node:fs')
const path = require('node:path')
const npmDir = process.argv[2]
const manifest = JSON.parse(fs.readFileSync(path.join(npmDir, 'package.json'), 'utf8'))
if (typeof manifest.version === 'string') process.stdout.write(manifest.version)
NODE
}

validate_npm_tree() {
    local npm_dir="$1"
    "$SYSTEM_NODE_BIN" - "$npm_dir" "$NPM_VERSION" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')

const npmDir = path.resolve(process.argv[2])
const expectedVersion = process.argv[3]

const fail = (message) => {
  console.error(`[nodejs] npm tree validation failed: ${message}`)
  process.exit(1)
}
const readManifest = (relativeDir) => {
  const manifestPath = path.join(npmDir, relativeDir, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    fail(`${path.relative(npmDir, manifestPath)}: ${error.message}`)
  }
  return manifest
}
const requireFile = (relativePath) => {
  const absolutePath = path.join(npmDir, relativePath)
  let stat
  try {
    stat = fs.statSync(absolutePath)
  } catch (error) {
    fail(`${relativePath}: ${error.message}`)
  }
  if (!stat.isFile()) fail(`${relativePath} is not a regular file`)
}

const npmManifest = readManifest('.')
if (npmManifest.name !== 'npm') fail(`expected package name npm, got ${npmManifest.name || '<missing>'}`)
if (npmManifest.version !== expectedVersion) {
  fail(`expected npm ${expectedVersion}, got ${npmManifest.version || '<missing>'}`)
}
if (!npmManifest.bin || npmManifest.bin.npm !== 'bin/npm-cli.js') {
  fail('package.json bin.npm does not point to bin/npm-cli.js')
}
for (const entry of ['bin/npm-cli.js', 'lib/cli/entry.js', 'lib/npm.js']) requireFile(entry)

const bundledPackages = [
  ['node_modules/minizlib', 'minizlib', 'dist/commonjs/index.js'],
  ['node_modules/minipass', 'minipass', 'dist/commonjs/index.js'],
  ['node_modules/@npmcli/arborist', '@npmcli/arborist', 'lib/index.js'],
]
for (const [relativeDir, expectedName, expectedEntry] of bundledPackages) {
  const manifest = readManifest(relativeDir)
  if (manifest.name !== expectedName) {
    fail(`${relativeDir}/package.json: expected name ${expectedName}, got ${manifest.name || '<missing>'}`)
  }
  if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    fail(`${relativeDir}/package.json: invalid version ${manifest.version || '<missing>'}`)
  }
  const normalizedMain = typeof manifest.main === 'string' ? manifest.main.replace(/^\.\//, '') : ''
  if (normalizedMain !== expectedEntry) {
    fail(`${relativeDir}/package.json: expected main ${expectedEntry}, got ${manifest.main || '<missing>'}`)
  }
  requireFile(`${relativeDir}/${expectedEntry}`)
}
NODE
}

validate_npm_download() {
    local metadata_file="$1"
    local tarball_file="$2"
    "$SYSTEM_NODE_BIN" - "$metadata_file" "$tarball_file" "$NPM_VERSION" "$NPM_TARBALL_URL" <<'NODE'
const crypto = require('node:crypto')
const fs = require('node:fs')

const [metadataPath, tarballPath, expectedVersion, canonicalTarball] = process.argv.slice(2)
const fail = (message) => {
  console.error(`[nodejs] npm download validation failed: ${message}`)
  process.exit(1)
}

let metadata
try {
  metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
} catch (error) {
  fail(`invalid registry metadata: ${error.message}`)
}
if (metadata.name !== 'npm') fail(`expected metadata name npm, got ${metadata.name || '<missing>'}`)
if (metadata.version !== expectedVersion) {
  fail(`expected metadata version ${expectedVersion}, got ${metadata.version || '<missing>'}`)
}
if (!metadata.dist || metadata.dist.tarball !== canonicalTarball) {
  fail(`expected canonical tarball ${canonicalTarball}, got ${metadata.dist?.tarball || '<missing>'}`)
}
const integrity = metadata.dist.integrity
if (typeof integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) {
  fail('registry metadata does not contain a single SHA-512 integrity value')
}
let tarball
try {
  tarball = fs.readFileSync(tarballPath)
} catch (error) {
  fail(`cannot read tarball: ${error.message}`)
}
const actual = `sha512-${crypto.createHash('sha512').update(tarball).digest('base64')}`
if (actual !== integrity) fail('tarball SHA-512 integrity does not match registry metadata')
NODE
}

check_binary_format() {
    local node_bin="$1"
    local platform="$2"
    local expected_arch
    expected_arch=$(normalize_arch "$3")
    local file_info
    file_info=$(file "$node_bin" 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "")
    if [[ -z "$file_info" ]]; then
        log_warn "Unable to inspect runtime binary: ${node_bin}"
        return 1
    fi

    case "$platform" in
        darwin) [[ "$file_info" == *"mach-o"* ]] || return 1 ;;
        linux) [[ "$file_info" == *"elf"* ]] || return 1 ;;
        win) [[ "$file_info" == *"pe32"* ]] || return 1 ;;
        *) return 1 ;;
    esac

    if [[ "$expected_arch" == "arm64" ]]; then
        if [[ "$file_info" != *"arm64"* && "$file_info" != *"aarch64"* ]]; then
            log_warn "Architecture mismatch: expected arm64, got ${file_info:-unknown}"
            return 1
        fi
    elif [[ "$expected_arch" == "x64" ]]; then
        if [[ "$file_info" != *"x86_64"* && "$file_info" != *"x86-64"* ]]; then
            log_warn "Architecture mismatch: expected x64, got ${file_info:-unknown}"
            return 1
        fi
    fi
    return 0
}
# Install the pinned npm tarball directly (bypasses broken npm — no catch-22).
# Node.js v24 bundles npm 11.9.0 whose minizlib crashes on Windows with
# "Class extends value undefined". Self-upgrade through npm cannot work when
# npm itself is broken, so package.json#packageManager selects the exact
# tarball downloaded by curl.
#
# Usage: upgrade_npm <npm_modules_dir> <new_node_bin_or_empty>
#   npm_modules_dir: path containing npm/ (e.g., .../lib/node_modules or .../node_modules)
#   new_node_bin:    newly downloaded node binary for optional CLI verification
upgrade_npm() {
    local npm_modules_dir="$1"
    local new_node_bin="$2"
    local npm_dir="${npm_modules_dir}/npm"

    if [[ ! -d "$npm_dir" ]]; then
        log_error "npm directory not found at ${npm_dir}"
        return 1
    fi

    local old_ver
    old_ver=$(read_npm_manifest_version "$npm_dir")
    old_ver=${old_ver:-unknown}
    if [[ "$old_ver" == "$NPM_VERSION" ]]; then
        if validate_npm_tree "$npm_dir"; then
            log_ok "npm v${NPM_VERSION} already matches packageManager and passed validation"
            return 0
        fi
        log_warn "npm v${NPM_VERSION} is incomplete; replacing it from the verified tarball"
    fi
    log_info "Installing pinned npm v${NPM_VERSION} (curl + tar, bypasses broken npm)... current: v${old_ver}"

    local tmp_dir
    tmp_dir=$(mktemp -d)

    log_info "Downloading fixed registry metadata: ${NPM_METADATA_URL}"
    if ! curl -fsSL --retry 3 --retry-delay 2 "$NPM_METADATA_URL" -o "${tmp_dir}/metadata.json"; then
        log_error "Failed to download npm v${NPM_VERSION} metadata"
        rm -rf "$tmp_dir"
        return 1
    fi

    log_info "Downloading canonical tarball: ${NPM_TARBALL_URL}"
    if ! curl -fsSL --retry 3 --retry-delay 2 "$NPM_TARBALL_URL" -o "${tmp_dir}/npm.tgz"; then
        log_error "Failed to download npm v${NPM_VERSION} tarball"
        rm -rf "$tmp_dir"
        return 1
    fi

    if ! validate_npm_download "${tmp_dir}/metadata.json" "${tmp_dir}/npm.tgz"; then
        rm -rf "$tmp_dir"
        return 1
    fi

    if ! tar -xzf "${tmp_dir}/npm.tgz" -C "$tmp_dir" 2>/dev/null; then
        log_error "Failed to extract npm tarball"
        rm -rf "$tmp_dir"
        return 1
    fi

    local extracted="${tmp_dir}/package"
    if [[ ! -d "$extracted" ]]; then
        log_error "Extracted npm tarball missing 'package' directory"
        rm -rf "$tmp_dir"
        return 1
    fi
    if ! validate_npm_tree "$extracted"; then
        rm -rf "$tmp_dir"
        return 1
    fi

    local staging_dir="${npm_modules_dir}/.npm-blexagent-staging-$$"
    local backup_dir="${npm_modules_dir}/.npm-blexagent-backup-$$"
    rm -rf "$staging_dir" "$backup_dir"
    if ! mv "$extracted" "$staging_dir"; then
        log_error "Failed to stage verified npm package"
        rm -rf "$tmp_dir" "$staging_dir"
        return 1
    fi
    if ! validate_npm_tree "$staging_dir"; then
        rm -rf "$tmp_dir" "$staging_dir"
        return 1
    fi

    if ! mv "$npm_dir" "$backup_dir"; then
        log_error "Failed to preserve existing npm package before replacement"
        rm -rf "$tmp_dir" "$staging_dir"
        return 1
    fi
    if ! mv "$staging_dir" "$npm_dir"; then
        log_error "Failed to activate verified npm package"
        mv "$backup_dir" "$npm_dir" 2>/dev/null || true
        rm -rf "$tmp_dir" "$staging_dir"
        return 1
    fi

    if ! validate_npm_tree "$npm_dir"; then
        log_error "npm verification failed after install; restoring previous package"
        rm -rf "$npm_dir"
        mv "$backup_dir" "$npm_dir" 2>/dev/null || true
        rm -rf "$tmp_dir"
        return 1
    fi

    # Executing npm is optional and only happens after the verified replacement
    # is active. The pre-existing npm CLI is never executed.
    local new_ver="$NPM_VERSION"
    if [[ -n "$new_node_bin" && -x "$new_node_bin" ]] && \
        "$new_node_bin" --version >/dev/null 2>&1; then
        new_ver=$("$new_node_bin" "${npm_dir}/bin/npm-cli.js" --version 2>/dev/null || echo "unknown")
    fi
    if [[ "$new_ver" != "$NPM_VERSION" ]]; then
        log_error "new npm CLI verification failed: expected v${NPM_VERSION}, got v${new_ver:-unknown}"
        rm -rf "$npm_dir"
        mv "$backup_dir" "$npm_dir" 2>/dev/null || true
        rm -rf "$tmp_dir"
        return 1
    fi

    rm -rf "$backup_dir"
    log_ok "npm pinned: v${old_ver} → v${new_ver}"
    rm -rf "$tmp_dir"
}
# Check if a staged/cache tree contains the expected Node.js version and arch.
# Usage: check_existing <dir> <platform> [expected_arch]
#   platform: darwin | linux | win
#   expected_arch: arm64 | x64 (optional for win)
check_existing() {
    local dir="$1"
    local platform="$2"
    local expected_arch
    expected_arch=$(normalize_arch "$3")
    local node_bin
    node_bin=$(node_bin_for_dir "$dir" "$platform")

    if [[ -f "$node_bin" ]]; then
        case "$dir" in
            "$CACHE_ROOT"/*)
                if [[ -z "$(read_metadata "$dir" version)" ]]; then
                    return 1
                fi
                ;;
        esac

        local existing_ver
        if [[ -n "$(read_metadata "$dir" version)" ]]; then
            existing_ver=$(read_metadata "$dir" version)
        else
            # Cross-arch binaries may not execute on every host, so metadata is
            # the source of truth after the first cache population. This fallback
            # only supports pre-cache staged directories from older checkouts.
            existing_ver=$("$node_bin" --version 2>/dev/null | sed 's/^v//' || echo "")
        fi
        if [[ "$existing_ver" != "${NODE_VERSION}" ]]; then
            return 1
        fi

        if [[ -n "$(read_metadata "$dir" platform)" ]]; then
            local existing_platform
            existing_platform=$(read_metadata "$dir" platform)
            if [[ "$existing_platform" != "$platform" ]]; then
                return 1
            fi
        fi
        if [[ -n "$expected_arch" && -n "$(read_metadata "$dir" arch)" ]]; then
            local existing_arch
            existing_arch=$(normalize_arch "$(read_metadata "$dir" arch)")
            if [[ "$existing_arch" != "$expected_arch" ]]; then
                return 1
            fi
        fi
        if [[ -n "$expected_arch" ]]; then
            check_binary_format "$node_bin" "$platform" "$expected_arch" || return 1
        fi

        local npm_dir
        npm_dir=$(npm_dir_for_runtime "$dir" "$platform")
        if ! validate_npm_tree "$npm_dir"; then
            log_warn "npm package validation failed in ${dir}"
            return 1
        fi
        local marker_npm_version
        marker_npm_version=$(read_metadata "$dir" npm-version)
        if [[ -n "$marker_npm_version" && "$marker_npm_version" != "$NPM_VERSION" ]]; then
            log_warn "npm metadata mismatch in ${dir}: expected ${NPM_VERSION}, got ${marker_npm_version}"
            return 1
        fi

        # Persist current markers only after all checks pass. This also migrates
        # an otherwise valid runtime from the legacy MyAgents marker names.
        write_metadata "$dir" "$platform" "$expected_arch"
        return 0
    fi
    return 1
}
stage_nodejs() {
    local cache_dir="$1"
    local platform="$2"
    local arch
    arch=$(normalize_arch "$3")

    if ! check_existing "$cache_dir" "$platform" "$arch"; then
        log_error "Cache is not usable: ${cache_dir}"
        return 1
    fi

    rm -rf "$RESOURCES_DIR"
    mkdir -p "$RESOURCES_DIR"
    cp -R "${cache_dir}/." "$RESOURCES_DIR/"

    if ! check_existing "$RESOURCES_DIR" "$platform" "$arch"; then
        log_error "Staged Node.js failed verification: ${RESOURCES_DIR}"
        return 1
    fi

    log_ok "Staged ${platform}-${arch} Node.js v${NODE_VERSION} from cache"
}

seed_cache_from_staging() {
    local cache_dir="$1"
    local platform="$2"
    local arch
    arch=$(normalize_arch "$3")

    if check_existing "$RESOURCES_DIR" "$platform" "$arch"; then
        log_info "Seeding cache from existing staged ${platform}-${arch} runtime..."
        rm -rf "$cache_dir"
        mkdir -p "$cache_dir"
        cp -R "${RESOURCES_DIR}/." "$cache_dir/"
        write_metadata "$cache_dir" "$platform" "$arch"
        return 0
    fi
    return 1
}

install_unix_distribution() {
    local extracted_dir="$1"
    local dest_dir="$2"

    rm -rf "$dest_dir"
    mkdir -p "$dest_dir"
    cp -R "${extracted_dir}/bin" "$dest_dir/"
    cp -R "${extracted_dir}/lib" "$dest_dir/"

    # Resolve symlinks: npm/npx are symlinks, but Tauri resource copy may not
    # preserve them. Replace with actual shell scripts.
    for cmd in npm npx; do
        local link_target
        link_target=$(readlink "${dest_dir}/bin/${cmd}" 2>/dev/null || echo "")
        if [[ -n "$link_target" ]]; then
            local cli_name
            if [[ "$cmd" == "npm" ]]; then cli_name="npm-cli"; else cli_name="npx-cli"; fi
            rm -f "${dest_dir}/bin/${cmd}"
            cat > "${dest_dir}/bin/${cmd}" <<EOF
#!/bin/sh
basedir=\$(cd "\$(dirname "\$0")" && pwd)
exec "\$basedir/node" "\$basedir/../lib/node_modules/npm/bin/${cli_name}.js" "\$@"
EOF
            chmod +x "${dest_dir}/bin/${cmd}"
        fi
    done

    # Remove unnecessary files to reduce size.
    rm -rf "${dest_dir}/bin/corepack"
    rm -rf "${dest_dir}/include"
    rm -rf "${dest_dir}/share"
    rm -rf "${dest_dir}/lib/node_modules/corepack"

    chmod +x "${dest_dir}/bin/node"
}

# Download and extract Node.js for macOS
download_macos() {
    local arch="$1"  # arm64 or x64
    local should_stage="${2:-true}"
    local node_arch

    if [[ "$arch" == "arm64" ]]; then
        node_arch="arm64"
    else
        node_arch="x64"
    fi

    local tarball="node-v${NODE_VERSION}-darwin-${node_arch}.tar.xz"
    local url="${NODE_BASE_URL}/${tarball}"
    local cache_dir
    cache_dir=$(cache_dir_for "darwin" "$node_arch")

    # Check arch-specific cache first. The staging directory is intentionally
    # overwritten per target; it is not the cache.
    if check_existing "$cache_dir" "darwin" "$node_arch"; then
        log_ok "macOS ${node_arch}: Cache hit at v${NODE_VERSION}"
        if [[ "$should_stage" == "true" ]]; then
            stage_nodejs "$cache_dir" "darwin" "$node_arch"
        fi
        return 0
    fi

    # One-time migration path for older checkouts where resources/nodejs already
    # contains the requested arch.
    if seed_cache_from_staging "$cache_dir" "darwin" "$node_arch"; then
        log_ok "macOS ${node_arch}: Cache seeded at v${NODE_VERSION}"
        if [[ "$should_stage" == "true" ]]; then
            stage_nodejs "$cache_dir" "darwin" "$node_arch"
        fi
        return 0
    fi

    log_info "Downloading Node.js v${NODE_VERSION} for macOS ${node_arch}..."

    local tmp_dir
    tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" RETURN

    # Download
    curl -sL "$url" -o "${tmp_dir}/${tarball}"

    # Extract — strip the top-level directory
    log_info "Extracting..."
    tar xf "${tmp_dir}/${tarball}" -C "$tmp_dir"

    # Cache full distribution (replacing only this platform/arch/version cache).
    local extracted_dir="${tmp_dir}/node-v${NODE_VERSION}-darwin-${node_arch}"
    install_unix_distribution "$extracted_dir" "$cache_dir"

    # Upgrade npm — bundled npm 11.9.0 has minizlib bug on Windows.
    # Even for macOS builds, upgrade ensures consistency across platforms. Do
    # it once per cache entry so target switching does not force Node re-fetches.
    upgrade_npm "${cache_dir}/lib/node_modules" "${cache_dir}/bin/node"
    write_metadata "$cache_dir" "darwin" "$node_arch"

    if [[ "$should_stage" == "true" ]]; then
        stage_nodejs "$cache_dir" "darwin" "$node_arch"
    fi

    log_ok "macOS ${node_arch}: Node.js v${NODE_VERSION} ready"
}

# Download and extract Node.js for Linux (glibc; Alpine users install Node.js manually)
download_linux() {
    local arch="$1"  # x64 or arm64
    local should_stage="${2:-true}"
    local node_arch
    if [[ "$arch" == "arm64" || "$arch" == "aarch64" ]]; then
        node_arch="arm64"
    else
        node_arch="x64"
    fi

    local tarball="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
    local url="${NODE_BASE_URL}/${tarball}"
    local cache_dir
    cache_dir=$(cache_dir_for "linux" "$node_arch")

    if check_existing "$cache_dir" "linux" "$node_arch"; then
        log_ok "Linux ${node_arch}: Cache hit at v${NODE_VERSION}"
        if [[ "$should_stage" == "true" ]]; then
            stage_nodejs "$cache_dir" "linux" "$node_arch"
        fi
        return 0
    fi

    if seed_cache_from_staging "$cache_dir" "linux" "$node_arch"; then
        log_ok "Linux ${node_arch}: Cache seeded at v${NODE_VERSION}"
        if [[ "$should_stage" == "true" ]]; then
            stage_nodejs "$cache_dir" "linux" "$node_arch"
        fi
        return 0
    fi

    log_info "Downloading Node.js v${NODE_VERSION} for Linux ${node_arch}..."

    local tmp_dir
    tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" RETURN

    curl -sL "$url" -o "${tmp_dir}/${tarball}"

    log_info "Extracting..."
    tar xf "${tmp_dir}/${tarball}" -C "$tmp_dir"

    local extracted_dir="${tmp_dir}/node-v${NODE_VERSION}-linux-${node_arch}"
    install_unix_distribution "$extracted_dir" "$cache_dir"

    upgrade_npm "${cache_dir}/lib/node_modules" "${cache_dir}/bin/node"
    write_metadata "$cache_dir" "linux" "$node_arch"

    if [[ "$should_stage" == "true" ]]; then
        stage_nodejs "$cache_dir" "linux" "$node_arch"
    fi

    log_ok "Linux ${node_arch}: Node.js v${NODE_VERSION} ready"
}

# Download Node.js for Windows (used in CI/CD cross-build)
download_windows() {
    local arch="$1"  # x64 or arm64
    local should_stage="${2:-true}"
    arch=$(normalize_arch "$arch")
    local zipfile="node-v${NODE_VERSION}-win-${arch}.zip"
    local url="${NODE_BASE_URL}/${zipfile}"
    local cache_dir
    cache_dir=$(cache_dir_for "win" "$arch")

    if check_existing "$cache_dir" "win" "$arch"; then
        log_ok "Windows ${arch}: Cache hit at v${NODE_VERSION}"
        if [[ "$should_stage" == "true" ]]; then
            stage_nodejs "$cache_dir" "win" "$arch"
        fi
        return 0
    fi

    log_info "Downloading Node.js v${NODE_VERSION} for Windows ${arch}..."

    local tmp_dir
    tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" RETURN

    curl -sL "$url" -o "${tmp_dir}/${zipfile}"

    log_info "Extracting..."
    unzip -q "${tmp_dir}/${zipfile}" -d "$tmp_dir"

    local extracted_dir="${tmp_dir}/node-v${NODE_VERSION}-win-${arch}"
    rm -rf "$cache_dir"
    mkdir -p "$cache_dir"

    # Windows: flat structure (node.exe, npm.cmd, npx.cmd, node_modules/)
    cp "${extracted_dir}/node.exe" "$cache_dir/"
    cp "${extracted_dir}/npm.cmd" "$cache_dir/" 2>/dev/null || true
    cp "${extracted_dir}/npx.cmd" "$cache_dir/" 2>/dev/null || true
    cp "${extracted_dir}/npm" "$cache_dir/" 2>/dev/null || true
    cp "${extracted_dir}/npx" "$cache_dir/" 2>/dev/null || true
    cp -R "${extracted_dir}/node_modules" "$cache_dir/" 2>/dev/null || true

    # Remove corepack
    rm -f "${cache_dir}/corepack.cmd" "${cache_dir}/corepack"
    rm -rf "${cache_dir}/node_modules/corepack"

    # Upgrade npm — Windows layout uses node_modules/ (no lib/ prefix).
    # Can't run node.exe on macOS for version check, pass empty string.
    upgrade_npm "${cache_dir}/node_modules" ""
    write_metadata "$cache_dir" "win" "$arch"

    if [[ "$should_stage" == "true" ]]; then
        stage_nodejs "$cache_dir" "win" "$arch"
    fi

    log_ok "Windows ${arch}: Node.js v${NODE_VERSION} ready"
}

# ========================================
# Main
# ========================================

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}Node.js v${NODE_VERSION} Download${NC}               ${CYAN}║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Handle --clean flag
if [[ "$1" == "--clean" ]]; then
    log_warn "Cleaning staged Node.js resources and architecture caches..."
    rm -rf "$RESOURCES_DIR"
    rm -rf "$CACHE_ROOT"
    mkdir -p "$RESOURCES_DIR"
    touch "$RESOURCES_DIR/.gitkeep"
    shift
fi

if [[ "$1" == "--all" ]]; then
    # Populate architecture-specific caches, then leave staging on host arch.
    log_info "Populating macOS architecture caches..."
    download_macos "arm64" "false"
    download_macos "x64" "false"
    if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
        stage_nodejs "$(cache_dir_for "darwin" "arm64")" "darwin" "arm64"
    elif [[ "$(uname -s)" == "Darwin" ]]; then
        stage_nodejs "$(cache_dir_for "darwin" "x64")" "darwin" "x64"
    fi
    # Windows requires a separate build environment
    log_warn "Windows binaries must be downloaded on the Windows build machine"
elif [[ "$1" == "--windows" ]]; then
    download_windows "${2:-x64}"
elif [[ "$1" == "--target" ]]; then
    # Download for a specific macOS architecture (used by build_macos.sh for cross-compilation)
    TARGET_ARCH="${2:-}"
    if [[ "$TARGET_ARCH" == "arm64" || "$TARGET_ARCH" == "aarch64" ]]; then
        download_macos "arm64"
    elif [[ "$TARGET_ARCH" == "x64" || "$TARGET_ARCH" == "x86_64" ]]; then
        download_macos "x64"
    else
        log_error "Invalid target architecture: '${TARGET_ARCH}' (expected: arm64, x64, aarch64, x86_64)"
        exit 1
    fi
else
    # Download for current platform only
    ARCH=$(uname -m)
    PLATFORM=$(uname -s)

    if [[ "$PLATFORM" == "Darwin" ]]; then
        if [[ "$ARCH" == "arm64" ]]; then
            download_macos "arm64"
        else
            download_macos "x64"
        fi
    elif [[ "$PLATFORM" == "Linux" ]]; then
        if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
            download_linux "arm64"
        else
            download_linux "x64"
        fi
    else
        log_error "Unsupported platform: $PLATFORM"
        exit 1
    fi
fi

echo ""
log_ok "Done! Node.js resources at: ${RESOURCES_DIR}"
log_info "Architecture cache root: ${CACHE_ROOT}"
echo ""

# Show contents
if [[ -f "${RESOURCES_DIR}/bin/node" ]]; then
    local_ver=$("${RESOURCES_DIR}/bin/node" --version 2>/dev/null || echo "unknown")
    log_info "Bundled node version: ${local_ver}"
    log_info "Contents:"
    du -sh "${RESOURCES_DIR}" 2>/dev/null | awk '{print "  Total: " $1}'
    du -sh "${RESOURCES_DIR}/bin/node" 2>/dev/null | awk '{print "  node binary: " $1}'
    du -sh "${RESOURCES_DIR}/lib/node_modules/npm" 2>/dev/null | awk '{print "  npm: " $1}'
elif [[ -f "${RESOURCES_DIR}/node.exe" ]]; then
    log_info "Windows Node.js extracted"
fi
