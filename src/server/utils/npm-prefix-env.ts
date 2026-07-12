import { normalize, win32 as pathWin32 } from 'path';

const NPM_PREFIX_ENV_KEYS = [
  'npm_config_prefix',
  'NPM_CONFIG_PREFIX',
  'PREFIX',
] as const;

function isWindowsPlatform(platform = process.platform): boolean {
  return platform === 'win32';
}

export function getBlexAgentNpmGlobalPrefix(
  home: string,
  platform = process.platform,
): string | null {
  if (!home) return null;
  return isWindowsPlatform(platform)
    ? pathWin32.resolve(home, '.blexagent', 'npm-global')
    : `${home}/.blexagent/npm-global`;
}

export function getBlexAgentNpmGlobalBinDir(
  home: string,
  platform = process.platform,
): string | null {
  const prefix = getBlexAgentNpmGlobalPrefix(home, platform);
  if (!prefix) return null;
  // npm on Windows puts command shims under prefix root, not prefix/bin.
  return isWindowsPlatform(platform) ? prefix : `${prefix}/bin`;
}

function normalizeForCompare(pathValue: string, platform = process.platform): string {
  let normalized = normalize(pathValue);
  while (normalized.length > 1 && /[/\\]$/.test(normalized)) {
    normalized = normalized.slice(0, -1);
  }
  return isWindowsPlatform(platform) ? normalized.toLowerCase() : normalized;
}

function samePath(a: string, b: string, platform = process.platform): boolean {
  return normalizeForCompare(a, platform) === normalizeForCompare(b, platform);
}

export function scrubBlexAgentNpmPrefixEnv(
  env: NodeJS.ProcessEnv,
  blexAgentPrefix: string | null,
  platform = process.platform,
): void {
  if (!blexAgentPrefix) return;

  for (const key of NPM_PREFIX_ENV_KEYS) {
    const value = env[key];
    if (value && samePath(value, blexAgentPrefix, platform)) {
      delete env[key];
    }
  }
}
