import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--dependencies", "--dry-run", "--resources"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));

if (unknownArgs.length > 0) {
  console.error(`Unknown option(s): ${unknownArgs.join(", ")}`);
  console.error(
    "Usage: node scripts/clean-generated.mjs [--dry-run] [--dependencies] [--resources]",
  );
  process.exit(2);
}

const dryRun = args.has("--dry-run");
const cleanDependencies = args.has("--dependencies");
const cleanResources = args.has("--resources");

// Keep this list explicit. Cleanup is intentionally narrower than .gitignore:
// user settings, local workspaces, IDE state, and credentials are never targets.
const generatedPaths = [
  "build",
  "dist",
  "artifacts",
  "release-artifacts",
  "coverage",
  "logs",
  ".cache",
  ".turbo",
  ".vite",
  ".eslintcache",
  ".prettiercache",
  ".local-deps",
  ".tmp",
  "tmp",
  "temp",
  "src-tauri/target",
];

// Bundled runtimes and packaging inputs are expensive to provision and are
// deliberately opt-in. After removing these paths, rerun the platform setup or
// build entry point before developing or packaging the desktop application.
const bundledResourcePaths = [
  "src-tauri/binaries",
  "src-tauri/gen",
  "src-tauri/resources/server-dist.js",
  "src-tauri/resources/server-dist.js.map",
  "src-tauri/resources/plugin-bridge-dist.mjs",
  "src-tauri/resources/plugin-bridge-dist.mjs.map",
  "src-tauri/resources/claude-agent-sdk",
  "src-tauri/resources/cli/blexagent.js",
  "src-tauri/resources/cli/blexagent.cmd",
  "src-tauri/resources/agent-browser-cli",
  "src-tauri/resources/sharp-runtime",
  "src-tauri/resources/tsx-runtime",
  "src-tauri/resources/nodejs-cache",
  "src-tauri/resources/vcruntime140.dll",
  "src-tauri/resources/vcruntime140_1.dll",
  "src-tauri/nsis/Git-Installer.exe",
];

if (cleanDependencies) generatedPaths.push("node_modules");
if (cleanResources) generatedPaths.push(...bundledResourcePaths);

const permanentProtectedPaths = [
  ".git",
  "mino",
  "src-tauri/resources/cli/.gitkeep",
  "src-tauri/resources/nodejs/.gitkeep",
];
if (!cleanDependencies) permanentProtectedPaths.push("node_modules");

function normalizeRelativePath(value) {
  return value.split(sep).join("/");
}

function isSameOrInside(candidate, parent) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith(`..${sep}`) &&
      pathFromParent !== ".." &&
      !isAbsolute(pathFromParent))
  );
}

function resolveInsideRepo(relativePath) {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new Error(
      `Cleanup target must be a non-empty relative path: ${relativePath}`,
    );
  }

  const absolutePath = resolve(repoRoot, relativePath);
  if (absolutePath === repoRoot || !isSameOrInside(absolutePath, repoRoot)) {
    throw new Error(`Cleanup target escapes the repository: ${relativePath}`);
  }
  return absolutePath;
}

const protectedAbsolutePaths = permanentProtectedPaths.map(resolveInsideRepo);

function assertNotProtected(relativePath) {
  const absolutePath = resolveInsideRepo(relativePath);
  for (const protectedPath of protectedAbsolutePaths) {
    if (
      isSameOrInside(absolutePath, protectedPath) ||
      isSameOrInside(protectedPath, absolutePath)
    ) {
      throw new Error(
        `Cleanup target overlaps protected path: ${relativePath}`,
      );
    }
  }
  return absolutePath;
}

