// HermesRuntime — drives Hermes Agent (Nous Research) in ACP mode
//
// Communication: JSON-RPC 2.0 over stdio (hermes acp --accept-hooks)
// Process lifecycle: persistent across turns, single process per session (like Gemini)
// Protocol: Agent Client Protocol (ACP) — same wire format as Gemini CLI
// System prompt: written to a tmp file, injected via HERMES_SYSTEM_MD env var
// Session: session/new (fresh) / session/load (resume by sessionId)
// Reference: https://github.com/NousResearch/hermes-agent
// Integration pattern: https://github.com/nexu-io/open-design (hermes agent adapter)

import { spawn, type Subprocess, type SubprocessStdin } from '../utils/subprocess';
import { writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import type {
  RuntimeDetection,
  RuntimeModelInfo,
  RuntimePermissionMode,
  RuntimeType,
} from '../../shared/types/runtime';
import { HERMES_PERMISSION_MODES } from '../../shared/types/runtime';
import type {
  AgentRuntime,
  RuntimeConfigCapabilities,
  RuntimeProcess,
  SessionStartOptions,
  UnifiedEvent,
  UnifiedEventCallback,
  ResolvedImagePayload,
} from './types';
import { StaleRuntimeSessionError } from './types';
import { augmentedProcessEnv, resolveCommand, stripAnsi } from './env-utils';
import { ensureDirSync } from '../utils/fs-utils';
import { killWithEscalation } from './utils/kill-with-escalation';
import { withLogContext } from '../logger-context';

// ─── Tmp directory layout for system prompt files ───

const TMP_ROOT = join(
  process.env.HOME || process.env.USERPROFILE || '/tmp',
  '.blexagent', 'tmp', 'hermes-prompts',
);

/** Per-session system prompt path. */
function sessionSystemPromptPath(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, '_') || 'unknown';
  return join(TMP_ROOT, `session-${safe}.md`);
}

/**
 * Ensure TMP_ROOT exists and delete session prompt files older than 1 hour.
 * Same age-based GC pattern as Gemini — see gemini.ts:cleanupStaleSessionPrompts
 * for rationale on why we don't unlink on process exit.
 */
