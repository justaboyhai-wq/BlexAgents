import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SUBSCRIPTION_PROVIDER_ID } from '../../shared/config-types';
import { applyWindowsUtf8SubprocessEnv, buildClaudeSessionEnv } from '../agent-session';
import { __resetModelCapabilityCacheForTests } from '../utils/model-capabilities';

interface TestModelCapability {
  model: string;
  contextLength: number;
}

const modelRegistryHomes: string[] = [];

function useIsolatedModelRegistry(models: TestModelCapability[]): void {
  const home = mkdtempSync(resolve(tmpdir(), 'blexagent-model-registry-'));
  modelRegistryHomes.push(home);
  const providersDir = resolve(home, '.blexagent', 'providers');
  mkdirSync(providersDir, { recursive: true });
  writeFileSync(resolve(providersDir, 'integration-test-provider.json'), JSON.stringify({
    id: 'integration-test-provider',
    models,
  }));
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  __resetModelCapabilityCacheForTests();
}

function cleanupIsolatedModelRegistries(): void {
  __resetModelCapabilityCacheForTests();
  for (const home of modelRegistryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
}

describe('buildClaudeSessionEnv npm prefix isolation', () => {
  const tempHomes: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const home of tempHomes.splice(0)) {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('does not leak BlexAgent npm prefix variables into the SDK shell env', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'blexagent-env-home-'));
    tempHomes.push(home);
    const prefix = process.platform === 'win32'
      ? resolve(home, '.blexagent', 'npm-global')
      : `${home}/.blexagent/npm-global`;
    const binDir = process.platform === 'win32' ? prefix : `${prefix}/bin`;

    vi.stubEnv(process.platform === 'win32' ? 'USERPROFILE' : 'HOME', home);
    vi.stubEnv('npm_config_prefix', prefix);
    vi.stubEnv('NPM_CONFIG_PREFIX', prefix);
    vi.stubEnv('PREFIX', prefix);

    const env = buildClaudeSessionEnv();
    const pathValue = env[process.platform === 'win32' ? 'Path' : 'PATH'] ?? '';

    expect(env.npm_config_prefix).toBeUndefined();
    expect(env.NPM_CONFIG_PREFIX).toBeUndefined();
    expect(env.PREFIX).toBeUndefined();
    expect(env.BLEXAGENT_NPM_GLOBAL_PREFIX).toBe(prefix);
    expect(pathValue.split(delimiter)).toContain(binDir);
  });
});

