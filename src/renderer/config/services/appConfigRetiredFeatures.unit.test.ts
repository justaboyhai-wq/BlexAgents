import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../types';
import { removeRetiredRuntimeConfig, removeTelegramChannels } from './appConfigService';

describe('retired feature configuration migration', () => {
    it('removes external runtimes, managed Codex, CLI registry, and native Telegram', () => {
        const config = {
            multiAgentRuntime: true,
            cliToolRegistryEnabled: true,
            managedCodexProviderDevGate: true,
            managedCodexRuntimeInstall: { status: 'installed' },
            managedCodexAuth: { status: 'valid' },
            defaultProviderId: 'codex-sub',
            providerOrder: ['anthropic-sub', 'codex-sub'],
            disabledProviderIds: ['codex-sub'],
            agents: [{
                id: 'a',
                runtime: 'codex',
                runtimeConfig: { source: 'managed-provider', model: 'gpt-5' },
                providerId: 'codex-sub',
                channels: [{ id: 't', type: 'telegram' }, { id: 'f', type: 'feishu' }],
            }],
        } as unknown as AppConfig;

        removeRetiredRuntimeConfig(config);
        removeTelegramChannels(config);

        expect(config).not.toHaveProperty('multiAgentRuntime');
        expect(config).not.toHaveProperty('cliToolRegistryEnabled');
        expect(config).not.toHaveProperty('managedCodexRuntimeInstall');
        expect(config).not.toHaveProperty('managedCodexAuth');
        expect(config.defaultProviderId).toBeUndefined();
        expect(config.providerOrder).toEqual(['anthropic-sub']);
        expect(config.disabledProviderIds).toEqual([]);
        expect(config.agents?.[0]).toMatchObject({ runtime: 'builtin' });
        expect(config.agents?.[0]).not.toHaveProperty('runtimeConfig');
        expect(config.agents?.[0]).not.toHaveProperty('providerId');
        expect(config.agents?.[0].channels).toHaveLength(1);
        expect(config.agents?.[0].channels?.[0].type).toBe('feishu');
    });
});