function cleanupStaleSessionPrompts(): void {
  try {
    if (!existsSync(TMP_ROOT)) {
      ensureDirSync(TMP_ROOT);
      return;
    }
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const file of readdirSync(TMP_ROOT)) {
      if (!file.startsWith('session-')) continue;
      const path = join(TMP_ROOT, file);
      try {
        if (statSync(path).mtimeMs < cutoff) unlinkSync(path);
      } catch {
        /* ignore individual file errors */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Write the per-session system prompt file for Hermes.
 *
 * Hermes reads the system prompt from HERMES_SYSTEM_MD env var at spawn time
 * (same pattern as Gemini's GEMINI_SYSTEM_MD). If no BlexAgent prompt is
 * supplied, returns null and lets Hermes use its built-in default.
 */
function writeSessionSystemPrompt(
  sessionId: string,
  blexAgentPrompt: string | undefined,
): string | null {
  if (!blexAgentPrompt || blexAgentPrompt.trim().length === 0) return null;

  ensureDirSync(TMP_ROOT);
  const path = sessionSystemPromptPath(sessionId);
  const timestamp = new Date().toISOString();

  let content = `<!-- BlexAgent Hermes runtime session prompt, generated at ${timestamp} -->\n`;
  content += `<!-- Session: ${sessionId} -->\n\n`;
  content += blexAgentPrompt.trim() + '\n';

  writeFileSync(path, content, 'utf8');
  return path;
}

/**
 * Build ACP prompt ContentBlock array with optional images.
 * ACP accepts `{ type: 'image', mimeType, data }` with base64 data natively.
 */
function buildHermesPrompt(text: string, images?: ResolvedImagePayload[]): unknown[] {
  const blocks: unknown[] = [];
  if (images && images.length > 0) {
    for (const img of images) {
      blocks.push({ type: 'image', mimeType: img.mimeType, data: img.data });
    }
  }
  if (text) {
    blocks.push({ type: 'text', text });
  }
  if (blocks.length === 0) {
    blocks.push({ type: 'text', text: '' });
  }
  return blocks;
}

// ─── JSON-RPC 2.0 client (same protocol as Gemini ACP) ───

class JsonRpcClient {
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
  private onNotification: ((method: string, params: unknown) => void) | null = null;
  private onServerRequest: ((id: number, method: string, params: unknown) => void) | null = null;
  private encoder = new TextEncoder();
  private sink: SubprocessStdin;
  private reading = false;
  private destroyReason = 'hermes acp process exited';

  constructor(private proc: Subprocess) {
    const stdin = proc.stdin;
    if (!stdin) throw new Error('stdin not available');
    this.sink = stdin;
  }

  setNotificationHandler(h: (method: string, params: unknown) => void): void {
    this.onNotification = h;
  }

  setServerRequestHandler(h: (id: number, method: string, params: unknown) => void): void {
    this.onServerRequest = h;
  }

  async call(method: string, params: unknown, timeoutMs = 30_000): Promise<unknown> {
    const id = this.nextId++;
    this.write({ jsonrpc: '2.0', id, method, params });
    return new Promise<unknown>((resolve, reject) => {
      const timer = timeoutMs > 0
        ? setTimeout(() => {
            if (this.pending.has(id)) {
              this.pending.delete(id);
              reject(new Error(`JSON-RPC call "${method}" timed out after ${timeoutMs}ms`));
            }
          }, timeoutMs)
        : null;
      this.pending.set(id, {
        resolve: (r) => {
          if (timer) clearTimeout(timer);
          resolve(r);
        },
        reject: (e) => {
          if (timer) clearTimeout(timer);
          reject(e);
        },
      });
    });
  }

  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: '2.0', method, params });
  }

  respond(id: number, result: unknown): void {
    this.write({ jsonrpc: '2.0', id, result });
  }

  respondError(id: number, code: number, message: string): void {
    this.write({ jsonrpc: '2.0', id, error: { code, message } });
  }

  destroy(): void {
    for (const [, { reject }] of this.pending) {
      reject(new Error(this.destroyReason));
    }
    this.pending.clear();
  }

  async startReading(): Promise<void> {
    if (this.reading) return;
    this.reading = true;
    const stdout = this.proc.stdout;
    if (!stdout) return;

    const reader = (stdout as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          this.handleLine(line);
        }
      }
    } catch (err) {
      if (String(err).includes('cancel') || String(err).includes('closed')) return;
      console.error('[hermes-rpc] Reader error:', err);
    } finally {
      reader.releaseLock();
      this.destroy();
    }
  }

  private handleLine(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    if ('id' in msg && !('method' in msg)) {
      const id = msg.id as number;
      const handler = this.pending.get(id);
      if (handler) {
        this.pending.delete(id);
        if (msg.error) {
          const err = msg.error as { code: number; message: string; data?: { details?: string } };
          const details = typeof err.data?.details === 'string' ? `: ${err.data.details}` : '';
          handler.reject(new Error(`RPC error ${err.code}: ${err.message}${details}`));
        } else {
          handler.resolve(msg.result);
        }
      }
      return;
    }

    if ('method' in msg && !('id' in msg)) {
      this.onNotification?.(msg.method as string, msg.params);
      return;
    }

    if ('method' in msg && 'id' in msg) {
      this.onServerRequest?.(msg.id as number, msg.method as string, msg.params);
      return;
    }
  }

  private write(msg: unknown): void {
    void this.sink.write(this.encoder.encode(JSON.stringify(msg) + '\n')).catch(() => { /* stdin may be closed */ });
  }
}

// ─── RuntimeProcess wrapper ───

