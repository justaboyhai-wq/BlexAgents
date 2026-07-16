import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ProviderVerifyStatus } from '@/config/types';
import {
  AGENT_PLAN_PROVIDER_ID,
  resolveAgentPlanSpeechControl,
  type AgentPlanCapabilityStatus,
} from '../../shared/agent-plan-capabilities';

type ApiGet = <T>(path: string, opts?: { signal?: AbortSignal }) => Promise<T>;

export function useAgentPlanSpeechCapabilities(input: {
  currentProviderId?: string | null;
  apiKey?: string;
  verifyStatus?: ProviderVerifyStatus;
  apiGet: ApiGet;
}) {
  const { currentProviderId, apiKey, verifyStatus, apiGet } = input;
  const [result, setResult] = useState<{
    apiKey?: string;
    verifyStatus?: string;
    verifiedAt?: string;
    revision: number;
    status: AgentPlanCapabilityStatus | null;
    unavailable: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const retryAttemptRef = useRef(0);

  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (currentProviderId !== AGENT_PLAN_PROVIDER_ID) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const requestApiKey = apiKey;
    const requestVerifyStatus = verifyStatus?.status;
    const verifiedAt = verifyStatus?.verifiedAt;
    const requestRevision = revision;
    apiGet<{ success: boolean } & AgentPlanCapabilityStatus>(
      '/api/agent-plan/capabilities',
      { signal: controller.signal },
    ).then(response => {
      if (!controller.signal.aborted) {
        retryAttemptRef.current = 0;
        setResult({
          apiKey: requestApiKey, verifyStatus: requestVerifyStatus, verifiedAt, revision: requestRevision, status: response, unavailable: false,
        });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setResult({
          apiKey: requestApiKey, verifyStatus: requestVerifyStatus, verifiedAt, revision: requestRevision, status: null, unavailable: true,
        });
        // Session sidecars are intentionally replaced during resume/config
        // changes. A capability probe can race that handoff; recover without
        // requiring the user to edit credentials or reload the whole app.
        const attempt = retryAttemptRef.current++;
        const delayMs = Math.min(1_000 * (2 ** attempt), 15_000);
        retryTimer = setTimeout(() => setRevision(value => value + 1), delayMs);
      }
    });
    return () => {
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    apiGet,
    apiKey,
    currentProviderId,
    verifyStatus?.status,
    verifyStatus?.verifiedAt,
    revision,
  ]);

  const resultIsCurrent = result?.apiKey === apiKey
    && result?.verifyStatus === verifyStatus?.status
    && result?.verifiedAt === verifyStatus?.verifiedAt
    && result?.revision === revision;
  const status = resultIsCurrent ? result.status : null;
  const unavailable = resultIsCurrent ? result.unavailable : false;
  const checking = currentProviderId === AGENT_PLAN_PROVIDER_ID && !resultIsCurrent;

  const control = useMemo(() => resolveAgentPlanSpeechControl({
    currentProviderId,
    status,
    checking,
    unavailable,
  }), [checking, currentProviderId, status, unavailable]);

  return { status, control, refresh };
}
