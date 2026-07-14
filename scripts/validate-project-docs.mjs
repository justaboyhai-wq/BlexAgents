import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const company = '杭州波粒二象文化科技有限公司';
const required = [
  'README.md',
  'README.en.md',
  'LICENSE',
  'NOTICE',
  'TRADEMARKS.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  'THIRD_PARTY_NOTICES.md',
  'AGENTHUB_CONTENT_POLICY.md',
  'AGENTHUB_SUBMISSION_AGREEMENT.md',
  'specs/ARCHITECTURE.md',
  'specs/tech_docs/multi_agent_runtime.md',
  'specs/tech_docs/im_integration_architecture.md',
  'specs/legal/OFFICIAL_DISTRIBUTION_TERMS.md',
  'specs/legal/PRIVACY.md',
  'docs/internal/DEVELOPMENT.md',
];
const errors = [];
const contents = new Map();

for (const relative of required) {
  const absolute = resolve(root, relative);
  if (!existsSync(absolute)) {
    errors.push(`缺少必需文档: ${relative}`);
    continue;
  }
  const content = readFileSync(absolute, 'utf8');
  if (!content.trim()) errors.push(`文档为空: ${relative}`);
  contents.set(relative, content);
}

for (const relative of ['NOTICE', 'SECURITY.md', 'specs/legal/OFFICIAL_DISTRIBUTION_TERMS.md', 'specs/legal/PRIVACY.md']) {
  const content = contents.get(relative) ?? '';
  if (!content.includes(company)) errors.push(`${relative} 未声明公司主体`);
}

const forbidden = [
  /Release gate:/i,
  /registered legal entity/i,
  /注册法律实体/,
  /UNKNOWN — manual review required/,
  /github\.com\/justaboyhai-wq\/BlexAgents\/issues/i,
];
for (const [relative, content] of contents) {
  for (const pattern of forbidden) {
    if (pattern.test(content)) errors.push(`${relative} 含未清理占位或内部支持入口: ${pattern}`);
  }
}

const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g;
for (const [relative, content] of contents) {
  if (extname(relative).toLowerCase() !== '.md') continue;
  for (const match of content.matchAll(markdownLink)) {
    const raw = match[1].trim().replace(/^<|>$/g, '');
    if (!raw || raw.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('mailto:')) continue;
    const path = decodeURIComponent(raw.split('#', 1)[0]);
    if (!existsSync(resolve(root, dirname(relative), path))) {
      errors.push(`${relative} 含无效本地链接: ${raw}`);
    }
  }
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (packageJson.private !== true) errors.push('package.json 必须保持 private=true');
if (packageJson.license !== 'Apache-2.0') errors.push('package.json 必须声明 license=Apache-2.0');
if (!String(packageJson.author ?? '').includes(company)) errors.push('package.json author 与公司主体不一致');

if (errors.length) {
  console.error('项目文档校验失败:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`项目文档校验通过（${required.length} 个必需文档）。`);
