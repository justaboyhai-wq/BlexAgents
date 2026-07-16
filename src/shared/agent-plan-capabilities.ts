import type { ProviderVerifyStatus } from './config-types';
import { VERIFY_EXPIRY_DAYS } from './config-types';

export const AGENT_PLAN_PROVIDER_ID = 'volcengine-agent-plan' as const;

export type AgentPlanCapabilityState =
  | 'unconfigured'
  | 'unverified'
  | 'invalid'
  | 'expired'
  | 'ready';

export type AgentPlanCapabilityReason =
  | 'missing-api-key'
  | 'verification-required'
  | 'verification-failed'
  | 'verification-expired'
  | null;

export interface AgentPlanCapabilityStatus {
  providerId: typeof AGENT_PLAN_PROVIDER_ID;
  state: AgentPlanCapabilityState;
  reason: AgentPlanCapabilityReason;
  configured: boolean;
  verified: boolean;
  verifiedAt?: string;
  speech: {
    asr: boolean;
    tts: boolean;
    ready: boolean;
  };
}

export type AgentPlanSpeechControl =
  | { visibility: 'hidden'; enabled: false; reason: 'not-agent-plan' }
  | {
      visibility: 'visible';
      enabled: false;
      reason: Exclude<AgentPlanCapabilityReason, null> | 'checking' | 'service-unavailable';
    }
  | { visibility: 'visible'; enabled: true; reason: null };

const VERIFY_EXPIRY_MS = VERIFY_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

function verificationExpired(verifiedAt: string, nowMs: number): boolean {
  const verifiedMs = Date.parse(verifiedAt);
  if (!Number.isFinite(verifiedMs)) return true;
  return nowMs - verifiedMs > VERIFY_EXPIRY_MS;
}

/**
 * Derive Agent Plan feature readiness from persisted configuration without
 * exposing the credential itself. TTS and ASR deliberately share one readiness
 * bit: the product must never enable only one of the paired speech controls.
 */
export function deriveAgentPlanCapabilityStatus(input: {
  apiKey?: string | null;
  verifyStatus?: ProviderVerifyStatus | null;
  nowMs?: number;
}): AgentPlanCapabilityStatus {
  const configured = Boolean(input.apiKey?.trim());
  const base = {
    providerId: AGENT_PLAN_PROVIDER_ID,
    configured,
    verified: false,
    speech: { asr: false, tts: false, ready: false },
  } as const;

  if (!configured) {
    return { ...base, state: 'unconfigured', reason: 'missing-api-key' };
  }

  const verifyStatus = input.verifyStatus;
  if (!verifyStatus) {
    return { ...base, state: 'unverified', reason: 'verification-required' };
  }
  if (verifyStatus.status !== 'valid') {
    return {
      ...base,
      state: 'invalid',
      reason: 'verification-failed',
      verifiedAt: verifyStatus.verifiedAt,
    };
  }
  if (verificationExpired(verifyStatus.verifiedAt, input.nowMs ?? Date.now())) {
    return {
      ...base,
      state: 'expired',
      reason: 'verification-expired',
      verifiedAt: verifyStatus.verifiedAt,
    };
  }

  return {
    providerId: AGENT_PLAN_PROVIDER_ID,
    state: 'ready',
    reason: null,
    configured: true,
    verified: true,
    verifiedAt: verifyStatus.verifiedAt,
    speech: { asr: true, tts: true, ready: true },
  };
}

/** Resolve the shared visibility/enabled rule used by both mic and speaker. */
export function resolveAgentPlanSpeechControl(input: {
  currentProviderId?: string | null;
  status?: AgentPlanCapabilityStatus | null;
  checking?: boolean;
  unavailable?: boolean;
}): AgentPlanSpeechControl {
  if (input.currentProviderId !== AGENT_PLAN_PROVIDER_ID) {
    return { visibility: 'hidden', enabled: false, reason: 'not-agent-plan' };
  }
  if (input.checking || !input.status) {
    return {
      visibility: 'visible',
      enabled: false,
      reason: input.unavailable ? 'service-unavailable' : 'checking',
    };
  }
  if (!input.status.speech.ready) {
    return {
      visibility: 'visible',
      enabled: false,
      reason: input.status.reason ?? 'verification-required',
    };
  }
  return { visibility: 'visible', enabled: true, reason: null };
}