class HermesProcess implements RuntimeProcess {
  readonly pid: number;
  exited = false;
  rpc: JsonRpcClient;
  sessionId = '';
  wrappedOnEvent: UnifiedEventCallback | null = null;
  defaultMode = 'autoEdit';
  /** True when the startup catch-handler killed the process itself. */
  intentionalKillDuringStartup = false;

  private proc: Subprocess;

  constructor(proc: Subprocess) {
    this.proc = proc;
    this.pid = proc.pid;
    this.rpc = new JsonRpcClient(proc);
  }

  writeLine(_line: string): Promise<void> {
    throw new Error('Hermes ACP runtime does not support raw stdin writes');
  }

  kill(signal?: NodeJS.Signals | number): void {
    if (this.exited) return;
    try {
      this.proc.kill(signal ?? 15);
    } catch { /* already dead */ }
  }

  async waitForExit(): Promise<number> {
    const code = await this.proc.exited;
    this.exited = true;
    return code;
  }
}

// ─── Model cache ───

let modelCache: { models: RuntimeModelInfo[]; timestamp: number } | null = null;
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Build RuntimeModelInfo[] from an ACP session/new response's `models` field.
 * Same structure as Gemini's ACP response.
 */
function buildModelListFromAcpResponse(modelsField: {
  availableModels?: Array<{ modelId: string; name: string; description?: string }>;
  currentModelId?: string;
} | undefined): RuntimeModelInfo[] {
  const models: RuntimeModelInfo[] = [
    { value: '', displayName: '默认', isDefault: true },
  ];
  if (modelsField?.availableModels) {
    for (const m of modelsField.availableModels) {
      models.push({
        value: m.modelId,
        displayName: m.name || m.modelId,
        description: m.description,
      });
    }
  }
  return models;
}

// ─── Permission mode mapping ───

function mapPermissionMode(mode: string): string {
  // Hermes uses ACP modes similar to Gemini
  switch (mode) {
    case 'autoEdit':
    case 'yolo':
    case 'default':
    case 'plan':
      return mode;
    // Map BlexAgent-internal names to ACP equivalents
    case 'auto': return 'autoEdit';
    case 'fullAgency': return 'yolo';
    case 'bypassPermissions': return 'yolo';
    default: return 'autoEdit';
  }
}

/** Pick default mode based on scenario — same as Gemini. */
function pickDefaultMode(scenarioType: string): string {
  const isHeadlessAutomation = scenarioType === 'im'
    || scenarioType === 'agent-channel'
    || scenarioType === 'cron'
    || scenarioType === 'registeredAgent';
  return isHeadlessAutomation ? 'yolo' : 'autoEdit';
}

// ─── Stderr drain ───

function drainHermesStderr(proc: Subprocess, tag = '[hermes-stderr]'): Promise<void> {
  if (!proc.stderr) return Promise.resolve();
  return (async () => {
    const reader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true }).trim();
        if (text) console.error(`${tag} ${stripAnsi(text)}`);
      }
    } catch {
      /* ignore */
    } finally {
      reader.releaseLock();
    }
  })();
}

// ─── HermesRuntime ───

export class HermesRuntime implements AgentRuntime {
  readonly type: RuntimeType = 'hermes';

  async detect(): Promise<RuntimeDetection> {
    try {
      const command = resolveCommand('hermes');
      const proc = spawn([command, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'ignore',
        env: augmentedProcessEnv(),
      });
      const text = await new Response(proc.stdout).text();
      const code = await proc.exited;
      if (code === 0) {
        return { installed: true, version: text.trim(), path: command };
      }
    } catch {
      /* not installed */
    }
    return { installed: false };
  }

  async queryModels(): Promise<RuntimeModelInfo[]> {
    if (modelCache && Date.now() - modelCache.timestamp < MODEL_CACHE_TTL_MS) {
      return modelCache.models;
    }
    try {
      return await this.queryModelsViaAcp();
    } catch (err) {
      console.error('[hermes] Failed to query models:', err);
      return modelCache?.models ?? [];
    }
  }