function readTrackedFiles() {
  const result = spawnSync("git", ["-C", repoRoot, "ls-files", "-z"], {
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0 || !result.stdout) {
    const detail =
      result.error?.message ?? result.stderr?.toString("utf8").trim();
    throw new Error(
      `Refusing to clean because tracked files could not be inspected${detail ? `: ${detail}` : ""}`,
    );
  }

  return new Set(
    result.stdout
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((file) => file.replaceAll("\\", "/")),
  );
}

const trackedFiles = readTrackedFiles();

function containsTrackedFile(relativePath) {
  const normalized = normalizeRelativePath(relativePath).replace(/\/$/, "");
  return [...trackedFiles].some(
    (tracked) => tracked === normalized || tracked.startsWith(`${normalized}/`),
  );
}

async function collectRootPatterns(targets) {
  for (const entry of await readdir(repoRoot, { withFileTypes: true })) {
    const name = entry.name;
    const isRootPacketCapture = entry.isFile() && /\.pcap(?:ng)?$/i.test(name);
    if (
      name.startsWith(".tmp-claude-sdk-") ||
      /^rustup-init.*\.exe$/i.test(name) ||
      /^npm-debug\.log/i.test(name) ||
      isRootPacketCapture ||
      name === "rclone.exe"
    ) {
      targets.add(name);
    }
  }
}

async function collectNodeRuntimeContents(targets) {
  const runtimeDirectory = resolveInsideRepo("src-tauri/resources/nodejs");
  if (!existsSync(runtimeDirectory)) return;

  for (const entry of await readdir(runtimeDirectory, {
    withFileTypes: true,
  })) {
    if (entry.name !== ".gitkeep")
      targets.add(`src-tauri/resources/nodejs/${entry.name}`);
  }
}

const generatedSuffixes = [".log", ".tsbuildinfo"];
const traversalExclusions = new Set([
  ".git",
  ".agent",
  ".agents",
  ".claude",
  ".context",
  ".idea",
  ".playwright-mcp",
  ".vscode",
  "mino",
  "node_modules",
  "src-tauri/binaries",
  "src-tauri/gen",
  "src-tauri/nsis",
  "src-tauri/resources",
  "tools",
  ...generatedPaths.filter(
    (target) =>
      !target.includes(".") || target.split("/").at(-1)?.startsWith("."),
  ),
]);

async function collectGeneratedFiles(targets, currentRelative = "") {
  const currentAbsolute = currentRelative
    ? resolveInsideRepo(currentRelative)
    : repoRoot;
  let entries;
  try {
    entries = await readdir(currentAbsolute, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const entryRelative = currentRelative
      ? `${currentRelative}/${entry.name}`
      : entry.name;
    const normalized = normalizeRelativePath(entryRelative);

    if (entry.isDirectory()) {
      if (traversalExclusions.has(normalized)) continue;
      await collectGeneratedFiles(targets, normalized);
      continue;
    }

    const lowerName = entry.name.toLowerCase();
    if (generatedSuffixes.some((suffix) => lowerName.endsWith(suffix)))
      targets.add(normalized);
  }
}

const targets = new Set(generatedPaths);
await collectRootPatterns(targets);
if (cleanResources) await collectNodeRuntimeContents(targets);
await collectGeneratedFiles(targets);

const orderedTargets = [...targets]
  .map((target) => normalizeRelativePath(target))
  .filter((target) => existsSync(resolveInsideRepo(target)))
  .sort(
    (left, right) =>
      left.split("/").length - right.split("/").length ||
      left.localeCompare(right),
  );

const selectedTargets = [];
for (const target of orderedTargets) {
  if (selectedTargets.some((parent) => target.startsWith(`${parent}/`)))
    continue;
  assertNotProtected(target);
  if (containsTrackedFile(target)) {
    console.warn(`[protected] tracked path skipped: ${target}`);
    continue;
  }
  selectedTargets.push(target);
}

for (const target of selectedTargets) {
  if (dryRun) {
    console.log(`[dry-run] remove ${target}`);
    continue;
  }
  await rm(resolveInsideRepo(target), {
    force: true,
    maxRetries: 3,
    recursive: true,
  });
  console.log(`[removed] ${target}`);
}

const selectedModes = ["generated files"];
if (cleanDependencies) selectedModes.push("dependencies");
if (cleanResources) selectedModes.push("bundled resources");
const mode = selectedModes.join(", ");
console.log(
  `${dryRun ? "Dry run complete" : "Cleanup complete"}: ${selectedTargets.length} ${mode} target(s).`,
);
