import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici';

import { AGENT_PLAN_PROVIDER_ID, deriveAgentPlanCapabilityStatus } from '../../shared/agent-plan-capabilities';
import { getProxyForProviderUrl } from '../proxy-state';
import { loadConfig, resolveProviderEnv } from '../utils/admin-config';
import { withAbortSignal } from '../utils/cancellation';
import { withFileLock } from '../utils/file-lock';
import { getCurrentTurnSignal } from '../utils/turn-abort';
import { invalidateAgentPlanVerification } from './tts';

const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_WAIT_TIMEOUT_MS = 15 * 60_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_PROMPT_LENGTH = 8_000;
const TASK_ID_RE = /^cgt-[a-zA-Z0-9_-]{6,200}$/;

export const AGENT_PLAN_VIDEO_MODELS = [
  'doubao-seedance-2.0',
  'doubao-seedance-2.0-fast',
  'doubao-seedance-2.0-mini',
] as const;
export type AgentPlanVideoModel = typeof AGENT_PLAN_VIDEO_MODELS[number];
export type AgentPlanVideoStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentPlanVideoTask {
  id: string;
  model: string;
  status: AgentPlanVideoStatus;
  createdAt: string;
  updatedAt: string;
  prompt?: string;
  videoUrl?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  errorCode?: string;
}

export class AgentPlanVideoError extends Error {
  constructor(
    public readonly code: 'not-configured' | 'invalid-input' | 'unauthorized' | 'rate-limited' | 'upstream' | 'invalid-response' | 'timeout',
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AgentPlanVideoError';
  }
}

function storePath(): string {
  return join(homedir(), '.blexagent', 'agent-plan-video-tasks.json');
}

async function readTaskStore(): Promise<Record<string, AgentPlanVideoTask>> {
  try {
    const value = JSON.parse(await readFile(storePath(), 'utf8')) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, AgentPlanVideoTask>
      : {};
  } catch {
    return {};
  }
}

async function persistTask(task: AgentPlanVideoTask): Promise<void> {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  await withFileLock({ lockPath: `${path}.lock` }, async () => {
    const tasks = await readTaskStore();
    tasks[task.id] = task;
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(tasks, null, 2), { flag: 'wx' });
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  });
}