  /**
   * Spawn a short-lived `hermes acp --accept-hooks`, handshake via
   * initialize + session/new, read available models from the response, then kill.
   */
  private async queryModelsViaAcp(): Promise<RuntimeModelInfo[]> {
    const cwd = process.env.HOME || process.cwd();
    const proc = spawn([resolveCommand('hermes'), 'acp', '--accept-hooks'], {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'pipe',
      cwd,
      env: augmentedProcessEnv(),
    });

    const rpc = new JsonRpcClient(proc);
    const readerDone = rpc.startReading();
    const stderrDone = drainHermesStderr(proc, '[hermes-stderr/queryModels]');

    // Yield to microtask queue so reader enters first await before we write.
    await new Promise((r) => setTimeout(r, 50));

    try {
      await rpc.call('initialize', { protocolVersion: 1, clientCapabilities: {} }, 30_000);

      const result = (await rpc.call(
        'session/new',
        { cwd, mcpServers: [] },
        30_000,
      )) as {
        models?: {
          availableModels?: Array<{ modelId: string; name: string; description?: string }>;
          currentModelId?: string;
        };
      };

      const models = buildModelListFromAcpResponse(result.models);
      modelCache = { models, timestamp: Date.now() };
      return models;
    } finally {
      rpc.destroy();
      try { proc.kill(); } catch { /* ignore */ }
      await readerDone.catch(() => {});
      await stderrDone.catch(() => {});
    }
  }

  getPermissionModes(): RuntimePermissionMode[] {
    return HERMES_PERMISSION_MODES;
  }

  getConfigCapabilities(): RuntimeConfigCapabilities {
    return {
      model: 'live_session_rpc',
      permissionMode: 'live_session_rpc',
      reasoningEffort: 'unsupported',
    };
  }

