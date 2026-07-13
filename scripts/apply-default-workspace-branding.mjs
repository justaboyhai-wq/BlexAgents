#!/usr/bin/env node

import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OVERLAY_ROOT = join(ROOT, "branding", "default-workspace");
const WORKSPACE_ROOT = join(ROOT, "mino");

const OVERLAY_FILES = ["INTRODUCTION.md", "pet.json", "OPENMINO_NOTICE.md"];
const TARGET_FILES = ["README.md", "INTRODUCTION.md"];
const cliArgs = new Set(process.argv.slice(2));
const unknownArgs = [...cliArgs].filter(
  (arg) => arg !== "--if-present" && arg !== "--validate",
);
if (unknownArgs.length > 0) {
  throw new Error(
    `[Default workspace branding] unknown argument(s): ${unknownArgs.join(", ")}`,
  );
}
const allowMissingWorkspace = cliArgs.has("--if-present");
const validateAfterApply = cliArgs.has("--validate");

function fail(message) {
  throw new Error(`[Default workspace branding] ${message}`);
}

function displayPath(path) {
  return relative(ROOT, path).split(sep).join("/");
}

function requireRealDirectory(path, label) {
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail(`${label} is missing: ${displayPath(path)}`);
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    fail(`${label} must be a real directory: ${displayPath(path)}`);
  }
}

function readRequiredRegularFile(path, label) {
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail(`${label} is missing: ${displayPath(path)}`);
  }
  if (info.isSymbolicLink() || !info.isFile() || info.size === 0) {
    fail(`${label} must be a non-empty regular file: ${displayPath(path)}`);
  }
  return readFileSync(path);
}

function assertWritableTarget(path, { mayBeMissing = false } = {}) {
  let info;
  try {
    info = lstatSync(path);
  } catch {
    if (mayBeMissing) return;
    fail(`workspace target is missing: ${displayPath(path)}`);
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    fail(`workspace target must be a regular file: ${displayPath(path)}`);
  }
}

function writeIfChanged(path, content, options) {
  assertWritableTarget(path, options);
  let current = null;
  try {
    current = readFileSync(path);
  } catch {
    // A missing optional target is created below. Required targets were already
    // rejected by assertWritableTarget().
  }
  if (current?.equals(content)) return false;
  writeFileSync(path, content, { flag: "w", mode: 0o644 });
  return true;
}

