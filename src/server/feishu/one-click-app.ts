import { registerApp, type AppAddons } from '@larksuiteoapi/node-sdk';
import { randomUUID } from 'node:crypto';

export type FeishuAppCreationQr = {
  url: string;
  expiresIn: number;
};

export type FeishuCreatedApp = {
  appId: string;
  appSecret: string;
  userOpenId?: string;
  tenantBrand?: 'feishu' | 'lark';
};

export const BLEXAGENT_FEISHU_ADDONS: AppAddons = {
  scopes: { tenant: ['im:message:send_as_bot'] },
  events: { items: { tenant: ['im.message.receive_v1'] } },
  callbacks: { items: ['card.action.trigger'] },
};

/**
 * Start the official Feishu device-authorisation flow.  The caller receives
 * the short-lived QR URL immediately; the returned completion promise only
 * resolves after the scanning user confirms application creation.
 */
export function startFeishuOneClickAppCreation(options: {
  onQrReady: (qr: FeishuAppCreationQr) => void;
  signal?: AbortSignal;
}): Promise<FeishuCreatedApp> {
  return registerApp({
    source: 'blexagent',
    createOnly: true,
    signal: options.signal,
    appPreset: {
      name: 'BlexAgent',
      desc: 'BlexAgent 飞书智能体',
    },
    addons: BLEXAGENT_FEISHU_ADDONS,
    onQRCodeReady: ({ url, expireIn }) => options.onQrReady({ url, expiresIn: expireIn }),
  }).then(result => ({
    appId: result.client_id,
    appSecret: result.client_secret,
    userOpenId: result.user_info?.open_id,
    tenantBrand: result.user_info?.tenant_brand,
  }));
}

type CreationSession = {
  qr?: FeishuAppCreationQr;
  result?: FeishuCreatedApp;
  error?: string;
  controller: AbortController;
  expiresAt: number;
};

const sessions = new Map<string, CreationSession>();
const SESSION_TTL_MS = 65 * 60_000;

function pruneSessions(now = Date.now()): void {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) {
      session.controller.abort();
      sessions.delete(id);
    }
  }
}

export async function beginFeishuOneClickAppCreation(): Promise<{ sessionId: string; qr: FeishuAppCreationQr }> {
  pruneSessions();
  const sessionId = randomUUID();
  const controller = new AbortController();
  const session: CreationSession = { controller, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(sessionId, session);

  let resolveQr!: (value: FeishuAppCreationQr) => void;
  let rejectQr!: (reason: Error) => void;
  const qrReady = new Promise<FeishuAppCreationQr>((resolve, reject) => { resolveQr = resolve; rejectQr = reject; });
  void startFeishuOneClickAppCreation({
    signal: controller.signal,
    onQrReady: qr => { session.qr = qr; resolveQr(qr); },
  }).then(result => { session.result = result; }, error => {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code !== 'abort') session.error = 'Feishu app creation did not complete.';
    rejectQr(error instanceof Error ? error : new Error(session.error));
  });
  return { sessionId, qr: await qrReady };
}

export function getFeishuOneClickAppCreation(sessionId: string):
  | { status: 'pending' }
  | { status: 'completed'; app: FeishuCreatedApp }
  | { status: 'failed'; error: string }
  | { status: 'missing' } {
  pruneSessions();
  const session = sessions.get(sessionId);
  if (!session) return { status: 'missing' };
  if (session.result) {
    sessions.delete(sessionId);
    return { status: 'completed', app: session.result };
  }
  if (session.error) return { status: 'failed', error: session.error };
  return { status: 'pending' };
}

export function cancelFeishuOneClickAppCreation(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.controller.abort();
  sessions.delete(sessionId);
}