  async startSession(
    options: SessionStartOptions,
    onEvent: UnifiedEventCallback,
  ): Promise<RuntimeProcess> {
    cleanupStaleSessionPrompts();

    // 1. Write the per-session system prompt file BEFORE spawn.
    const promptFile = writeSessionSystemPrompt(
      options.sessionId,
      options.systemPromptAppend,
    );

    // 2. Spawn hermes acp --accept-hooks with the system prompt env var.
    const spawnEnv: Record<string, string | undefined> = { ...augmentedProcessEnv(options.envPolicy) };
    spawnEnv.PWD = options.workspacePath;
    spawnEnv.BLEXAGENT_SESSION_ID = options.sessionId;
    if (promptFile) {
      spawnEnv.HERMES_SYSTEM_MD = promptFile;
    }

    const proc = spawn([resolveCommand('hermes'), 'acp', '--accept-hooks'], {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'pipe',
      cwd: options.workspacePath,
      env: spawnEnv,
      detached: process.platform !== 'win32',
      windowsHide: true,
    });

    const hermesProc = new HermesProcess(proc);

    // 3. Wire up event callback.
    let sessionCompleteEmitted = false;
    const wrappedOnEvent: UnifiedEventCallback = (event) => {
      if (event.kind === 'session_complete') {
        if (sessionCompleteEmitted) return;
        sessionCompleteEmitted = true;
      }
      withLogContext({ runtime: 'hermes' }, () => onEvent(event));
    };
    hermesProc.wrappedOnEvent = wrappedOnEvent;

    // 4. Wire notification + server-request handlers.
    hermesProc.rpc.setNotificationHandler((method, params) => {
      this.logNotification(method, params);
      const result = this.parseNotification(hermesProc, method, params);
      if (!result) return;
      const events = Array.isArray(result) ? result : [result];
      for (const event of events) wrappedOnEvent(event);
    });

    hermesProc.rpc.setServerRequestHandler((id, method, params) => {
      this.handleServerRequest(hermesProc, id, method, params, wrappedOnEvent);
    });

    hermesProc.rpc.startReading();

    // 5. Lifecycle: emit session_complete on process exit.
    proc.exited.then((code) => {
      hermesProc.exited = true;
      if (hermesProc.intentionalKillDuringStartup) return;
      wrappedOnEvent({
        kind: 'session_complete',
        result: code === 0 ? '' : `Hermes process exited with code ${code}`,
        subtype: code === 0 ? 'success' : 'error',
      });
    });

    // 6. Drain stderr.
    void drainHermesStderr(proc);

    try {
      // 7. ACP initialize handshake.
      await hermesProc.rpc.call(
        'initialize',
        { protocolVersion: 1, clientCapabilities: {} },
        30_000,
      );

      // 8. Determine mode + create/load session.
      const desiredMode = options.permissionMode
        ? mapPermissionMode(options.permissionMode)
        : pickDefaultMode(options.scenario.type);
      hermesProc.defaultMode = pickDefaultMode(options.scenario.type);

      if (options.resumeSessionId) {
        hermesProc.rpc.notify('session/load', {
          sessionId: options.resumeSessionId,
          cwd: options.workspacePath,
          mcpServers: [],
        });
        hermesProc.sessionId = options.resumeSessionId;

        onEvent({
          kind: 'session_init',
          sessionId: options.resumeSessionId,
          model: options.model || '',
          tools: [],
        });
      } else {
        const result = (await hermesProc.rpc.call(
          'session/new',
          { cwd: options.workspacePath, mcpServers: [] },
          30_000,
        )) as {
          sessionId: string;
          models?: {
            currentModelId?: string;
            availableModels?: Array<{ modelId: string; name: string; description?: string }>;
          };
        };
        hermesProc.sessionId = result.sessionId;

        const models = buildModelListFromAcpResponse(result.models);
        modelCache = { models, timestamp: Date.now() };

        onEvent({
          kind: 'session_init',
          sessionId: result.sessionId,
          model: result.models?.currentModelId || options.model || '',
          tools: [],
        });
      }

      // 9. Apply desired mode if not default.
      if (desiredMode !== 'default') {
        try {
          await hermesProc.rpc.call(
            'session/set_mode',
            { sessionId: hermesProc.sessionId, modeId: desiredMode },
            5_000,
          );
          console.log(`[hermes] set_mode → ${desiredMode}`);
        } catch (err) {
          console.warn(`[hermes] set_mode failed (non-fatal):`, err);
        }
      }

      // 10. Apply model override.
      if (options.model && options.model.length > 0) {
        try {
          await hermesProc.rpc.call(
            'session/set_model',
            { sessionId: hermesProc.sessionId, modelId: options.model },
            5_000,
          );
          console.log(`[hermes] set_model → ${options.model}`);
        } catch (err) {
          console.warn(`[hermes] set_model failed (non-fatal):`, err);
        }
      }

      // 11. Send initial message if provided.
      if (options.initialMessage) {
        this.dispatchPrompt(
          hermesProc,
          options.initialMessage,
          options.initialImages,
          wrappedOnEvent,
        );
      }
    } catch (err) {
      hermesProc.intentionalKillDuringStartup = true;
      try { proc.kill(9); } catch { /* ignore */ }
      hermesProc.exited = true;

      // Detect stale session/load failure.
      const msg = err instanceof Error ? err.message : String(err);
      if (/invalid session identifier/i.test(msg)) {
        throw new StaleRuntimeSessionError(
          options.resumeSessionId || '',
          `Hermes ACP rejected session load — session no longer exists. ` +
          `Error: ${msg}`,
        );
      }
      throw err;
    }

    return hermesProc;
  }

  async sendMessage(
    process: RuntimeProcess,
    message: string,
    images?: ResolvedImagePayload[],
  ): Promise<void> {
    const hermesProc = process as unknown as HermesProcess;
    this.dispatchPrompt(hermesProc, message, images, hermesProc.wrappedOnEvent!);
  }

  async respondPermission(
    process: RuntimeProcess,
    requestId: string,
    decision: 'deny' | 'allow_once' | 'always_allow',
    reason?: string,
  ): Promise<void> {
    const hermesProc = process as unknown as HermesProcess;
    hermesProc.rpc.respond(Number(requestId), {
      decision: decision === 'deny' ? 'reject' : 'approve',
      reason,
    });
  }

