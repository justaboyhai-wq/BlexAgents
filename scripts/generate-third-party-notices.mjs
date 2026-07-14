#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(
  readFileSync(resolve(repoRoot, "package-lock.json"), "utf8"),
);
const productVersion = lock.packages?.[""]?.version ?? "unknown";

function markdown(value) {
  return String(value ?? "UNKNOWN")
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function npmInventory() {
  const packages = new Map();
  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
    if (!packagePath.startsWith("node_modules/")) continue;
    const name = packagePath.slice(
      packagePath.lastIndexOf("node_modules/") + "node_modules/".length,
    );
    const key = `${name}@${metadata.version ?? "UNKNOWN"}`;
    let license = metadata.license;
    const installedDirectory = resolve(repoRoot, packagePath);
    const installedManifest = resolve(installedDirectory, "package.json");
    if (!license && existsSync(installedManifest)) {
      const installed = JSON.parse(readFileSync(installedManifest, "utf8"));
      license =
        installed.license ??
        (Array.isArray(installed.licenses)
          ? installed.licenses
              .map((entry) => entry?.type)
              .filter(Boolean)
              .join(" OR ")
          : undefined);
      if (!license) {
        const licenseFile = readdirSync(installedDirectory).find((file) =>
          /^(licen[cs]e|copying)(\.|_|-|$)/i.test(file),
        );
        if (licenseFile) {
          const text = readFileSync(
            resolve(installedDirectory, licenseFile),
            "utf8",
          ).slice(0, 2000);
          if (
            /The MIT License|Permission is hereby granted, free of charge/i.test(
              text,
            )
          ) {
            license = "MIT";
          } else if (/Apache License[\s\S]{0,80}Version 2\.0/i.test(text)) {
            license = "Apache-2.0";
          } else if (/ISC License/i.test(text)) {
            license = "ISC";
          }
        }
      }
    }
    packages.set(key, {
      name,
      version: metadata.version ?? "UNKNOWN",
      license: license ?? "UNKNOWN — manual review required",
    });
  }
  return [...packages.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en") ||
      a.version.localeCompare(b.version, "en"),
  );
}

async function cargoInventory() {
  const lockText = readFileSync(
    resolve(repoRoot, "src-tauri", "Cargo.lock"),
    "utf8",
  );
  const lockedPackages = lockText
    .split("[[package]]")
    .slice(1)
    .map((block) => ({
      name: block.match(/^name = "([^"]+)"/m)?.[1],
      version: block.match(/^version = "([^"]+)"/m)?.[1],
      source: block.match(/^source = "([^"]+)"/m)?.[1],
    }))
    .filter((pkg) => pkg.name && pkg.version && pkg.source);

  const cargoHome = process.env.CARGO_HOME || resolve(homedir(), ".cargo");
  const registrySource = resolve(cargoHome, "registry", "src");
  const registryRoots = existsSync(registrySource)
    ? readdirSync(registrySource, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(registrySource, entry.name))
    : [];
  const registryIndex = resolve(cargoHome, "registry", "index");
  const indexRoots = existsSync(registryIndex)
    ? readdirSync(registryIndex, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(registryIndex, entry.name, ".cache"))
        .filter(existsSync)
    : [];

  function registryIndexLicense(name, version) {
    const lower = name.toLowerCase();
    const relative =
      lower.length === 1
        ? resolve("1", lower)
        : lower.length === 2
          ? resolve("2", lower)
          : lower.length === 3
            ? resolve("3", lower[0], lower)
            : resolve(lower.slice(0, 2), lower.slice(2, 4), lower);
    for (const root of indexRoots) {
      const indexFile = resolve(root, relative);
      if (!existsSync(indexFile)) continue;
      for (const segment of readFileSync(indexFile)
        .toString("utf8")
        .split("\0")) {
        if (!segment.startsWith("{")) continue;
        try {
          const record = JSON.parse(segment);
          if (record.vers === version && record.license) return record.license;
        } catch {
          // Sparse-index cache includes a short binary header; non-JSON segments are expected.
        }
      }
    }
    return undefined;
  }

  const gitManifests = new Map();
  const gitCheckouts = resolve(cargoHome, "git", "checkouts");
  function indexGitManifests(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        indexGitManifests(path);
      } else if (entry.name === "Cargo.toml") {
        const packageSection =
          readFileSync(path, "utf8").match(
            /\[package\]([\s\S]*?)(?=\n\[|$)/,
          )?.[1] ?? "";
        const name = packageSection.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
        const version = packageSection.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
        let license = packageSection.match(/^license\s*=\s*"([^"]+)"/m)?.[1];
        if (name && version) {
          if (!license) {
            const directory = dirname(path);
            const files = readdirSync(directory).map((file) =>
              file.toLowerCase(),
            );
            const hasMit = files.some(
              (file) =>
                file.startsWith("license_mit") ||
                file.startsWith("license-mit"),
            );
            const hasApache = files.some(
              (file) =>
                file.startsWith("license_apache") ||
                file.startsWith("license-apache"),
            );
            if (hasMit && hasApache) license = "MIT OR Apache-2.0";
            else if (hasMit) license = "MIT";
            else if (hasApache) license = "Apache-2.0";
          }
          if (license) gitManifests.set(`${name}@${version}`, license);
        }
      }
    }
  }
  indexGitManifests(gitCheckouts);

  const inventory = lockedPackages.map((pkg) => {
    let license;
    if (pkg.source.startsWith("registry+")) {
      for (const root of registryRoots) {
        const manifest = resolve(
          root,
          `${pkg.name}-${pkg.version}`,
          "Cargo.toml",
        );
        if (!existsSync(manifest)) continue;
        const packageSection =
          readFileSync(manifest, "utf8").match(
            /\[package\]([\s\S]*?)(?=\n\[|$)/,
          )?.[1] ?? "";
        license = packageSection.match(/^license\s*=\s*"([^"]+)"/m)?.[1];
        if (license) break;
      }
      license ??= registryIndexLicense(pkg.name, pkg.version);
    } else if (pkg.source.startsWith("git+")) {
      license = gitManifests.get(`${pkg.name}@${pkg.version}`);
    }
    return {
      name: pkg.name,
      version: pkg.version,
      source: pkg.source,
      license: license ?? "UNKNOWN — manual review required",
    };
  });

  const unresolvedRegistry = inventory.filter(
    (pkg) =>
      pkg.source.startsWith("registry+") && pkg.license.startsWith("UNKNOWN"),
  );
  const wait = (milliseconds) =>
    new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

  async function fetchCratesIoLicense(pkg) {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": `BlexAgent-license-audit/${productVersion} (team@blexagent.com)`,
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (response.ok) {
          const metadata = await response.json();
          return metadata?.version?.license ?? metadata?.crate?.license;
        }
        if (response.status !== 429 && response.status < 500) return undefined;
      } catch {
        // Retry bounded transient network failures; the final UNKNOWN remains fail-visible.
      }
      await wait(500 * 2 ** attempt);
    }
    return undefined;
  }

  let nextIndex = 0;
  async function resolveFromCratesIo() {
    while (nextIndex < unresolvedRegistry.length) {
      const pkg = unresolvedRegistry[nextIndex++];
      const license = await fetchCratesIoLicense(pkg);
      if (license) pkg.license = license;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, unresolvedRegistry.length) }, () =>
      resolveFromCratesIo(),
    ),
  );

  return inventory
    .map(({ source: _source, ...pkg }) => pkg)
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "en") ||
        a.version.localeCompare(b.version, "en"),
    );
}

