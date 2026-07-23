import { managementApi } from './utils/management-api-client';
import { setPostTurnMemoryHook } from './turn-hooks';

/**
 * Install the low-latency post-turn notification. Rust still watches the
 * source files and performs periodic reconciliation, so a failed request is
 * harmless and intentionally never retried on the turn path.
 */
export function installMemoryHubPostTurnHook(): void {
  setPostTurnMemoryHook((sessionId) => {
    void managementApi('/api/memory/turn-completed', 'POST', { sessionId })
      .then((result) => {
        if (result.ok === false) {
          console.warn('[memory-hub] post-turn notification rejected:', result.error);
        }
      })
      .catch((error) => {
        console.warn('[memory-hub] post-turn notification failed:', error);
      });
  });
}
