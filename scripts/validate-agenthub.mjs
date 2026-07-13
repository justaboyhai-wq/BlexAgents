#!/usr/bin/env node

import { lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { extname, join, relative, resolve, sep } from "node:path";

const ROOT = process.cwd();
const HUB_ROOT = join(ROOT, "agenthub");
const TEMPLATE_ROOT = join(HUB_ROOT, "templates");
const EXPECTED_IDS = [
  "life-manager",
  "daily-weekly-review",
  "goals-habits-coach",
  "calendar-focus",
  "meal-shopping",
  "wellness-tracker",
  "travel-planner",
  "personal-writing",
  "content-strategist",
  "social-short-content",
  "brand-copywriting",
  "visual-ux-design",
];
const REVIEWED_PAYLOADS = new Map([
  [
    "life-manager",
    {
      version: "1.0.0",
      sha256:
        "b15c27f619ddd6c740c5e1714f6b875bc00fa21021bfa45bb74fb7af3969a9f8",
    },
  ],
  [
    "daily-weekly-review",
    {
      version: "1.0.0",
      sha256:
        "9a75e5513e3af3b33f7f2c0b63ba75eb59b2bfc80846207906ce14533b4ba86b",
    },
  ],
  [
    "goals-habits-coach",
    {
      version: "1.0.0",
      sha256:
        "ecea6e83f2ced3441a09ce6542945fadf270a6eccd86924a34e9973327f668b0",
    },
  ],
  [
    "calendar-focus",
    {
      version: "1.0.0",
      sha256:
        "51d526e0872b2915c84379d28d9aa54a9ebd02cfedc06580322d0132dfe17f25",
    },
  ],
  [
    "meal-shopping",
    {
      version: "1.0.0",
      sha256:
        "faf4745a474dae35013e94e6d4c780fd3ee064c53b1902da7d9fcb1fb1a9088c",
    },
  ],
  [
    "wellness-tracker",
    {
      version: "1.0.0",
      sha256:
        "fe30a84af07465384fc905304a9293cdfaa058bbe796810237b7ae314a8fb7a6",
    },
  ],
  [
    "travel-planner",
    {
      version: "1.0.0",
      sha256:
        "ddcce4d52a1b98df32b687d4e5ded1d88cb4e026fd7ced6fa0bc9785dbb7d0d6",
    },
  ],
  [
    "personal-writing",
    {
      version: "1.0.0",
      sha256:
        "cad6c32f8b1eb69f5d6420d4947201b41bc9f51984c6065bccd743c3c03f4bad",
    },
  ],
  [
    "content-strategist",
    {
      version: "1.0.0",
      sha256:
        "618d524954af3f8faabf8721a4c0b3e244a6f1ba6d3fd174143511100db23bb0",
    },
  ],
  [
    "social-short-content",
    {
      version: "1.0.0",
      sha256:
        "48b76899e1e3e2768b89f633f5e4db6730401c8bfd2734276b356e5d7c9fde76",
    },
  ],
  [
    "brand-copywriting",
    {
      version: "1.0.0",
      sha256:
        "479502d605421a1d134037e42c95518d825d59620b83e3e18765bc45821f80d2",
    },
  ],
  [
    "visual-ux-design",
    {
      version: "1.0.0",
      sha256:
        "f7c37b7e2f16cccd4efa3e945d6317ea0b2757e0e75e49795c9ffa4fda66e33b",
    },
  ],
]);
const REQUIRED_WORKSPACE_FILES = [
  "CLAUDE.md",
  "INTRODUCTION.md",
  ".claude/rules/SOUL.md",
  ".claude/rules/USER.md",
];
const ALLOWED_EXTENSIONS = new Set([".md", ".json", ".yaml", ".yml", ".txt"]);
const FORBIDDEN_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "scripts",
  "bin",
  "dist",
  "target",
]);
const FORBIDDEN_NAME =
  /(^|[._-])(env|secret|secrets|credential|credentials|private[-_]?key|id_rsa)([._-]|$)/i;
const MAX_FILES = 500;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const PROVENANCE_LOCK_SHA256 =
  "66a33cf986cbafb5b9645c85011ac35364b14f2b476dd6a8d203598aebab29f2";

function fail(message) {
  throw new Error(`[AgentHub validation] ${message}`);
}

function parseJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${relative(ROOT, path)} is invalid JSON: ${error.message}`);
  }
}

function assertLocalized(value, field) {
  if (
    !value ||
    typeof value["zh-CN"] !== "string" ||
    value["zh-CN"].trim() === "" ||
    typeof value["en-US"] !== "string" ||
    value["en-US"].trim() === ""
  ) {
    fail(`${field} must contain non-empty zh-CN and en-US strings`);
  }
}

function walkWorkspace(root) {
  const files = [];
  let totalBytes = 0;

  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const rel = relative(root, path).split(sep).join("/");
      if (entry.name.includes("\\")) {
        fail(`${rel} uses a non-portable backslash in its file name`);
      }
      const info = lstatSync(path);
      if (info.isSymbolicLink()) fail(`${rel} must not be a symbolic link`);
      if (entry.isDirectory()) {
        if (FORBIDDEN_DIRECTORIES.has(entry.name.toLowerCase())) {
          fail(`${rel} uses forbidden directory ${entry.name}`);
        }
        visit(path);
        continue;
      }
      if (!entry.isFile()) fail(`${rel} is not a regular file`);
      if (FORBIDDEN_NAME.test(entry.name))
        fail(`${rel} looks like a secret-bearing file`);
      if (!ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        fail(`${rel} has a forbidden extension`);
      }
      if (info.size > MAX_FILE_BYTES)
        fail(`${rel} exceeds the per-file size limit`);
      totalBytes += info.size;
      if (totalBytes > MAX_TOTAL_BYTES)
        fail("template exceeds the total size limit");
      files.push(rel);
      if (files.length > MAX_FILES)
        fail("template exceeds the file-count limit");
    }
  }

  visit(root);
  return files.sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)),
  );
}

function workspacePayloadDigest(root, inventory) {
  const digest = createHash("sha256");
  for (const rel of inventory) {
    const fileDigest = createHash("sha256")
      .update(readFileSync(join(root, ...rel.split("/"))))
      .digest("hex");
    digest.update(rel, "utf8");
    digest.update("\0");
    digest.update(fileDigest, "ascii");
    digest.update("\n");
  }
  return digest.digest("hex");
}

const provenanceLockPath = join(HUB_ROOT, "provenance-lock.json");
const provenanceLockBytes = readFileSync(provenanceLockPath);
const provenanceLockDigest = createHash("sha256")
  .update(provenanceLockBytes)
  .digest("hex");
if (provenanceLockDigest !== PROVENANCE_LOCK_SHA256) {
  fail(
    "provenance-lock.json changed without updating its reviewed build digest",
  );
}
const provenanceLock = parseJson(provenanceLockPath);
if (
  provenanceLock.schemaVersion !== 1 ||
  provenanceLock.hashAlgorithm !== "sha256" ||
  provenanceLock.hashScope !== "raw-git-blob-bytes" ||
  provenanceLock.lineEndingNormalization !== "none" ||
  !Array.isArray(provenanceLock.sources) ||
  provenanceLock.sources.length !== 22
) {
  fail("provenance lock must describe the 22 reviewed raw Git blobs");
}
const provenanceByKey = new Map();
for (const source of provenanceLock.sources) {
  const expectedKey = `${source.repository}@${source.commit}:${source.path}`;
  if (
    source.key !== expectedKey ||
    !/^[0-9a-f]{40}$/.test(source.commit ?? "") ||
    !/^[0-9a-f]{64}$/.test(source.sha256 ?? "") ||
    typeof source.repositoryUrl !== "string" ||
    provenanceByKey.has(source.key)
  ) {
    fail(`invalid or duplicate provenance source ${source.key ?? "<missing>"}`);
  }
  provenanceByKey.set(source.key, source);
}
const usedProvenanceKeys = new Set();

const catalogue = parseJson(join(HUB_ROOT, "catalogue.json"));
if (catalogue.schemaVersion !== 1) fail("catalogue schemaVersion must be 1");
if (JSON.stringify(catalogue.templateIds) !== JSON.stringify(EXPECTED_IDS)) {
  fail(`catalogue must contain the reviewed 12 IDs in their approved order`);
}

const diskIds = readdirSync(TEMPLATE_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(diskIds) !== JSON.stringify([...EXPECTED_IDS].sort())) {
  fail("templates directory must match catalogue exactly");
}

for (const id of EXPECTED_IDS) {
  const packageRoot = join(TEMPLATE_ROOT, id);
  const workspaceRoot = join(packageRoot, "workspace");
  const manifest = parseJson(join(packageRoot, "manifest.json"));
  if (manifest.id !== id) fail(`${id}: manifest ID mismatch`);
  if (manifest.provenanceLock !== "../../provenance-lock.json") {
    fail(`${id}: manifest must bind to the reviewed provenance lock`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? ""))
    fail(`${id}: invalid version`);
  if (!["life", "creation"].includes(manifest.category))
    fail(`${id}: invalid category`);
  assertLocalized(manifest.name, `${id}.name`);
  assertLocalized(manifest.description, `${id}.description`);
  if (
    !Array.isArray(manifest.capabilities) ||
    manifest.capabilities.length < 2
  ) {
    fail(`${id}: at least two capabilities are required`);
  }
  manifest.capabilities.forEach((item, index) =>
    assertLocalized(item, `${id}.capabilities[${index}]`),
  );
  if (!Array.isArray(manifest.examples) || manifest.examples.length < 2) {
    fail(`${id}: at least two examples are required`);
  }
  manifest.examples.forEach((item, index) =>
    assertLocalized(item, `${id}.examples[${index}]`),
  );
  if (!manifest.risk || !["low", "medium"].includes(manifest.risk.level)) {
    fail(`${id}: missing reviewed risk level`);
  }
  assertLocalized(manifest.risk.boundary, `${id}.risk.boundary`);

  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    fail(`${id}: at least one reviewed source is required`);
  }
  const attributionText = readFileSync(
    join(packageRoot, "ATTRIBUTIONS.md"),
    "utf8",
  );
  for (const [index, source] of manifest.sources.entries()) {
    const label = `${id}.sources[${index}]`;
    if (source.licenseSpdx !== "MIT")
      fail(`${label}: only MIT sources are approved`);
    if (source.licenseReviewStatus !== "approved")
      fail(`${label}: license review is not approved`);
    if (source.securityReviewStatus !== "approved")
      fail(`${label}: security review is not approved`);
    if (!/^[0-9a-f]{40}$/.test(source.commit ?? ""))
      fail(`${label}: commit must be fixed SHA-1`);
    if (!/^[0-9a-f]{64}$/.test(source.sourceSha256 ?? ""))
      fail(`${label}: invalid source SHA-256`);
    if (!Array.isArray(source.paths) || source.paths.length !== 1) {
      fail(`${label}: each attribution must bind exactly one upstream blob`);
    }
    if (!source.modifications || !source.securityReviewNotes)
      fail(`${label}: review notes are required`);
    const provenanceKey = `${source.repository}@${source.commit}:${source.paths[0]}`;
    const locked = provenanceByKey.get(provenanceKey);
    if (
      !locked ||
      locked.repositoryUrl !== source.repositoryUrl ||
      locked.sha256 !== source.sourceSha256
    ) {
      fail(`${label}: source does not match provenance-lock.json`);
    }
    if (!attributionText.includes(source.sourceSha256)) {
      fail(`${label}: ATTRIBUTIONS.md does not contain the locked source hash`);
    }
    usedProvenanceKeys.add(provenanceKey);
    const licensePath = resolve(HUB_ROOT, source.licenseFile ?? "");
    if (!licensePath.startsWith(`${resolve(HUB_ROOT)}${sep}`))
      fail(`${label}: license path escapes AgentHub`);
    if (!statSync(licensePath, { throwIfNoEntry: false })?.isFile())
      fail(`${label}: license file is missing`);
  }

  for (const required of REQUIRED_WORKSPACE_FILES) {
    if (
      !statSync(join(workspaceRoot, required), {
        throwIfNoEntry: false,
      })?.isFile()
    ) {
      fail(`${id}: missing workspace/${required}`);
    }
  }
  const inventory = walkWorkspace(workspaceRoot);
  const reviewedPayload = REVIEWED_PAYLOADS.get(id);
  if (
    !reviewedPayload ||
    reviewedPayload.version !== manifest.version ||
    workspacePayloadDigest(workspaceRoot, inventory) !== reviewedPayload.sha256
  ) {
    fail(
      `${id}: final workspace payload does not match the reviewed version and digest`,
    );
  }
  const skillRoot = join(workspaceRoot, ".claude", "skills");
  const diskSkills = readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const manifestSkills = (manifest.skills ?? [])
    .map((skill) => skill.id)
    .sort();
  if (
    JSON.stringify(diskSkills) !== JSON.stringify(manifestSkills) ||
    diskSkills.length === 0
  ) {
    fail(
      `${id}: manifest skills must exactly match workspace skill directories`,
    );
  }
  for (const skill of manifest.skills) {
    assertLocalized(skill.name, `${id}.skills.${skill.id}.name`);
    const skillFile = `.claude/skills/${skill.id}/SKILL.md`;
    if (!inventory.includes(skillFile)) fail(`${id}: missing ${skillFile}`);
    const skillText = readFileSync(join(workspaceRoot, skillFile), "utf8");
    if (
      !/^---\r?\n[\s\S]*?^name:\s*[^\r\n]+[\s\S]*?^description:\s*[^\r\n]+[\s\S]*?^---\r?\n/m.test(
        skillText,
      )
    ) {
      fail(`${id}: ${skillFile} needs name and description frontmatter`);
    }
  }
  if (
    !inventory.some(
      (file) => file.startsWith("examples/") && file.endsWith(".md"),
    )
  ) {
    fail(`${id}: at least one offline example is required`);
  }
  if (
    !statSync(join(packageRoot, "ATTRIBUTIONS.md"), {
      throwIfNoEntry: false,
    })?.isFile()
  ) {
    fail(`${id}: ATTRIBUTIONS.md is required`);
  }
}

if (
  usedProvenanceKeys.size !== provenanceByKey.size ||
  [...provenanceByKey.keys()].some((key) => !usedProvenanceKeys.has(key))
) {
  fail("provenance lock contains an unused or unreviewed source");
}

console.log(
  `AgentHub validation passed: ${EXPECTED_IDS.length} reviewed offline templates.`,
);
