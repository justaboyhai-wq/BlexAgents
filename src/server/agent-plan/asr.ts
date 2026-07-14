import { randomUUID } from 'node:crypto';

import { HttpsProxyAgent } from 'https-proxy-agent';
import WebSocket, { type RawData } from 'ws';

import { AGENT_PLAN_PROVIDER_ID, deriveAgentPlanCapabilityStatus } from '../../shared/agent-plan-capabilities';
import { loadConfig, resolveProviderEnv } from '../utils/admin-config';
import { getProxyForProviderUrl } from '../proxy-state';
import { invalidateAgentPlanVerification } from './tts';
import {
  decodeAgentPlanAsrServerMessage,
  defaultAgentPlanAsrRequest,
  encodeAgentPlanAsrAudio,
  encodeAgentPlanAsrFullRequest,
} from './asr-protocol';

const ASR_URL = 'wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_async';
const ASR_RESOURCE_ID = 'volc.seedasr.sauc.duration';
const CONNECT_TIMEOUT_MS = 15_000;
const FINAL_TIMEOUT_MS = 5_000;
const SESSION_IDLE_TIMEOUT_MS = 2 * 60_000;
const MAX_AUDIO_CHUNK_BYTES = 64 * 1024;

export class AgentPlanAsrError extends Error {
  constructor(
    public readonly code: 'not-configured' | 'unauthorized' | 'rate-limited' | 'invalid-audio' | 'upstream' | 'session-not-found',
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AgentPlanAsrError';
  }
}

export interface AgentPlanAsrUpdate {
  text: string;
  final: boolean;
}

export function extractAgentPlanAsrUpdate(payload: Record<string, unknown>, frameFinal: boolean): AgentPlanAsrUpdate | null {
  const result = payload.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text : '';
  if (!text) return null;
  const utterances = Array.isArray(record.utterances) ? record.utterances : [];
  const utteranceFinal = utterances.length > 0 && utterances.every(item =>
    item && typeof item === 'object' && (item as Record<string, unknown>).definite === true
  );
  return { text, final: frameFinal || utteranceFinal };
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return data;
}

class AsrSession {
  // The full request consumes sequence 1 on the upstream V3 protocol. Audio
  // frames must therefore start at 2; starting at 1 makes the service close
  // the stream with `autoAssignedSequence (2) mismatch ... (1)`.
  private sequence = 2;
  private text = '';
  private final = false;
  private closed = false;
  private terminalError: AgentPlanAsrError | null = null;
  private lastActivityAt = Date.now();
  private finalWaiters = new Set<() => void>();

  constructor(
    readonly id: string,
    private readonly socket: WebSocket,
  ) {
    socket.on('message', data => this.onMessage(data));
    socket.on('close', () => {
      this.closed = true;
      this.resolveFinalWaiters();
    });
  }

  get idleMs(): number {
    return Date.now() - this.lastActivityAt;
  }

  update(): AgentPlanAsrUpdate {
    return { text: this.text, final: this.final };
  }

  sendInitial(uid: string): void {
    this.socket.send(encodeAgentPlanAsrFullRequest(defaultAgentPlanAsrRequest(uid)));
  }

  sendAudio(audio: Uint8Array): AgentPlanAsrUpdate {
    if (this.terminalError) throw this.terminalError;
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      throw new AgentPlanAsrError('upstream', 'The Agent Plan ASR session is closed.', 502);
    }
    if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_CHUNK_BYTES) {
      throw new AgentPlanAsrError('invalid-audio', 'Invalid ASR audio chunk.', 400);
    }
    this.lastActivityAt = Date.now();
    this.socket.send(encodeAgentPlanAsrAudio(audio, this.sequence++));
    return this.update();
  }

  async finish(): Promise<AgentPlanAsrUpdate> {
    try {
      if (!this.closed && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(encodeAgentPlanAsrAudio(new Uint8Array(), this.sequence++, true));
        await new Promise<void>(resolve => {
          const timer = setTimeout(() => {
            this.finalWaiters.delete(done);
            resolve();
          }, FINAL_TIMEOUT_MS);
          timer.unref?.();
          const done = (): void => {
            clearTimeout(timer);
            resolve();
          };
          this.finalWaiters.add(done);
        });
      }
      if (this.terminalError) throw this.terminalError;
      return { text: this.text, final: true };
    } finally {
      this.close();
    }
  }

  close(): void {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close(1000, 'client complete');
    }
    this.closed = true;
    this.resolveFinalWaiters();
  }

  private onMessage(data: RawData): void {
    this.lastActivityAt = Date.now();
    try {
      const message = decodeAgentPlanAsrServerMessage(rawDataToBuffer(data));
      if (message.type === 'error') {
        // Preserve the upstream diagnostic in the local log. The UI receives
        // a generic error by design, but without this detail a 502 from the
        // chunk endpoint is impossible to distinguish from a dead microphone.
        console.error('[agent-plan/asr] Upstream error frame:', {
          code: message.code,
          message: message.message.slice(0, 500),
        });
        if (message.code === 401 || message.code === 403) {
          this.terminalError = new AgentPlanAsrError('unauthorized', 'Agent Plan credentials were rejected.', 401);
          void invalidateAgentPlanVerification().catch(() => undefined);
        } else if (message.code === 429) {
          this.terminalError = new AgentPlanAsrError('rate-limited', 'Agent Plan ASR is temporarily rate limited.', 429);
        } else {
          this.terminalError = new AgentPlanAsrError('upstream', 'Agent Plan ASR rejected the audio stream.', 502);
        }
        this.final = true;
        this.resolveFinalWaiters();
        return;
      }
      if (message.type !== 'result') return;
      const update = extractAgentPlanAsrUpdate(message.payload, message.final);
      if (!update) return;
      this.text = update.text;
      this.final = update.final;
      if (update.final) this.resolveFinalWaiters();
    } catch (error) {
      console.error('[agent-plan/asr] Invalid upstream frame:', error instanceof Error ? error.message : String(error));
    }
  }

  private resolveFinalWaiters(): void {
    for (const resolve of this.finalWaiters) resolve();
    this.finalWaiters.clear();
  }
}

