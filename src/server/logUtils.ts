/**
 * Shared utilities for logging system
 */

import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ensureDirSync } from './utils/fs-utils';

export const BLEXAGENT_DIR = join(homedir(), '.blexagent');
export const LOGS_DIR = join(BLEXAGENT_DIR, 'logs');
// Retention policy moved to `./log-retention.ts` (#121, 2026-05). Keeping a
// re-export of LOGS_DIR + ensureLogsDir as the only API of this module.

/**
 * Ensure logs directory exists
 */
export function ensureLogsDir(): void {
  if (!existsSync(BLEXAGENT_DIR)) {
    ensureDirSync(BLEXAGENT_DIR);
  }
  if (!existsSync(LOGS_DIR)) {
    ensureDirSync(LOGS_DIR);
  }
}