function normalizeTask(value: unknown, fallback?: Partial<AgentPlanVideoTask>): AgentPlanVideoTask | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : fallback?.id;
  const status = typeof record.status === 'string' ? record.status : fallback?.status;
  if (!id || !TASK_ID_RE.test(id) || !['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(String(status))) return null;
  const content = record.content && typeof record.content === 'object' ? record.content as Record<string, unknown> : {};
  const rawVideoUrl = typeof content.video_url === 'string' ? content.video_url : undefined;
  let videoUrl: string | undefined;
  if (rawVideoUrl) {
    try {
      const parsed = new URL(rawVideoUrl);
      if (parsed.protocol === 'https:') videoUrl = parsed.toString();
    } catch { /* rejected below when succeeded */ }
  }
  const error = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : {};
  const now = new Date().toISOString();
  return {
    id,
    model: typeof record.model === 'string' ? record.model : fallback?.model ?? AGENT_PLAN_VIDEO_MODELS[0],
    status: status as AgentPlanVideoStatus,
    createdAt: fallback?.createdAt ?? (typeof record.created_at === 'string' ? record.created_at : now),
    updatedAt: now,
    ...(fallback?.prompt ? { prompt: fallback.prompt } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    ...(typeof record.resolution === 'string' ? { resolution: record.resolution } : {}),
    ...(typeof record.ratio === 'string' ? { ratio: record.ratio } : {}),
    ...(typeof record.duration === 'number' ? { duration: record.duration } : {}),
    ...(typeof error.code === 'string' ? { errorCode: error.code } : {}),
  };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function access() {
  const config = loadConfig();
  const capability = deriveAgentPlanCapabilityStatus({
    apiKey: config.providerApiKeys?.[AGENT_PLAN_PROVIDER_ID],
    verifyStatus: config.providerVerifyStatus?.[AGENT_PLAN_PROVIDER_ID],
  });
  const providerEnv = resolveProviderEnv(AGENT_PLAN_PROVIDER_ID, config);
  if (capability.state !== 'ready' || !providerEnv?.apiKey || !providerEnv.baseUrl) {
    throw new AgentPlanVideoError('not-configured', 'Agent Plan is not verified.', 409);
  }
  return { apiKey: providerEnv.apiKey, baseUrl: providerEnv.baseUrl.replace(/\/+$/, '') };
}

async function requestJson(url: string, init: Parameters<typeof undiciFetch>[1], signal?: AbortSignal): Promise<Record<string, unknown>> {
  const { apiKey } = access();
  const proxyUrl = getProxyForProviderUrl(AGENT_PLAN_PROVIDER_ID, url);
  let dispatcher: ProxyAgent | undefined;
  try {
    const response = await withAbortSignal(signal ?? getCurrentTurnSignal(), async combinedSignal => {
      const request: Parameters<typeof undiciFetch>[1] & { dispatcher?: Dispatcher } = {
        ...init,
        signal: combinedSignal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      };
      if (proxyUrl) {
        dispatcher = new ProxyAgent(proxyUrl);
        request.dispatcher = dispatcher;
      }
      return undiciFetch(url, request);
    }, { timeoutMs: REQUEST_TIMEOUT_MS });

    if (response.status === 401 || response.status === 403) {
      await invalidateAgentPlanVerification().catch(() => undefined);
      throw new AgentPlanVideoError('unauthorized', 'Agent Plan credentials were rejected.', 401);
    }
    if (response.status === 429) throw new AgentPlanVideoError('rate-limited', 'Agent Plan video generation is rate limited.', 429);
    if (!response.ok) throw new AgentPlanVideoError('upstream', `Agent Plan video request failed with HTTP ${response.status}.`, 502);
    const payload = await response.json();
    if (!payload || typeof payload !== 'object') throw new AgentPlanVideoError('invalid-response', 'Agent Plan returned malformed video data.', 502);
    return payload as Record<string, unknown>;
  } finally {
    await dispatcher?.close().catch(() => undefined);
  }
}

export async function createAgentPlanVideoTask(input: {
  prompt: string;
  model?: AgentPlanVideoModel;
  referenceImageUrls?: string[];
  ratio?: 'adaptive' | '16:9' | '9:16' | '1:1';
  duration?: 5 | 10;
  resolution?: '720p' | '1080p';
  generateAudio?: boolean;
  signal?: AbortSignal;
}): Promise<AgentPlanVideoTask> {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) throw new AgentPlanVideoError('invalid-input', 'Video prompt is empty or too long.', 400);
  const { baseUrl } = access();
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
  for (const rawUrl of input.referenceImageUrls ?? []) {
    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch { throw new AgentPlanVideoError('invalid-input', 'Reference image URL is invalid.', 400); }
    if (parsed.protocol !== 'https:') throw new AgentPlanVideoError('invalid-input', 'Reference images must use HTTPS.', 400);
    content.push({ type: 'image_url', image_url: { url: parsed.toString() } });
  }
  const model = input.model ?? AGENT_PLAN_VIDEO_MODELS[0];
  const payload = await requestJson(`${baseUrl}/contents/generations/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      model,
      content,
      ratio: input.ratio ?? 'adaptive',
      duration: input.duration ?? 5,
      resolution: input.resolution ?? '720p',
      generate_audio: input.generateAudio ?? true,
    }),
  }, input.signal);
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!TASK_ID_RE.test(id)) throw new AgentPlanVideoError('invalid-response', 'Agent Plan did not return a valid video task ID.', 502);
  const now = new Date().toISOString();
  const task: AgentPlanVideoTask = { id, model, status: 'queued', createdAt: now, updatedAt: now, prompt: prompt.slice(0, 1_000) };
  await persistTask(task);
  return task;
}

export async function getAgentPlanVideoTask(id: string, signal?: AbortSignal): Promise<AgentPlanVideoTask> {
  if (!TASK_ID_RE.test(id)) throw new AgentPlanVideoError('invalid-input', 'Invalid video task ID.', 400);
  const { baseUrl } = access();
  const stored = (await readTaskStore())[id];
  const payload = await requestJson(`${baseUrl}/contents/generations/tasks/${encodeURIComponent(id)}`, { method: 'GET' }, signal);
  const task = normalizeTask(payload, stored ?? { id, status: 'queued' });
  if (!task || (task.status === 'succeeded' && !task.videoUrl)) {
    throw new AgentPlanVideoError('invalid-response', 'Agent Plan returned an incomplete video task.', 502);
  }
  await persistTask(task);
  return task;
}

export async function waitForAgentPlanVideoTask(id: string, input?: { signal?: AbortSignal; timeoutMs?: number }): Promise<AgentPlanVideoTask> {
  const started = Date.now();
  const timeoutMs = input?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  while (Date.now() - started < timeoutMs) {
    const task = await getAgentPlanVideoTask(id, input?.signal);
    if (['succeeded', 'failed', 'cancelled'].includes(task.status)) return task;
    await delay(POLL_INTERVAL_MS, input?.signal);
  }
  throw new AgentPlanVideoError('timeout', 'Video generation is still running.', 202);
}