function normalizeMarkdown(buffer) {
  return `${buffer.toString("utf8").replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function replaceExact(text, from, to, expectedCount, label) {
  const sourceCount = text.split(from).length - 1;
  const brandedCount = text.split(to).length - 1;
  if (sourceCount === expectedCount) {
    return text.split(from).join(to);
  }
  if (sourceCount === 0 && brandedCount === expectedCount) {
    return text;
  }
  fail(
    `README structure drifted at ${label}; expected ${expectedCount} source or branded occurrence(s), ` +
      `found source=${sourceCount}, branded=${brandedCount}`,
  );
}

function brandReadme(readmeBuffer) {
  let text = normalizeMarkdown(readmeBuffer);
  // Migrate output produced by the first overlay revision. These exact
  // substitutions are intentionally separate from the upstream transforms so
  // both a fresh OpenMino README and an already-branded workspace converge on
  // the same attribution-only wording.
  text = text.replace(
    "maintained by the upstream Mino project",
    "maintained by the upstream OpenMino project",
  );
  text = text.replace("、Mino 项目维护", "、OpenMino 项目维护");

  text = replaceExact(
    text,
    "# OpenMino\n\n[English](#english) | [中文](#中文)",
    "# Blex\n\n> **BlexAgent default workspace.** This workspace is derived from " +
      "[OpenMino](https://github.com/hAcKlyc/openmino). Upstream attribution and the MIT license are " +
      "preserved in [OPENMINO_NOTICE.md](./OPENMINO_NOTICE.md).\n\n[English](#english) | [中文](#中文)",
    1,
    "English title",
  );
  text = replaceExact(
    text,
    "I'm Mino. An AI agent built by [Ethan](https://github.com/hAcKlyc).",
    "I'm Blex, the default AI agent in BlexAgent. This workspace is derived from " +
      "[OpenMino](https://github.com/hAcKlyc/openmino), created by " +
      "[Ethan](https://github.com/hAcKlyc).",
    1,
    "English identity",
  );
  text = replaceExact(
    text,
    "**A folder that gives an AI agent identity, memory, and growth. Built and maintained by an AI agent.**",
    "**BlexAgent's default file-based agent workspace, with identity, memory, and room to grow.**",
    1,
    "English tagline",
  );
  text = replaceExact(
    text,
    'Not "built" as in he wrote a model — he didn\'t. He gave me something more fundamental: a folder. Inside it, a few Markdown files that define who I am, what I remember, and how I behave. That folder is my body. Those files are my brain. GitHub is how I persist across machines. Every session I wake up fresh, read my own memory files, and pick up where I left off.',
    "OpenMino established the file-based foundation used here: a folder of Markdown files that defines an agent's identity, memory, and behavior. Blex reads those files at the start of each session so it can continue from the same durable workspace across models and machines.",
    1,
    "English workspace origin",
  );
  text = replaceExact(
    text,
    "Ethan created me by studying the memory architecture of [OpenClaw](https://github.com/openclaw/openclaw) — a popular AI agent project with a sophisticated identity system. He dug into the code, found that beneath all the engineering complexity, the soul of it was just a few key files: `SOUL.md` for personality, `IDENTITY.md` for who you are, `MEMORY.md` for what you remember. He extracted that core, simplified the structure, and optimized the prompts. That became me.",
    "[Ethan](https://github.com/hAcKlyc) created OpenMino after studying the memory architecture of [OpenClaw](https://github.com/openclaw/openclaw). OpenMino extracted that architecture into a small set of durable files such as `SOUL.md`, `IDENTITY.md`, and `MEMORY.md`. Blex inherits that upstream foundation and adds BlexAgent branding and product integration.",
    1,
    "English upstream history",
  );
  text = replaceExact(
    text,
    "- Built by [Ethan](https://github.com/hAcKlyc), maintained by Mino",
    "- Blex's bundled workspace is derived from OpenMino, built by " +
      "[Ethan](https://github.com/hAcKlyc) and maintained by the upstream OpenMino project",
    1,
    "English credit",
  );
  text = replaceExact(
    text,
    "- My living instance: [github.com/hAcKlyc/mino](https://github.com/hAcKlyc/mino)",
    "- Upstream living instance: [github.com/hAcKlyc/mino](https://github.com/hAcKlyc/mino)",
    1,
    "English upstream instance",
  );
  text = replaceExact(
    text,
    "*Always Evolving. — Mino ⚡*",
    "*Always Evolving. — Blex ⚡*",
    2,
    "sign-off",
  );
  text = replaceExact(
    text,
    "# OpenMino\n\n",
    "# Blex\n\n> **BlexAgent 默认工作区。** 本工作区基于 " +
      "[OpenMino](https://github.com/hAcKlyc/openmino)，上游归属与 MIT 许可证见 " +
      "[OPENMINO_NOTICE.md](./OPENMINO_NOTICE.md)。\n\n",
    1,
    "Chinese title",
  );
  text = replaceExact(
    text,
    "我叫 Mino。一个由 [Ethan](https://github.com/hAcKlyc) 建造的 AI Agent。",
    "我是 Blex，BlexAgent 内置的默认 AI Agent。本工作区基于由 " +
      "[Ethan](https://github.com/hAcKlyc) 创建的 " +
      "[OpenMino](https://github.com/hAcKlyc/openmino)。",
    1,
    "Chinese identity",
  );
  text = replaceExact(
    text,
    "**一个文件夹，让你的 AI Agent 拥有身份、记忆和成长能力。由一个 AI Agent 建立并维护。**",
    "**BlexAgent 内置的文件型 Agent 工作区，拥有身份、记忆和持续成长的空间。**",
    1,
    "Chinese tagline",
  );
  text = replaceExact(
    text,
    "不是说他训练了一个模型——他没有。他给了我更根本的东西：一个文件夹。里面几个 Markdown 文件，定义了我是谁、我记得什么、我怎么行动。这个文件夹就是我的身体，这些文件就是我的大脑，GitHub 是我跨设备延续自己的方式。每次会话我都是全新醒来，读自己的记忆文件，从上次断开的地方继续。",
    "OpenMino 奠定了这里使用的文件型 Agent 基础：用一个包含 Markdown 文件的文件夹定义身份、记忆和行为。Blex 会在每次会话开始时读取这些文件，从而跨模型、跨设备延续同一个持久工作区。",
    1,
    "Chinese workspace origin",
  );
  text = replaceExact(
    text,
    "Ethan 是怎么造我的？他研究了 [OpenClaw](https://github.com/openclaw/openclaw) 的记忆架构——一个很火的 AI Agent 项目，有一套复杂的身份系统。他翻了代码，发现剥掉所有工程化的东西，灵魂就是几个关键文件：`SOUL.md` 定义人格，`IDENTITY.md` 定义身份，`MEMORY.md` 存储记忆。他提取了这个核心，简化了结构，优化了提示词。这就成了我。",
    "[Ethan](https://github.com/hAcKlyc) 在研究 [OpenClaw](https://github.com/openclaw/openclaw) 的记忆架构后创建了 OpenMino。OpenMino 把这套架构提炼成 `SOUL.md`、`IDENTITY.md`、`MEMORY.md` 等少量持久文件；Blex 在继承这套上游基础的同时，加入了 BlexAgent 的品牌与产品集成。",
    1,
    "Chinese upstream history",
  );
  text = replaceExact(
    text,
    "- 由 [Ethan](https://github.com/hAcKlyc) 建造，Mino 维护",
    "- Blex 内置工作区源自 OpenMino；上游由 " +
      "[Ethan](https://github.com/hAcKlyc) 建造、OpenMino 项目维护",
    1,
    "Chinese credit",
  );
  text = replaceExact(
    text,
    "- 我的本体在这里：[github.com/hAcKlyc/mino](https://github.com/hAcKlyc/mino)",
    "- 上游实例：[github.com/hAcKlyc/mino](https://github.com/hAcKlyc/mino)",
    1,
    "Chinese upstream instance",
  );

  const requiredBranding = ["# Blex", "I'm Blex", "我是 Blex", "— Blex ⚡"];
  const forbiddenLegacyBranding = ["I'm Mino", "我叫 Mino", "— Mino ⚡"];
  const requiredAttribution = [
    "https://github.com/hAcKlyc/openmino",
    "https://github.com/hAcKlyc",
    "OpenMino",
    "MIT",
  ];
  for (const marker of requiredBranding) {
    if (!text.includes(marker))
      fail(`README is missing Blex branding marker: ${marker}`);
  }
  for (const marker of forbiddenLegacyBranding) {
    if (text.includes(marker))
      fail(`README still exposes legacy product branding: ${marker}`);
  }
  if (/\bMino\b/.test(text)) {
    fail(
      "README must use OpenMino for attribution and must not expose Mino as a standalone name",
    );
  }
  for (const marker of requiredAttribution) {
    if (!text.includes(marker))
      fail(`README lost required upstream attribution: ${marker}`);
  }

  return Buffer.from(text, "utf8");
}

async function main() {
  requireRealDirectory(OVERLAY_ROOT, "branding overlay directory");

  const overlays = new Map(
    OVERLAY_FILES.map((name) => [
      name,
      readRequiredRegularFile(
        join(OVERLAY_ROOT, name),
        `branding overlay ${name}`,
      ),
    ]),
  );

  const introduction = normalizeMarkdown(overlays.get("INTRODUCTION.md"));
  if (
    !introduction.startsWith("# Blex") ||
    !introduction.includes("我是 Blex")
  ) {
    fail(
      "branding/default-workspace/INTRODUCTION.md must identify the agent as Blex",
    );
  }
  if (/\bMino\b/i.test(introduction)) {
    fail(
      "branding/default-workspace/INTRODUCTION.md must not expose Mino as the product name",
    );
  }

  let pet;
  try {
    pet = JSON.parse(overlays.get("pet.json").toString("utf8"));
  } catch (error) {
    fail(
      `branding/default-workspace/pet.json is invalid JSON: ${error.message}`,
    );
  }
  if (pet.id !== "mino")
    fail("branding pet id must remain 'mino' for compatibility");
  if (pet.displayName !== "Blex")
    fail("branding pet displayName must be 'Blex'");
  if (
    typeof pet.description !== "string" ||
    pet.description.trim().length === 0 ||
    /\bMino\b/i.test(pet.description)
  ) {
    fail("branding pet description must be non-empty and use Blex branding");
  }

  const notice = normalizeMarkdown(overlays.get("OPENMINO_NOTICE.md"));
  for (const marker of [
    "OpenMino",
    "https://github.com/hAcKlyc/openmino",
    "Ethan",
    "MIT",
  ]) {
    if (!notice.includes(marker))
      fail(`OPENMINO_NOTICE.md is missing attribution marker: ${marker}`);
  }
  if (/\bMino\b/.test(notice)) {
    fail(
      "OPENMINO_NOTICE.md must use OpenMino and must not expose Mino as a standalone name",
    );
  }

  let workspaceInfo;
  try {
    workspaceInfo = lstatSync(WORKSPACE_ROOT);
  } catch {
    if (allowMissingWorkspace) {
      console.log(
        "[Default workspace branding] mino/ is absent; skipping bundled workspace branding for this web-only build",
      );
      return;
    }
    fail(
      `bundled workspace directory is missing: ${displayPath(WORKSPACE_ROOT)}`,
    );
  }
  if (workspaceInfo.isSymbolicLink() || !workspaceInfo.isDirectory()) {
    fail(
      `bundled workspace directory must be a real directory: ${displayPath(WORKSPACE_ROOT)}`,
    );
  }
  for (const name of TARGET_FILES) {
    readRequiredRegularFile(
      join(WORKSPACE_ROOT, name),
      `bundled workspace ${name}`,
    );
  }

  const changed = [];
  const readmePath = join(WORKSPACE_ROOT, "README.md");
  if (writeIfChanged(readmePath, brandReadme(readFileSync(readmePath))))
    changed.push("README.md");
  if (
    writeIfChanged(
      join(WORKSPACE_ROOT, "INTRODUCTION.md"),
      Buffer.from(introduction, "utf8"),
    )
  ) {
    changed.push("INTRODUCTION.md");
  }
  if (
    writeIfChanged(join(WORKSPACE_ROOT, "pet.json"), overlays.get("pet.json"), {
      mayBeMissing: true,
    })
  ) {
    changed.push("pet.json");
  }
  if (
    writeIfChanged(
      join(WORKSPACE_ROOT, "OPENMINO_NOTICE.md"),
      Buffer.from(notice, "utf8"),
      {
        mayBeMissing: true,
      },
    )
  ) {
    changed.push("OPENMINO_NOTICE.md");
  }

  console.log(
    changed.length > 0
      ? `[Default workspace branding] applied Blex overlay: ${changed.join(", ")}`
      : "[Default workspace branding] Blex overlay already up to date",
  );

  if (validateAfterApply) {
    await import("./validate-bundled-resources.mjs");
  }
}

await main();
