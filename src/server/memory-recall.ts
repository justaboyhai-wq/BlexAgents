import { buildMemoryContextReminder, parseLeadingSystemReminder } from '../shared/systemReminder';
import type { MemoryRecord, MemorySearchResult } from '../shared/types/memory-hub';
import { managementApi } from './utils/management-api-client';

const RECALL_TIMEOUT_MS = 150;

function visibleQuery(text: string): string {
  const parsed = parseLeadingSystemReminder(text);
  return parsed.hasReminder ? parsed.visibleText : text;
}

function isRecallCandidate(text: string): boolean {
  const parsed = parseLeadingSystemReminder(text);
  if (parsed.kind === 'MEMORY_UPDATE' || parsed.kind === 'HEARTBEAT' || parsed.kind === 'CRON_TASK') {
    return false;
  }
  const query = visibleQuery(text).trim();
  return query.length >= 2 && !query.startsWith('[System]');
}

/** Fail-open memory enrichment shared by every normal SessionEngine admission. */
export async function enrichMessageWithMemory(
  text: string,
  workspacePath: string,
  agentId?: string,
): Promise<string> {
  if (!isRecallCandidate(text) || !workspacePath.trim()) return text;
  try {
    const response = await managementApi('/api/memory/recall', 'POST', {
      query: visibleQuery(text),
      workspacePath,
      agentId,
      limit: 8,
    }, RECALL_TIMEOUT_MS);
    if (response.ok !== true || !response.result || typeof response.result !== 'object') {
      return text;
    }
    const result = response.result as MemorySearchResult;
    const records = Array.isArray(result.records) ? result.records : [];
    return buildMemoryContextReminder(text, records.map((record: MemoryRecord) => ({
      id: record.id,
      scope: record.scope.kind,
      kind: record.kind,
      summary: record.summary,
    })));
  } catch (error) {
    console.warn('[memory-hub] recall failed open:', error);
    return text;
  }
}