const sessions = new Map<string, AsrSession>();
const gcTimer = setInterval(() => {
  for (const [id, session] of sessions) {
    if (session.idleMs <= SESSION_IDLE_TIMEOUT_MS) continue;
    session.close();
    sessions.delete(id);
  }
}, 30_000);
gcTimer.unref?.();

function sessionOrThrow(id: string): AsrSession {
  const session = sessions.get(id);
  if (!session) throw new AgentPlanAsrError('session-not-found', 'ASR session was not found.', 404);
  return session;
}

export async function startAgentPlanAsr(): Promise<{ sessionId: string; update: AgentPlanAsrUpdate }> {
  const config = loadConfig();
  const capability = deriveAgentPlanCapabilityStatus({
    apiKey: config.providerApiKeys?.[AGENT_PLAN_PROVIDER_ID],
    verifyStatus: config.providerVerifyStatus?.[AGENT_PLAN_PROVIDER_ID],
  });
  const providerEnv = resolveProviderEnv(AGENT_PLAN_PROVIDER_ID, config);
  if (!capability.speech.ready || !providerEnv?.apiKey) {
    throw new AgentPlanAsrError('not-configured', 'Agent Plan speech is not verified.', 409);
  }

  const sessionId = randomUUID();
  const requestId = randomUUID();
  const connectId = randomUUID();
  const proxyUrl = getProxyForProviderUrl(AGENT_PLAN_PROVIDER_ID, ASR_URL);
  const socket = new WebSocket(ASR_URL, {
    headers: {
      'X-Api-Key': providerEnv.apiKey,
      'X-Api-Resource-Id': ASR_RESOURCE_ID,
      'X-Api-Request-Id': requestId,
      'X-Api-Connect-Id': connectId,
      'X-Api-Sequence': '-1',
    },
    ...(proxyUrl ? { agent: new HttpsProxyAgent(proxyUrl) } : {}),
    handshakeTimeout: CONNECT_TIMEOUT_MS,
  });

  await new Promise<void>((resolve, reject) => {
    const onOpen = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new AgentPlanAsrError('upstream', 'Unable to connect to Agent Plan ASR.', 502));
    };
    const onUnexpectedResponse = (_request: unknown, response: { statusCode?: number }): void => {
      cleanup();
      const status = response.statusCode ?? 502;
      if (status === 401 || status === 403) {
        void invalidateAgentPlanVerification().catch(() => undefined);
        reject(new AgentPlanAsrError('unauthorized', 'Agent Plan credentials were rejected.', 401));
      } else if (status === 429) {
        reject(new AgentPlanAsrError('rate-limited', 'Agent Plan ASR is temporarily rate limited.', 429));
      } else {
        reject(new AgentPlanAsrError('upstream', `Agent Plan ASR failed with HTTP ${status}.`, 502));
      }
    };
    const cleanup = (): void => {
      socket.off('open', onOpen);
      socket.off('error', onError);
      socket.off('unexpected-response', onUnexpectedResponse);
    };
    socket.once('open', onOpen);
    socket.once('error', onError);
    socket.once('unexpected-response', onUnexpectedResponse);
  });

  const session = new AsrSession(sessionId, socket);
  session.sendInitial(`blexagent-${sessionId}`);
  sessions.set(sessionId, session);
  return { sessionId, update: session.update() };
}

export function pushAgentPlanAsrAudio(sessionId: string, audio: Uint8Array): AgentPlanAsrUpdate {
  return sessionOrThrow(sessionId).sendAudio(audio);
}

export async function finishAgentPlanAsr(sessionId: string): Promise<AgentPlanAsrUpdate> {
  const session = sessionOrThrow(sessionId);
  try {
    return await session.finish();
  } finally {
    sessions.delete(sessionId);
  }
}

export function cancelAgentPlanAsr(sessionId: string): void {
  const session = sessions.get(sessionId);
  session?.close();
  sessions.delete(sessionId);
}
