import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici';

import { AGENT_PLAN_PROVIDER_ID, deriveAgentPlanCapabilityStatus } from '../../shared/agent-plan-capabilities';
import {
  DEFAULT_SPEECH_SYNTHESIS_VOICE,
  normalizeSpeechSynthesisSpeed,
  normalizeSpeechSynthesisVolume,
} from '../../shared/speech-synthesis';
import { atomicModifyConfig, loadConfig, resolveProviderEnv } from '../utils/admin-config';
import { withAbortSignal } from '../utils/cancellation';
import { getProxyForProviderUrl } from '../proxy-state';

const TTS_URL = 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional';
const TTS_RESOURCE_ID = 'seed-tts-2.0';
const MAX_TEXT_LENGTH = 10_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;
const CACHE_KEY_RE = /^[a-f0-9]{64}$/;

export class AgentPlanTtsError extends Error {
  constructor(
    public readonly code: 'not-configured' | 'unauthorized' | 'rate-limited' | 'upstream' | 'invalid-response',
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AgentPlanTtsError';
  }
}

export interface AgentPlanTtsResult {
  cacheKey: string;
  filePath: string;
  mimeType: 'audio/mpeg';
  sizeBytes: number;
  cached: boolean;
  requestId?: string;
}

const inFlight = new Map<string, Promise<AgentPlanTtsResult>>();

function cacheDir(): string {
  return join(homedir(), '.blexagent', 'cache', 'agent-plan-tts');
}

export function resolveAgentPlanTtsCachePath(cacheKey: string): string | null {
  if (!CACHE_KEY_RE.test(cacheKey)) return null;
  return join(cacheDir(), `${cacheKey}.mp3`);
}

export function normalizeTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' 代码块已省略。 ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[|*_~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheKeyFor(text: string, speaker: string, speed: number, volume: number): string {
  return createHash('sha256')
    .update(JSON.stringify({ model: 'doubao-seed-tts-2.0', speedSemantics: 3, speaker, speed, volume, format: 'mp3', sampleRate: 24_000, text }))
    .digest('hex');
}

async function existingResult(cacheKey: string): Promise<AgentPlanTtsResult | null> {
  const filePath = resolveAgentPlanTtsCachePath(cacheKey);
  if (!filePath || !existsSync(filePath)) return null;
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile() || info.size <= 0 || info.size > MAX_AUDIO_BYTES) return null;
  return { cacheKey, filePath, mimeType: 'audio/mpeg', sizeBytes: info.size, cached: true };
}

async function writeChunk(stream: ReturnType<typeof createWriteStream>, chunk: Buffer): Promise<void> {
  if (stream.write(chunk)) return;
  await once(stream, 'drain');
}

/** Parse the documented line-delimited JSON response and stream audio to disk. */
export async function consumeAgentPlanTtsResponse(
  response: {
    body: {
      getReader(): {
        read(): Promise<{ value?: Uint8Array; done: boolean }>;
        cancel(): Promise<void>;
      };
    } | null;
  },
  destination: string,
): Promise<number> {
  if (!response.body) {
    throw new AgentPlanTtsError('invalid-response', 'Agent Plan TTS returned an empty body.', 502);
  }

  const stream = createWriteStream(destination, { flags: 'wx' });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let totalBytes = 0;
  let completed = false;

  const consumeLine = async (line: string): Promise<void> => {
    if (!line.trim()) return;
    let payload: { code?: number; data?: string; message?: string };
    try {
      payload = JSON.parse(line) as typeof payload;
    } catch {
      throw new AgentPlanTtsError('invalid-response', 'Agent Plan TTS returned malformed data.', 502);
    }
    if (payload.code === 20_000_000) {
      completed = true;
      return;
    }
    if (typeof payload.code === 'number' && payload.code > 0) {
      throw new AgentPlanTtsError('upstream', 'Agent Plan TTS rejected the synthesis request.', 502);
    }
    if (payload.code === 0 && payload.data) {
      const audio = Buffer.from(payload.data, 'base64');
      totalBytes += audio.length;
      if (totalBytes > MAX_AUDIO_BYTES) {
        throw new AgentPlanTtsError('invalid-response', 'Agent Plan TTS audio exceeded the size limit.', 502);
      }
      await writeChunk(stream, audio);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) await consumeLine(line);
      if (done) break;
    }
    if (pending.trim()) await consumeLine(pending);
    if (!completed || totalBytes === 0) {
      throw new AgentPlanTtsError('invalid-response', 'Agent Plan TTS response did not contain complete audio.', 502);
    }
    stream.end();
    await once(stream, 'close');
    return totalBytes;
  } catch (error) {
    reader.cancel().catch(() => undefined);
    stream.destroy();
    await once(stream, 'close').catch(() => undefined);
    throw error;
  }
}

