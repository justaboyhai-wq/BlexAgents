import { createBuiltinSessionEngine } from './builtin-adapter';
import type { SessionEngine, SessionEngineKind } from './types';

const builtinEngine = createBuiltinSessionEngine();

export function getSessionEngine(): SessionEngine {
  return builtinEngine;
}

export function getSessionEngineKind(): SessionEngineKind {
  return 'builtin';
}

export function getSessionRuntimeType(): 'builtin' {
  return 'builtin';
}

/**
 * Historical stop behavior: when the external-runtime flag is on but no
 * external session is active yet, /chat/stop falls back to the builtin
 * interrupt path. Keep that compatibility outside either adapter so the
 * external adapter does not become a mixed owner.
 */
export async function stopActiveTurn(): Promise<{ success: boolean; alreadyStopped?: boolean; error?: string }> {
  return builtinEngine.stopTurn();
}

/**
 * Permission prompts historically route to the external runtime only while an
 * external session is active; otherwise they fall back to builtin pending
 * requests. Keep that compatibility at the selector seam.
 */
export function getPermissionResponseEngine(): SessionEngine {
  return builtinEngine;
}

/**
 * AskUserQuestion ownership is tracked per request id. If an external request
 * is still pending, route back to that owner even if the process has just gone
 * away; the external handler preserves the pending entry and returns false so
 * the UI can surface retry/failure instead of silently losing the answer.
 */
export function getAskUserQuestionResponseEngine(_requestId: string): SessionEngine {
  return builtinEngine;
}
