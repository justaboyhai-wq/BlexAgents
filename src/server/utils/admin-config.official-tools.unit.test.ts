import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { IMAGE_UNDERSTANDING_TOOL_ID, type OfficialToolId } from '../../shared/official-tools';
import {
  getEffectiveOfficialToolIdsForSession,
  isImageUnderstandingToolCallable,
  resolveImageUnderstandingToolAvailability,
  type AdminAppConfig,
} from './admin-config';

const ENABLED_OFFICIAL_TOOLS: OfficialToolId[] = [IMAGE_UNDERSTANDING_TOOL_ID];
const VISION_API_PROVIDER_ID = 'fixture-vision-api';
const TEXT_API_PROVIDER_ID = 'fixture-text-api';
const VISION_SUBSCRIPTION_PROVIDER_ID = 'fixture-vision-subscription';
let tmpHome: string;
let prevHome: string | undefined;
let prevUserProfile: string | undefined;

beforeEach(() => {
  prevHome = process.env.HOME;
  prevUserProfile = process.env.USERPROFILE;
  tmpHome = mkdtempSync(join(tmpdir(), 'blexagent-official-tools-'));
  const providersDir = join(tmpHome, '.blexagent', 'providers');
  mkdirSync(providersDir, { recursive: true });
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;

  const providers = [
    {
      id: VISION_API_PROVIDER_ID,
      name: 'Fixture Vision API',
      type: 'api',
      authType: 'api_key',
      config: { baseUrl: 'https://vision.invalid/v1' },
      models: [{ model: 'fixture-vision-model', inputModalities: ['text', 'image'] }],
    },
    {
      id: TEXT_API_PROVIDER_ID,
      name: 'Fixture Text API',
      type: 'api',
      authType: 'api_key',
      config: { baseUrl: 'https://text.invalid/v1' },
      models: [{ model: 'fixture-text-model', inputModalities: ['text'] }],
    },
    {
      id: VISION_SUBSCRIPTION_PROVIDER_ID,
      name: 'Fixture Vision Subscription',
      type: 'subscription',
      models: [{ model: 'fixture-subscription-vision-model', inputModalities: ['text', 'image'] }],
    },
  ];
  for (const provider of providers) {
    writeFileSync(join(providersDir, `${provider.id}.json`), JSON.stringify(provider));
  }
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  rmSync(tmpHome, { recursive: true, force: true });
});

function apiVisionConfig(overrides: Partial<AdminAppConfig> = {}): AdminAppConfig {
  return {
    enabledOfficialToolIds: ENABLED_OFFICIAL_TOOLS,
    officialToolSettings: {
      imageUnderstanding: {
        providerId: VISION_API_PROVIDER_ID,
        model: 'fixture-vision-model',
      },
    },
    providerApiKeys: { [VISION_API_PROVIDER_ID]: 'fixture-key' },
    ...overrides,
  };
}

describe('official image understanding availability', () => {
  it('keeps effective official tools only when the configured image model is callable', () => {
    const config = apiVisionConfig();

    expect(resolveImageUnderstandingToolAvailability(config)).toMatchObject({
      ok: true,
      providerId: VISION_API_PROVIDER_ID,
      model: 'fixture-vision-model',
    });
    expect(isImageUnderstandingToolCallable(config)).toBe(true);
    expect(getEffectiveOfficialToolIdsForSession(
      '/workspace',
      null,
      ENABLED_OFFICIAL_TOOLS,
      config,
    )).toEqual(ENABLED_OFFICIAL_TOOLS);
  });

  it('filters image understanding out when an API-backed provider has no key', () => {
    const config = apiVisionConfig({ providerApiKeys: {} });

    expect(resolveImageUnderstandingToolAvailability(config)).toMatchObject({
      ok: false,
      reason: 'missing-credential',
    });
    expect(getEffectiveOfficialToolIdsForSession(
      '/workspace',
      null,
      ENABLED_OFFICIAL_TOOLS,
      config,
    )).toEqual([]);
  });

  it('filters image understanding out when the selected model is text-only', () => {
    const config = apiVisionConfig({
      officialToolSettings: {
        imageUnderstanding: {
          providerId: TEXT_API_PROVIDER_ID,
          model: 'fixture-text-model',
        },
      },
      providerApiKeys: { [TEXT_API_PROVIDER_ID]: 'fixture-key' },
    });

    expect(resolveImageUnderstandingToolAvailability(config)).toMatchObject({
      ok: false,
      reason: 'model-not-image-capable',
    });
    expect(getEffectiveOfficialToolIdsForSession(
      '/workspace',
      null,
      ENABLED_OFFICIAL_TOOLS,
      config,
    )).toEqual([]);
  });

  it('filters image understanding out when the provider is globally disabled', () => {
    const config = apiVisionConfig({ disabledProviderIds: [VISION_API_PROVIDER_ID] });

    expect(resolveImageUnderstandingToolAvailability(config)).toMatchObject({
      ok: false,
      reason: 'provider-unavailable',
    });
    expect(getEffectiveOfficialToolIdsForSession(
      '/workspace',
      null,
      ENABLED_OFFICIAL_TOOLS,
      config,
    )).toEqual([]);
  });

  it('requires subscription providers to be verified before injection', () => {
    const unverifiedConfig = apiVisionConfig({
      officialToolSettings: {
        imageUnderstanding: {
          providerId: VISION_SUBSCRIPTION_PROVIDER_ID,
          model: 'fixture-subscription-vision-model',
        },
      },
      providerApiKeys: {},
      providerVerifyStatus: {},
    });

    expect(resolveImageUnderstandingToolAvailability(unverifiedConfig)).toMatchObject({
      ok: false,
      reason: 'subscription-not-verified',
    });
    expect(getEffectiveOfficialToolIdsForSession(
      '/workspace',
      null,
      ENABLED_OFFICIAL_TOOLS,
      unverifiedConfig,
    )).toEqual([]);

    const verifiedConfig = apiVisionConfig({
      officialToolSettings: unverifiedConfig.officialToolSettings,
      providerApiKeys: {},
      providerVerifyStatus: {
        [VISION_SUBSCRIPTION_PROVIDER_ID]: {
          status: 'valid',
          verifiedAt: '2026-06-28T00:00:00.000Z',
        },
      },
    });

    expect(resolveImageUnderstandingToolAvailability(verifiedConfig)).toMatchObject({
      ok: true,
      providerId: VISION_SUBSCRIPTION_PROVIDER_ID,
      model: 'fixture-subscription-vision-model',
    });
    expect(getEffectiveOfficialToolIdsForSession(
      '/workspace',
      null,
      ENABLED_OFFICIAL_TOOLS,
      verifiedConfig,
    )).toEqual(ENABLED_OFFICIAL_TOOLS);
  });
});