async function synthesizeUncached(
  text: string,
  speaker: string,
  speed: number,
  volume: number,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<AgentPlanTtsResult> {
  const config = loadConfig();
  const capability = deriveAgentPlanCapabilityStatus({
    apiKey: config.providerApiKeys?.[AGENT_PLAN_PROVIDER_ID],
    verifyStatus: config.providerVerifyStatus?.[AGENT_PLAN_PROVIDER_ID],
  });
  const providerEnv = resolveProviderEnv(AGENT_PLAN_PROVIDER_ID, config);
  if (!capability.speech.ready || !providerEnv?.apiKey) {
    throw new AgentPlanTtsError('not-configured', 'Agent Plan speech is not verified.', 409);
  }

  await mkdir(cacheDir(), { recursive: true });
  const finalPath = resolveAgentPlanTtsCachePath(cacheKey)!;
  const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  const proxyUrl = getProxyForProviderUrl(AGENT_PLAN_PROVIDER_ID, TTS_URL);
  let dispatcher: ProxyAgent | undefined;

  try {
    const response = await withAbortSignal(signal, async combinedSignal => {
      const init: Parameters<typeof undiciFetch>[1] & { dispatcher?: Dispatcher } = {
        method: 'POST',
        signal: combinedSignal,
        headers: {
          'X-Api-Key': providerEnv.apiKey!,
          'X-Api-Resource-Id': TTS_RESOURCE_ID,
          'Content-Type': 'application/json',
          'X-Control-Require-Usage-Tokens-Return': '*',
        },
        body: JSON.stringify({
          req_params: {
            text,
            speaker,
            audio_params: {
              format: 'mp3',
              sample_rate: 24_000,
              speed_ratio: speed,
              loudness_ratio: volume,
            },
          },
        }),
      };
      if (proxyUrl) {
        dispatcher = new ProxyAgent(proxyUrl);
        init.dispatcher = dispatcher;
      }
      return undiciFetch(TTS_URL, init);
    }, { timeoutMs: REQUEST_TIMEOUT_MS });

    const requestId = response.headers.get('x-tt-logid') ?? undefined;
    if (response.status === 401 || response.status === 403) {
      throw new AgentPlanTtsError('unauthorized', 'Agent Plan credentials were rejected.', 401);
    }
    if (response.status === 429) {
      throw new AgentPlanTtsError('rate-limited', 'Agent Plan TTS is temporarily rate limited.', 429);
    }
    if (!response.ok) {
      throw new AgentPlanTtsError('upstream', `Agent Plan TTS failed with HTTP ${response.status}.`, 502);
    }

    const sizeBytes = await consumeAgentPlanTtsResponse(response, temporaryPath);
    await rename(temporaryPath, finalPath);
    return { cacheKey, filePath: finalPath, mimeType: 'audio/mpeg', sizeBytes, cached: false, requestId };
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    await dispatcher?.close().catch(() => undefined);
  }
}

export async function invalidateAgentPlanVerification(): Promise<void> {
  await atomicModifyConfig(config => ({
    ...config,
    providerVerifyStatus: {
      ...(config.providerVerifyStatus ?? {}),
      [AGENT_PLAN_PROVIDER_ID]: {
        status: 'invalid',
        verifiedAt: new Date().toISOString(),
        invalidReason: 'provider_verify_failed',
      },
    },
  }));
}

export async function synthesizeAgentPlanTts(input: {
  text: string;
  speaker?: string;
  speed?: number;
  volume?: number;
  signal?: AbortSignal;
}): Promise<AgentPlanTtsResult> {
  const text = normalizeTextForSpeech(input.text);
  if (!text) throw new AgentPlanTtsError('invalid-response', 'There is no readable text.', 400);
  if (text.length > MAX_TEXT_LENGTH) {
    throw new AgentPlanTtsError('invalid-response', `Text exceeds ${MAX_TEXT_LENGTH} characters.`, 400);
  }
  const speaker = input.speaker?.trim() || DEFAULT_SPEECH_SYNTHESIS_VOICE;
  const speed = normalizeSpeechSynthesisSpeed(input.speed);
  const volume = normalizeSpeechSynthesisVolume(input.volume);
  const cacheKey = cacheKeyFor(text, speaker, speed, volume);
  const cached = await existingResult(cacheKey);
  if (cached) return cached;

  const active = inFlight.get(cacheKey);
  if (active) return active;
  const promise = synthesizeUncached(text, speaker, speed, volume, cacheKey, input.signal)
    .finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, promise);
  return promise;
}