describe('Windows SDK subprocess UTF-8 env', () => {
  const tempHomes: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    for (const home of tempHomes.splice(0)) {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('is a no-op outside Windows', () => {
    const env: NodeJS.ProcessEnv = {};

    applyWindowsUtf8SubprocessEnv(env, { platform: 'darwin', useBashEnvPrelude: true });

    expect(env.LANG).toBeUndefined();
    expect(env.BASH_ENV).toBeUndefined();
  });

  it('sets UTF-8 locale and Python stdio env on Windows', () => {
    const env: NodeJS.ProcessEnv = {};

    applyWindowsUtf8SubprocessEnv(env, { platform: 'win32', useBashEnvPrelude: false });

    expect(env.LANG).toBe('C.UTF-8');
    expect(env.LC_ALL).toBe('C.UTF-8');
    expect(env.PYTHONUTF8).toBe('1');
    expect(env.PYTHONIOENCODING).toBe('utf-8');
    expect(env.LESSCHARSET).toBe('utf-8');
    expect(env.BASH_ENV).toBeUndefined();
  });

  it('installs a Git Bash UTF-8 BASH_ENV prelude without touching an existing shell prefix', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'blexagent-env-home-'));
    tempHomes.push(home);
    const env: NodeJS.ProcessEnv = {
      BASH_ENV: 'C:\\custom\\bash-env.sh',
      CLAUDE_CODE_SHELL_PREFIX: 'echo existing;',
    };

    applyWindowsUtf8SubprocessEnv(env, { platform: 'win32', useBashEnvPrelude: true, home });

    expect(env.BASH_ENV).toContain('windows-utf8-bash-env.sh');
    expect(env.BLEXAGENT_ORIGINAL_BASH_ENV).toBe('C:/custom/bash-env.sh');
    expect(env.CLAUDE_CODE_SHELL_PREFIX).toBe('echo existing;');
    const prelude = readFileSync(env.BASH_ENV!, 'utf-8');
    expect(prelude).toContain('BLEXAGENT_WINDOWS_UTF8');
    expect(prelude).toContain('BLEXAGENT_ORIGINAL_BASH_ENV');
    expect(prelude).toContain('chcp.com 65001');
  });

  it('does not replace the BASH_ENV prelude when applied repeatedly', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'blexagent-env-home-'));
    tempHomes.push(home);
    const env: NodeJS.ProcessEnv = {};

    applyWindowsUtf8SubprocessEnv(env, { platform: 'win32', useBashEnvPrelude: true, home });
    const once = env.BASH_ENV;
    applyWindowsUtf8SubprocessEnv(env, { platform: 'win32', useBashEnvPrelude: true, home });

    expect(env.BASH_ENV).toBe(once);
  });

  it('applies the UTF-8 env contract from buildClaudeSessionEnv when Windows Git Bash is resolved', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'blexagent-env-home-'));
    tempHomes.push(home);
    const inheritedGitBashPath = resolve(process.cwd(), 'package.json');
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.stubEnv('USERPROFILE', home);
    vi.stubEnv('CLAUDE_CODE_GIT_BASH_PATH', inheritedGitBashPath);
    vi.stubEnv('CLAUDE_CODE_SHELL_PREFIX', 'echo existing;');

    const env = buildClaudeSessionEnv();

    expect(env.CLAUDE_CODE_GIT_BASH_PATH).toBe(inheritedGitBashPath);
    expect(env.LANG).toBe('C.UTF-8');
    expect(env.LC_ALL).toBe('C.UTF-8');
    expect(env.PYTHONUTF8).toBe('1');
    expect(env.PYTHONIOENCODING).toBe('utf-8');
    expect(env.LESSCHARSET).toBe('utf-8');
    expect(env.BASH_ENV).toContain('windows-utf8-bash-env.sh');
    expect(readFileSync(env.BASH_ENV!, 'utf-8')).toContain('chcp.com 65001');
    expect(env.CLAUDE_CODE_SHELL_PREFIX).toBe('echo existing;');
  });

  it('keeps the BASH_ENV prelude when Git Bash falls back to SDK PATH lookup', () => {
    const home = mkdtempSync(resolve(tmpdir(), 'blexagent-env-home-'));
    tempHomes.push(home);
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.stubEnv('USERPROFILE', home);
    vi.stubEnv('CLAUDE_CODE_GIT_BASH_PATH', resolve(home, 'missing-bash.exe'));
    // Keep this a PATH-fallback test even on Windows development machines that
    // have Git installed in one of BlexAgent's auto-detection locations.
    vi.stubEnv('PROGRAMFILES', resolve(home, 'program-files'));
    vi.stubEnv('PROGRAMFILES(X86)', resolve(home, 'program-files-x86'));
    vi.stubEnv('LOCALAPPDATA', resolve(home, 'local-app-data'));

    const env = buildClaudeSessionEnv();

    expect(env.CLAUDE_CODE_GIT_BASH_PATH).toBe('');
    expect(env.BASH_ENV).toContain('windows-utf8-bash-env.sh');
    expect(readFileSync(env.BASH_ENV!, 'utf-8')).toContain('chcp.com 65001');
  });
});

