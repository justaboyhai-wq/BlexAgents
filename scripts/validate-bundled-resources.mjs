#!/usr/bin/env node

import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MINO_ROOT = join(ROOT, "mino");
const REQUIRED_FILES = [
  "CLAUDE.md",
  "INTRODUCTION.md",
  "README.md",
  "OPENMINO_NOTICE.md",
  "pet.json",
  ".claude/rules/01-IDENTITY.md",
  ".claude/rules/02-SOUL.md",
  ".claude/rules/03-USER.md",
  ".claude/rules/04-MEMORY.md",
];

function fail(message) {
  throw new Error(`[Bundled resource validation] ${message}`);
}

function displayPath(path) {
  return relative(ROOT, path).split(sep).join("/");
}

function requireRegularFile(relativePath) {
  const path = join(MINO_ROOT, relativePath);
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail(
      `Blex default workspace file mino/${relativePath} is missing; run setup_windows.ps1 (Windows) or setup.sh`,
    );
  }
  if (info.isSymbolicLink() || !info.isFile() || info.size === 0) {
    fail(`Blex default workspace file mino/${relativePath} must be a non-empty regular file`);
  }
}

function inspectTree(root) {
  let skillCount = 0;
  let fileCount = 0;

  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const info = lstatSync(path);
      if (info.isSymbolicLink()) {
        fail(`${displayPath(path)} must not be a symbolic link or junction`);
      }
      if (entry.isDirectory()) {
        if (entry.name === ".git") {
          fail(`${displayPath(path)} must not be bundled`);
        }
        visit(path);
        continue;
      }
      if (!entry.isFile()) fail(`${displayPath(path)} is not a regular file`);
      fileCount += 1;
      if (entry.name === "SKILL.md") skillCount += 1;
    }
  }

  visit(root);
  return { fileCount, skillCount };
}

let rootInfo;
try {
  rootInfo = lstatSync(MINO_ROOT);
} catch {
  fail("Blex default workspace resource mino/ is missing; run setup_windows.ps1 (Windows) or setup.sh");
}
if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
  fail("Blex default workspace resource mino/ must be a real directory");
}

for (const path of REQUIRED_FILES) requireRegularFile(path);
const { fileCount, skillCount } = inspectTree(MINO_ROOT);
if (skillCount === 0) {
  fail("Blex default workspace resource mino/.claude/skills must contain at least one SKILL.md");
}

const claude = readFileSync(join(MINO_ROOT, "CLAUDE.md"), "utf8").trim();
if (!claude.startsWith("#")) {
  fail("Blex default workspace resource mino/CLAUDE.md must be a Markdown document");
}

const standaloneLegacyBrand = /(?<![A-Za-z])Mino(?![A-Za-z])/;
for (const relativePath of ["INTRODUCTION.md", "README.md", "OPENMINO_NOTICE.md"]) {
  const contents = readFileSync(join(MINO_ROOT, relativePath), "utf8");
  if (standaloneLegacyBrand.test(contents)) {
    fail(`Blex default workspace file mino/${relativePath} exposes the legacy Mino product name`);
  }
}

const introduction = readFileSync(join(MINO_ROOT, "INTRODUCTION.md"), "utf8").trim();
if (!introduction.startsWith("# Blex")) {
  fail("Blex default workspace resource mino/INTRODUCTION.md must start with the Blex name");
}

const readme = readFileSync(join(MINO_ROOT, "README.md"), "utf8");
if (!readme.startsWith("# Blex") || !readme.includes("OpenMino")) {
  fail("Blex default workspace resource mino/README.md must expose Blex and preserve OpenMino attribution");
}

const notice = readFileSync(join(MINO_ROOT, "OPENMINO_NOTICE.md"), "utf8");
for (const marker of ["OpenMino", "Ethan", "MIT"]) {
  if (!notice.includes(marker)) {
    fail(`Blex default workspace resource mino/OPENMINO_NOTICE.md must preserve ${marker} attribution`);
  }
}

let pet;
try {
  pet = JSON.parse(readFileSync(join(MINO_ROOT, "pet.json"), "utf8"));
} catch {
  fail("Blex default workspace resource mino/pet.json must be valid JSON");
}
if (pet.id !== "mino" || pet.displayName !== "Blex") {
  fail("Blex default workspace pet must display as Blex while retaining the compatibility id mino");
}

console.log(
  `[Bundled resource validation] Blex default workspace (mino/) is complete (${fileCount} files, ${skillCount} skills)`,
);