function table(packages) {
  return [
    "| Package | Version | Declared license |",
    "| --- | --- | --- |",
    ...packages.map(
      ({ name, version, license }) =>
        `| ${markdown(name)} | ${markdown(version)} | ${markdown(license)} |`,
    ),
  ].join("\n");
}

const npmPackages = npmInventory();
const rustPackages = await cargoInventory();
const unknown = [...npmPackages, ...rustPackages].filter((pkg) =>
  pkg.license.startsWith("UNKNOWN"),
);

const document = `# BlexAgent Third-Party Notices

Generated from \`package-lock.json\` and \`src-tauri/Cargo.lock\`. Run
\`npm run legal:third-party\` after changing dependencies. This inventory is a
compliance aid, not a replacement for the complete license files supplied by
each upstream component.

BlexAgent-owned material is available under Apache License 2.0. The third-party
components below remain under their respective licenses. Copyright
notices and license texts shipped inside dependency packages, bundled skills,
runtime distributions, templates, and default-workspace resources must be
preserved.

## Bundled resources with separate notices

- **OpenMino default workspace** — MIT; attribution is preserved in
  \`branding/default-workspace/OPENMINO_NOTICE.md\` and copied into the bundled
  workspace.
- **AgentHub reviewed templates** — upstream attribution and pinned source
  information live in each \`agenthub/templates/*/ATTRIBUTIONS.md\`; corresponding
  MIT texts live under \`agenthub/licenses/\`.
- **Bundled document, spreadsheet, presentation, PDF, pet, and skill-creator
  skills** — their license files live beside the relevant skill under
  \`bundled-skills/*/LICENSE.txt\`.
- **Bundled Node.js runtime** — Node.js and its included dependencies retain the
  notices shipped in \`src-tauri/resources/nodejs/LICENSE\` and the runtime's own
  distribution.
- **Claude Agent SDK** — Anthropic's SDK and platform-specific packages use the
  license files shipped in their npm packages. Provider service use is also
  subject to Anthropic's applicable service terms.
- **SheetJS xlsx** — distributed from SheetJS CDN at the version pinned in
  \`package-lock.json\`; its package license and notices must remain intact.

## Review status

- npm package records: ${npmPackages.length}
- Rust crate records: ${rustPackages.length}
- Records without a machine-readable license declaration: ${unknown.length}

${unknown.length ? `Manual review queue: ${unknown.map((pkg) => `\`${pkg.name}@${pkg.version}\``).join(", ")}.` : "No missing machine-readable license declarations were found."}

Packages declaring LGPL, GPL, MPL, CC, custom, or \`SEE LICENSE IN ...\` terms
require release-by-release review to confirm that the shipped form and notice
delivery satisfy those terms. An official release must not proceed on
the generated table alone.

## npm production and build dependency inventory

${table(npmPackages)}

## Rust dependency inventory

${table(rustPackages)}
`;

const formattedDocument = await format(document, {
  parser: "markdown",
  printWidth: 120,
});
writeFileSync(
  resolve(repoRoot, "THIRD_PARTY_NOTICES.md"),
  formattedDocument,
  "utf8",
);
console.log(
  `Wrote THIRD_PARTY_NOTICES.md (${npmPackages.length} npm records, ${rustPackages.length} Rust records, ${unknown.length} unknown).`,
);