  async stopSession(process: RuntimeProcess): Promise<void> {
    const hermesProc = process as unknown as HermesProcess;
    hermesProc.rpc.destroy();
    try {
      await killWithEscalation(hermesProc, {
        gracefulMs: 3_000,
        hardMs: 2_000,
        killTree: true,
      });
    } catch { /* already dead */ }
    hermesProc.exited = true;
  }

  // ─── Private helpers ───

  private dispatchPrompt(
    hermesProc: HermesProcess,
    message: string,
    images: ResolvedImagePayload[] | undefined,
    onEvent: UnifiedEventCallback,
  ): void {
    const content = buildHermesPrompt(message, images);

    onEvent({ kind: 'status_change', state: 'running' });

    // Fire session/prompt as a notification (Hermes ACP may use notify or call).
    // The response arrives as session/update notifications.
    hermesProc.rpc.notify('session/prompt', {
      sessionId: hermesProc.sessionId,
      content,
    });
  }

  private logNotification(method: string, _params: unknown): void {
    // Abbreviated logging — full params can be very large.
    if (method.startsWith('session/update')) return; // too noisy
    console.log(`[hermes-notify] ${method}`);
  }

  /**
   * Parse ACP notifications into UnifiedEvents.
   * Hermes uses the same ACP notification format as Gemini.
   */
  private parseNotification(
    hermesProc: HermesProcess,
    method: string,
    params: unknown,
  ): UnifiedEvent | UnifiedEvent[] | null {
    const p = params as Record<string, unknown> | undefined;

    switch (method) {
      case 'session/update': {
        if (!p) return null;
        const update = p as Record<string, unknown>;
        const kind = update.kind as string | undefined;

        if (kind === 'text') {
          return {
            kind: 'text_delta',
            text: (update.text as string) || '',
          };
        }

        if (kind === 'thinking') {
          return {
            kind: 'thinking_delta',
            text: (update.text as string) || '',
            index: 0,
          };
        }

        if (kind === 'tool_call') {
          return {
            kind: 'tool_use_start',
            toolUseId: String(update.callId || update.id || ''),
            toolName: String(update.name || ''),
            input: update.arguments as Record<string, unknown> | undefined,
          };
        }

        if (kind === 'tool_call_update') {
          const callId = String(update.callId || update.id || '');
          if (update.result !== undefined) {
            return {
              kind: 'tool_result',
              toolUseId: callId,
              content: String(update.result ?? ''),
              isError: update.isError === true,
            };
          }
          return {
            kind: 'tool_result_delta',
            toolUseId: callId,
            delta: String(update.delta || ''),
          };
        }

        return null;
      }

      case 'session/prompt_complete': {
        if (!p) return null;
        const result = p as Record<string, unknown>;
        const stopReason = String(result.stopReason || 'end_turn');
        return {
          kind: 'turn_complete',
          status: stopReason,
        };
      }

      case 'session/error': {
        if (!p) return null;
        const error = p as Record<string, unknown>;
        return {
          kind: 'session_complete',
          result: String(error.message || 'Unknown error'),
          subtype: 'error',
        };
      }

      default:
        return null;
    }
  }

  private handleServerRequest(
    hermesProc: HermesProcess,
    id: number,
    method: string,
    params: unknown,
    onEvent: UnifiedEventCallback,
  ): void {
    if (method === 'permission/request') {
      const p = params as Record<string, unknown> | undefined;
      const requestId = String(id);
      const toolName = String(p?.toolName || 'unknown');
      const toolUseId = String(p?.toolUseId || requestId);
      const input = (p?.input as Record<string, unknown>) || {};

      onEvent({
        kind: 'permission_request',
        requestId,
        toolName,
        toolUseId,
        input,
      });
    } else {
      // Unknown server request — respond with error to unblock.
      hermesProc.rpc.respondError(id, -32601, `Method not found: ${method}`);
    }
  }
}
