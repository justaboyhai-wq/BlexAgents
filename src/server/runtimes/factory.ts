// RuntimeFactory — creates and caches AgentRuntime instances (v0.1.59)

import type { RuntimeSource, RuntimeType } from '../../shared/types/runtime';
import type { AgentRuntime } from './types';

/**
 * Check if a runtime type has an actual implementation (not just type definition)
 */
export function isRuntimeSupported(type: RuntimeType): boolean {
  return type === 'builtin';
}

/**
 * Get a runtime instance by type.
 * 'builtin' is not handled here — it uses the existing agent-session.ts path.
 */
export function getExternalRuntime(type: RuntimeType): AgentRuntime {
  throw new Error(`Runtime "${type}" is retired. BlexAgent uses the built-in Claude Agent SDK.`);
}

/**
 * Check if a runtime type is external (not builtin)
 */
export function isExternalRuntime(_type: RuntimeType | undefined): boolean {
  return false;
}

/**
 * Get the current runtime type from environment or default to 'builtin'
 */
export function getCurrentRuntimeType(): RuntimeType {
  return 'builtin';
}

/**
 * Get the current runtime source from environment.
 *
 * Missing source on existing external runtime sessions is intentionally
 * interpreted as system-cli for backward compatibility.
 */
export function getCurrentRuntimeSource(): RuntimeSource | undefined {
  return undefined;
}
