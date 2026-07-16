import { describe, expect, it } from 'vitest';

import {
  AGENT_PLAN_PROVIDER_ID,
  deriveAgentPlanCapabilityStatus,
  resolveAgentPlanSpeechControl,
} from './agent-plan-capabilities';

const NOW = Date.parse('2026-07-14T00:00:00.000Z');

describe('Agent Plan capability status', () => {
  it('keeps ASR and TTS disabled until the provider is configured and verified', () => {
    expect(deriveAgentPlanCapabilityStatus({ nowMs: NOW })).toMatchObject({
      state: 'unconfigured',
      configured: false,
      speech: { asr: false, tts: false, ready: false },
    });

    expect(deriveAgentPlanCapabilityStatus({ apiKey: 'agent-plan-key', nowMs: NOW })).toMatchObject({
      state: 'unverified',
      configured: true,
      speech: { asr: false, tts: false, ready: false },
    });
  });

  it('enables ASR and TTS together after a current successful verification', () => {
    const status = deriveAgentPlanCapabilityStatus({
      apiKey: 'agent-plan-key',
      verifyStatus: { status: 'valid', verifiedAt: '2026-07-13T00:00:00.000Z' },
      nowMs: NOW,
    });

    expect(status).toMatchObject({
      state: 'ready',
      verified: true,
      speech: { asr: true, tts: true, ready: true },
    });
  });

  it('rejects invalid and expired verification without partially enabling speech', () => {
    const invalid = deriveAgentPlanCapabilityStatus({
      apiKey: 'agent-plan-key',
      verifyStatus: { status: 'invalid', verifiedAt: '2026-07-13T00:00:00.000Z' },
      nowMs: NOW,
    });
    const expired = deriveAgentPlanCapabilityStatus({
      apiKey: 'agent-plan-key',
      verifyStatus: { status: 'valid', verifiedAt: '2026-05-01T00:00:00.000Z' },
      nowMs: NOW,
    });

    expect(invalid).toMatchObject({ state: 'invalid', speech: { asr: false, tts: false } });
    expect(expired).toMatchObject({ state: 'expired', speech: { asr: false, tts: false } });
  });

  it('hides controls outside Agent Plan and uses the same enabled bit for both controls', () => {
    const ready = deriveAgentPlanCapabilityStatus({
      apiKey: 'agent-plan-key',
      verifyStatus: { status: 'valid', verifiedAt: '2026-07-13T00:00:00.000Z' },
      nowMs: NOW,
    });

    expect(resolveAgentPlanSpeechControl({ currentProviderId: 'anthropic', status: ready }))
      .toEqual({ visibility: 'hidden', enabled: false, reason: 'not-agent-plan' });
    expect(resolveAgentPlanSpeechControl({ currentProviderId: AGENT_PLAN_PROVIDER_ID, status: ready }))
      .toEqual({ visibility: 'visible', enabled: true, reason: null });
  });

  it.each([
    ['unconfigured', deriveAgentPlanCapabilityStatus({ nowMs: NOW })],
    ['unverified', deriveAgentPlanCapabilityStatus({ apiKey: 'agent-plan-key', nowMs: NOW })],
    ['invalid', deriveAgentPlanCapabilityStatus({
      apiKey: 'agent-plan-key',
      verifyStatus: { status: 'invalid', verifiedAt: '2026-07-13T00:00:00.000Z' },
      nowMs: NOW,
    })],
    ['expired', deriveAgentPlanCapabilityStatus({
      apiKey: 'agent-plan-key',
      verifyStatus: { status: 'valid', verifiedAt: '2026-05-01T00:00:00.000Z' },
      nowMs: NOW,
    })],
  ])('keeps both speech controls disabled for %s', (_state, status) => {
    expect(resolveAgentPlanSpeechControl({ currentProviderId: AGENT_PLAN_PROVIDER_ID, status }))
      .toMatchObject({ visibility: 'visible', enabled: false });
    expect(status.speech.asr).toBe(false);
    expect(status.speech.tts).toBe(false);
  });

  it('does not briefly enable controls while capability verification is pending', () => {
    expect(resolveAgentPlanSpeechControl({
      currentProviderId: AGENT_PLAN_PROVIDER_ID,
      checking: true,
    })).toEqual({ visibility: 'visible', enabled: false, reason: 'checking' });
    expect(resolveAgentPlanSpeechControl({
      currentProviderId: AGENT_PLAN_PROVIDER_ID,
      checking: true,
      unavailable: true,
    })).toEqual({ visibility: 'visible', enabled: false, reason: 'service-unavailable' });
  });
});