describe('session model alias resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    cleanupIsolatedModelRegistries();
  });

  it('uses the active model for built-in subagent alias env when aliases are collapsed', () => {
    const activeModel = 'integration-test-extended-context';
    useIsolatedModelRegistry([{ model: activeModel, contextLength: 204_800 }]);

    const env = buildClaudeSessionEnv(
      {
        providerId: 'integration-test-provider',
        baseUrl: 'https://api.test-provider.example',
        apiKey: 'test-key',
        modelAliases: {
          sonnet: 'provider-default',
          opus: 'provider-default',
          haiku: 'provider-default',
        },
      },
      activeModel,
    );

    // #335 — a registered contextLength above the SDK 200K default makes the
    // SDK-ingress `_MODEL` envs carry `[1m]`; display `_MODEL_NAME` stays raw.
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe(`${activeModel}[1m]`);
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe(`${activeModel}[1m]`);
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe(`${activeModel}[1m]`);
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME).toBe(activeModel);
  });

  it('keeps split subagent alias env unchanged', () => {
    useIsolatedModelRegistry([
      { model: 'provider-pro', contextLength: 200_000 },
      { model: 'provider-flash', contextLength: 128_000 },
    ]);

    const env = buildClaudeSessionEnv(
      {
        providerId: 'integration-test-provider',
        baseUrl: 'https://api.deepseek.example',
        apiKey: 'test-key',
        modelAliases: {
          sonnet: 'provider-pro',
          opus: 'provider-pro',
          haiku: 'provider-flash',
        },
      },
      'provider-pro',
    );

    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('provider-pro');
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('provider-pro');
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('provider-flash');
  });
});

describe('Claude Code provider-managed host env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not mark Anthropic subscription auth as host-managed', () => {
    vi.stubEnv('CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST', '1');

    const env = buildClaudeSessionEnv(
      {},
      'claude-opus-4-8',
      { providerId: SUBSCRIPTION_PROVIDER_ID },
    );

    expect(env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST).toBeUndefined();
  });

  it('keeps host-managed provider env stripping for third-party providers', () => {
    const env = buildClaudeSessionEnv(
      {
        providerId: 'deepseek',
        baseUrl: 'https://api.deepseek.example/anthropic',
        apiKey: 'test-key',
      },
      'deepseek-chat',
      { providerId: 'deepseek' },
    );

    expect(env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST).toBe('1');
  });
});

describe('Claude SDK context window env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    cleanupIsolatedModelRegistries();
  });

  it('keeps the registered Claude 4.6 safe default at 200K without forcing SDK 1M disable flags (#392)', () => {
    useIsolatedModelRegistry([{ model: 'claude-opus-4-6', contextLength: 200_000 }]);
    vi.stubEnv('CLAUDE_CODE_DISABLE_1M_CONTEXT', '');
    vi.stubEnv('CLAUDE_CODE_ENABLE_1M_CONTEXT', '1');

    const env = buildClaudeSessionEnv(undefined, 'claude-opus-4-6');

    expect(env.CLAUDE_CODE_DISABLE_1M_CONTEXT).toBe('');
    expect(env.CLAUDE_CODE_ENABLE_1M_CONTEXT).toBe('1');
    expect(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('200000');
  });

  it('uses registered 1M windows for Opus 4.7 / 4.8', () => {
    useIsolatedModelRegistry([
      { model: 'claude-opus-4-7', contextLength: 1_000_000 },
      { model: 'claude-opus-4-8', contextLength: 1_000_000 },
    ]);
    expect(buildClaudeSessionEnv(undefined, 'claude-opus-4-7').CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('1000000');
    expect(buildClaudeSessionEnv(undefined, 'claude-opus-4-8').CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('1000000');
  });

  it('keeps provider-routed sessions eligible for registry-backed SDK 1M unlocks', () => {
    const activeModel = 'integration-test-provider-routed-model';
    useIsolatedModelRegistry([{ model: activeModel, contextLength: 204_800 }]);

    const env = buildClaudeSessionEnv(
      {
        providerId: 'integration-test-provider',
        baseUrl: 'https://api.test-provider.example',
        apiKey: 'test-key',
        modelAliases: {
          sonnet: 'provider-default',
          opus: 'provider-default',
          haiku: 'provider-default',
        },
      },
      activeModel,
    );

    expect(env.CLAUDE_CODE_DISABLE_1M_CONTEXT).toBeUndefined();
    expect(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('204800');
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe(`${activeModel}[1m]`);
  });
});
