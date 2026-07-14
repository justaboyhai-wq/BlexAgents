import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici';

import { AGENT_PLAN_PROVIDER_ID, deriveAgentPlanCapabilityStatus } from '../../shared/agent-plan-capabilities';
import { getProxyForProviderUrl } from '../proxy-state';
import { getCurrentTurnSignal } from '../utils/turn-abort';
import { loadConfig, resolveProviderEnv } from '../utils/admin-config';
import { withAbortSignal } from '../utils/cancellation';
import { invalidateAgentPlanVerification } from './tts';

const DEFAULT_MODEL = 'doubao-seedream-5.0-lite';
const REQUEST_TIMEOUT_MS = 5 * 60_000;
const MAX_PROMPT_LENGTH = 8_000;

export const AGENT_PLAN_IMAGE_SIZES = ['2K', '3K', '4K'] as const;
export type AgentPlanImageSize = typeof AGENT_PLAN_IMAGE_SIZES[number];

export class AgentPlanImageError extends Error {
  constructor(
    public readonly code: 'not-configured' | 'invalid-input' | 'unauthorized' | 'rate-limited' | 'upstream' | 'invalid-response',
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AgentPlanImageError';
  }
}

export interface AgentPlanGeneratedImage {
  url: string;
  size?: string;
}

export interface AgentPlanImageResult {
  model: string;
  images: AgentPlanGeneratedImage[];
  usage?: Record<string, unknown>;
}

function imageEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/images/generations`;
}

export function parseAgentPlanImageResponse(value: unknown): AgentPlanGeneratedImage[] {
  if (!value || typeof value !== 'object') return [];
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  const images: AgentPlanGeneratedImage[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.url !== 'string') continue;
    try {
      const parsed = new URL(record.url);
      if (parsed.protocol !== 'https:') continue;
      images.push({
        url: parsed.toString(),
        ...(typeof record.size === 'string' ? { size: record.size } : {}),
      });
    } catch {
      // Ignore malformed URLs. A response without any valid image is rejected below.
    }
  }
  return images;
}

export async function generateAgentPlanImage(input: {
  prompt: string;
  size?: AgentPlanImageSize;
  watermark?: boolean;
  signal?: AbortSignal;
}): Promise<AgentPlanImageResult> {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw new AgentPlanImageError('invalid-input', `Prompt must contain 1-${MAX_PROMPT_LENGTH} characters.`, 400);
  }

  const config = loadConfig();
  const capability = deriveAgentPlanCapabilityStatus({
    apiKey: config.providerApiKeys?.[AGENT_PLAN_PROVIDER_ID],
    verifyStatus: config.providerVerifyStatus?.[AGENT_PLAN_PROVIDER_ID],
  });
  const providerEnv = resolveProviderEnv(AGENT_PLAN_PROVIDER_ID, config);
  if (capability.state !== 'ready' || !providerEnv?.apiKey || !providerEnv.baseUrl) {
    throw new AgentPlanImageError('not-configured', 'Agent Plan is not verified.', 409);
  }

  const url = imageEndpoint(providerEnv.baseUrl);
  const proxyUrl = getProxyForProviderUrl(AGENT_PLAN_PROVIDER_ID, url);
  let dispatcher: ProxyAgent | undefined;

  try {
    const response = await withAbortSignal(input.signal ?? getCurrentTurnSignal(), async combinedSignal => {
      const init: Parameters<typeof undiciFetch>[1] & { dispatcher?: Dispatcher } = {
        method: 'POST',
        signal: combinedSignal,
        headers: {
          Authorization: `Bearer ${providerEnv.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          prompt,
          size: input.size ?? '2K',
          response_format: 'url',
          sequential_image_generation: 'disabled',
          watermark: input.watermark ?? false,
        }),
      };
      if (proxyUrl) {
        dispatcher = new ProxyAgent(proxyUrl);
        init.dispatcher = dispatcher;
      }
      return undiciFetch(url, init);
    }, { timeoutMs: REQUEST_TIMEOUT_MS });

    if (response.status === 401 || response.status === 403) {
      await invalidateAgentPlanVerification().catch(() => undefined);
      throw new AgentPlanImageError('unauthorized', 'Agent Plan credentials were rejected.', 401);
    }
    if (response.status === 429) {
      throw new AgentPlanImageError('rate-limited', 'Agent Plan image generation is temporarily rate limited.', 429);
    }
    if (!response.ok) {
      throw new AgentPlanImageError('upstream', `Agent Plan image generation failed with HTTP ${response.status}.`, 502);
    }

    const payload = await response.json() as Record<string, unknown>;
    const images = parseAgentPlanImageResponse(payload);
    if (images.length === 0) {
      throw new AgentPlanImageError('invalid-response', 'Agent Plan returned no downloadable image.', 502);
    }
    return {
      model: typeof payload.model === 'string' ? payload.model : DEFAULT_MODEL,
      images,
      ...(payload.usage && typeof payload.usage === 'object' ? { usage: payload.usage as Record<string, unknown> } : {}),
    };
  } finally {
    await dispatcher?.close().catch(() => undefined);
  }
}
