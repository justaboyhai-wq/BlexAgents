/**
 * Regression test for issue #237 — IM Channel environment used a stale
 * provider blob instead of re-resolving from the agent's canonical `providerId`.
 *
 * The fix added `resolveImProviderEnv(agentDir, channelId)` in
 * `src/server/utils/admin-config.ts` and wired it into `/api/im/enqueue`.
 * This test pins the contract of the helper so future refactors don't silently
 * regress back to "trust the blob": providerId > providerEnvJson, with channel
 * override winning over agent default.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let scratch: string;
let prevHome: string | undefined;
let prevUserProfile: string | undefined;

const AGENT_WORKSPACE = '/tmp/agent-237';
const PRIMARY_PROVIDER_ID = 'fixture-primary-provider';
const PRIMARY_MODEL = 'fixture-primary-pro';
const PRIMARY_FAST_MODEL = 'fixture-primary-flash';
const PRIMARY_BASE_URL = 'https://primary-provider.invalid/anthropic';
const SECONDARY_PROVIDER_ID = 'fixture-secondary-provider';
const SECONDARY_MODEL = 'fixture-secondary-model';
const SECONDARY_BASE_URL = 'https://secondary-provider.invalid/anthropic';
const TERTIARY_PROVIDER_ID = 'fixture-tertiary-provider';
const TERTIARY_MODEL = 'fixture-tertiary-model';
const TERTIARY_BASE_URL = 'https://tertiary-provider.invalid/anthropic';

function writeConfig(config: Record<string, unknown>): void {
  writeFileSync(
    join(scratch, '.blexagent', 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8',
  );
}

function writeCustomProvider(provider: Record<string, unknown>): void {
  const providersDir = join(scratch, '.blexagent', 'providers');
  mkdirSync(providersDir, { recursive: true });
  writeFileSync(
    join(providersDir, `${String(provider.id)}.json`),
    JSON.stringify(provider, null, 2),
    'utf-8',
  );
}

function writeApiProvider(
  id: string,
  model: string,
  baseUrl: string,
  fastModel = model,
): void {
  writeCustomProvider({
    id,
    name: id,
    vendor: id,
    cloudProvider: id,
    type: 'api',
    authType: 'auth_token',
    primaryModel: model,
    isBuiltin: false,
    config: { baseUrl },
    modelAliases: { fable: model, sonnet: model, opus: model, haiku: fastModel },
    models: [
      { model, modelName: model, modelSeries: id },
      ...(fastModel === model
        ? []
        : [{ model: fastModel, modelName: fastModel, modelSeries: id }]),
    ],
  });
}

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'blexagent-im-provider-'));
  const configDir = join(scratch, '.blexagent');
  mkdirSync(configDir, { recursive: true });
  prevHome = process.env.HOME;
  prevUserProfile = process.env.USERPROFILE;
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;
  writeApiProvider(PRIMARY_PROVIDER_ID, PRIMARY_MODEL, PRIMARY_BASE_URL, PRIMARY_FAST_MODEL);
  writeApiProvider(SECONDARY_PROVIDER_ID, SECONDARY_MODEL, SECONDARY_BASE_URL);
  writeApiProvider(TERTIARY_PROVIDER_ID, TERTIARY_MODEL, TERTIARY_BASE_URL);
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  rmSync(scratch, { recursive: true, force: true });
});

describe('resolveImProviderEnv (#237)', () => {
  it('resolves agent providerId fresh — ignores stale agent.providerEnvJson blob', async () => {
    // User scenario from #237: agent.providerId is current, but
    // agent.providerEnvJson still holds a different provider blob from before the user
    // switched providers. The helper MUST resolve via providerId and never
    // touch the stale blob.
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        // Intentionally stale: looks valid but for the WRONG provider.
        providerEnvJson: JSON.stringify({
          baseUrl: SECONDARY_BASE_URL,
          apiKey: 'old-secondary-key',
          authType: 'auth_token',
          modelAliases: { sonnet: SECONDARY_MODEL, opus: SECONDARY_MODEL, haiku: SECONDARY_MODEL },
        }),
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: { [PRIMARY_PROVIDER_ID]: 'sk-test-primary' },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    const env = resolveImProviderEnv(AGENT_WORKSPACE, undefined);

    expect(env).toBeDefined();
    expect(env!.baseUrl).toBe(PRIMARY_BASE_URL);
    expect(env!.apiKey).toBe('sk-test-primary');
    // Custom provider aliases are completed for SDK sub-agent aliases by
    // completeModelAliases().
    expect(env!.modelAliases).toEqual({
      fable: PRIMARY_MODEL,
      sonnet: PRIMARY_MODEL,
      opus: PRIMARY_MODEL,
      haiku: PRIMARY_FAST_MODEL,
    });
  });

  it('honors channel.overrides.providerId when present (intentional per-channel override)', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [{
          id: 'channel-1',
          type: 'openclaw:wecom-openclaw-plugin',
          enabled: true,
          overrides: { providerId: SECONDARY_PROVIDER_ID, model: SECONDARY_MODEL },
        }],
      }],
      providerApiKeys: {
        [PRIMARY_PROVIDER_ID]: 'sk-primary',
        [SECONDARY_PROVIDER_ID]: 'sk-secondary',
      },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    // With channelId → channel override wins.
    const overrideEnv = resolveImProviderEnv(AGENT_WORKSPACE, 'channel-1');
    expect(overrideEnv?.baseUrl).toBe(SECONDARY_BASE_URL);
    // Without channelId → agent default.
    const defaultEnv = resolveImProviderEnv(AGENT_WORKSPACE, undefined);
    expect(defaultEnv?.baseUrl).toBe(PRIMARY_BASE_URL);
  });

  it('returns undefined when providerId resolution fails (missing API key)', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [],
      }],
      // No providerApiKeys entry — resolveProviderEnv returns undefined.
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    expect(resolveImProviderEnv(AGENT_WORKSPACE, undefined)).toBeUndefined();
  });

  it('falls back to config.defaultProviderId when agent has no providerId', async () => {
    writeConfig({
      defaultProviderId: PRIMARY_PROVIDER_ID,
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: { [PRIMARY_PROVIDER_ID]: 'sk-primary' },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    const env = resolveImProviderEnv(AGENT_WORKSPACE, undefined);
    expect(env?.baseUrl).toBe(PRIMARY_BASE_URL);
  });

  it('returns undefined when agent cannot be matched by workspacePath', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: '/other/path',
        providerId: PRIMARY_PROVIDER_ID,
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: { [PRIMARY_PROVIDER_ID]: 'sk-primary' },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    expect(resolveImProviderEnv(AGENT_WORKSPACE, undefined)).toBeUndefined();
  });

  it('Codex review-fix #1: does NOT fall through to defaultProviderId when no agent matches', async () => {
    // Regression guard: previously the helper fell through to
    // `config.defaultProviderId` whenever the agent lookup failed (legacy IM bot
    // / workspace-path drift). That would silently reroute every unmatched IM
    // call to the global default provider, which is strictly worse than the
    // stale-blob bug we set out to fix. Returning undefined here lets the
    // caller fall back to `payload.providerEnv`.
    writeConfig({
      defaultProviderId: SECONDARY_PROVIDER_ID,
      agents: [{
        id: 'agent-other',
        name: 'Other',
        enabled: true,
        workspacePath: '/other/path', // does NOT match AGENT_WORKSPACE
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: {
        [PRIMARY_PROVIDER_ID]: 'sk-primary',
        [SECONDARY_PROVIDER_ID]: 'sk-secondary',
      },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    expect(resolveImProviderEnv(AGENT_WORKSPACE, undefined)).toBeUndefined();
  });

  it('Codex review-fix #2: honors legacy channel root-level providerId (pre-bc06386)', async () => {
    // Pre-v0.1.45 the in-IM `/provider` command wrote the channel-root
    // `providerId` field directly (not via `overrides.providerId`). Rust still
    // honors that field — `ChannelConfigRust::to_im_config` at
    // src-tauri/src/im/types.rs:968 walks `overrides.provider_id → channel
    // provider_id → agent provider_id`. Skipping the legacy field here would
    // reroute those configs to the agent default on every IM message.
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [{
          id: 'channel-legacy',
          type: 'openclaw:wecom-openclaw-plugin',
          enabled: true,
          // Legacy root-level providerId — no overrides shape.
          providerId: SECONDARY_PROVIDER_ID,
          overrides: { model: SECONDARY_MODEL },
        }],
      }],
      providerApiKeys: {
        [PRIMARY_PROVIDER_ID]: 'sk-primary',
        [SECONDARY_PROVIDER_ID]: 'sk-secondary',
      },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    const env = resolveImProviderEnv(AGENT_WORKSPACE, 'channel-legacy');
    expect(env?.baseUrl).toBe(SECONDARY_BASE_URL);
    expect(env?.apiKey).toBe('sk-secondary');
  });

  it('Codex review-fix #2b: overrides.providerId still wins over legacy channel-root providerId', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [{
          id: 'channel-mixed',
          type: 'openclaw:wecom-openclaw-plugin',
          enabled: true,
          providerId: SECONDARY_PROVIDER_ID, // legacy root — should LOSE to overrides below
          overrides: { providerId: TERTIARY_PROVIDER_ID, model: TERTIARY_MODEL }, // post-bc06386 location — should WIN
        }],
      }],
      providerApiKeys: {
        [PRIMARY_PROVIDER_ID]: 'sk-primary',
        [SECONDARY_PROVIDER_ID]: 'sk-secondary',
        [TERTIARY_PROVIDER_ID]: 'sk-tertiary',
      },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    const env = resolveImProviderEnv(AGENT_WORKSPACE, 'channel-mixed');
    expect(env?.baseUrl).toBe(TERTIARY_BASE_URL);
  });

  it('normalizes Windows workspace identity across separators, case, and trailing slash', async () => {
    const winPath = 'C:\\Users\\Test\\workspace\\';
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: winPath,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: { [PRIMARY_PROVIDER_ID]: 'sk-primary' },
    });

    const { resolveImProviderEnv } = await import('../utils/admin-config');
    // Same Windows identity with forward slashes, different case, and no trailing slash should match.
    const fwdEnv = resolveImProviderEnv('c:/users/test/workspace', undefined);
    expect(fwdEnv?.baseUrl).toBe(PRIMARY_BASE_URL);
  });

  it('resolves a validated ProviderRoute for pure IM builtin sessions', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: { [PRIMARY_PROVIDER_ID]: 'sk-primary' },
    });

    const { resolveImProviderRouting } = await import('../utils/admin-config');
    const routing = resolveImProviderRouting(AGENT_WORKSPACE, undefined);

    expect(routing).toMatchObject({
      kind: 'provider-route',
      providerRoute: {
        kind: 'provider',
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
      },
    });
  });

  it('fails loud when providerId is known but Agent/Channel does not own a model', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: { [PRIMARY_PROVIDER_ID]: 'sk-primary' },
    });

    const { resolveImProviderRouting, resolveImProviderEnv } = await import('../utils/admin-config');
    const routing = resolveImProviderRouting(AGENT_WORKSPACE, undefined);

    expect(routing).toMatchObject({
      kind: 'error',
      status: 409,
      reason: 'provider-route-unresolved',
      providerId: PRIMARY_PROVIDER_ID,
      providerRoute: {
        kind: 'unknown-legacy',
        reason: 'missing-model',
      },
    });
    expect(resolveImProviderEnv(AGENT_WORKSPACE, undefined)).toBeUndefined();
  });

  it('fails loud when ProviderRoute validation rejects the provider/model pair', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: SECONDARY_MODEL,
        permissionMode: 'plan',
        channels: [],
      }],
      providerApiKeys: { [PRIMARY_PROVIDER_ID]: 'sk-primary' },
    });

    const { resolveImProviderRouting } = await import('../utils/admin-config');
    const routing = resolveImProviderRouting(AGENT_WORKSPACE, undefined);

    expect(routing).toMatchObject({
      kind: 'error',
      status: 409,
      reason: 'provider-route-unresolved',
      providerRoute: {
        kind: 'unknown-legacy',
        reason: 'provider-model-mismatch',
      },
    });
  });

  it('fails loud for a known provider route with no live API key', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: PRIMARY_PROVIDER_ID,
        model: PRIMARY_MODEL,
        permissionMode: 'plan',
        channels: [],
      }],
    });

    const { resolveImProviderRouting } = await import('../utils/admin-config');
    const routing = resolveImProviderRouting(AGENT_WORKSPACE, undefined);

    expect(routing).toMatchObject({
      kind: 'error',
      status: 409,
      reason: 'provider-env-unavailable',
      providerId: PRIMARY_PROVIDER_ID,
      model: PRIMARY_MODEL,
    });
  });

  it('reports managed Codex provider as external-runtime, not builtin ProviderRoute', async () => {
    writeConfig({
      agents: [{
        id: 'agent-1',
        name: 'Mino',
        enabled: true,
        workspacePath: AGENT_WORKSPACE,
        providerId: 'codex-sub',
        model: 'gpt-5.4',
        permissionMode: 'plan',
        channels: [],
      }],
    });

    const { resolveImProviderRouting } = await import('../utils/admin-config');
    const routing = resolveImProviderRouting(AGENT_WORKSPACE, undefined, {
      managedCodexProviderReady: true,
    });

    expect(routing).toMatchObject({
      kind: 'external-runtime',
      runtime: 'codex',
      runtimeSource: 'managed-provider',
      reason: 'managed-codex-provider',
      model: 'gpt-5.4',
    });
  });
});
