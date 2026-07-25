import { invoke } from '@tauri-apps/api/core';
import type {
  ArtifactRecord,
  InsightsQuery,
  InsightsReport,
  InsightsResult,
  MemoryHubConfig,
  MemoryHubStatus,
  MemoryListInput,
  MemoryListResult,
  MemoryRecord,
  MemorySearchInput,
  MemorySearchResult,
  MemoryUpdateInput,
} from '../../shared/types/memory-hub';

export const getMemoryHubStatus = () => invoke<MemoryHubStatus>('cmd_memory_status');
export const getMemoryHubConfig = () => invoke<MemoryHubConfig>('cmd_memory_get_config');
export const updateMemoryHubConfig = (config: MemoryHubConfig) =>
  invoke<MemoryHubConfig>('cmd_memory_update_config', { config });
export const rebuildMemoryHub = () => invoke<MemoryHubStatus>('cmd_memory_rebuild');
export const backfillMemoryHub = (days?: number) =>
  invoke<MemoryHubStatus>('cmd_memory_backfill', { days: days ?? null });
export const clearMemoryHub = () => invoke<void>('cmd_memory_clear');
export const exportMemoryHub = (destinationPath: string) =>
  invoke<string>('cmd_memory_export', { destinationPath });

export const searchMemories = (input: MemorySearchInput) =>
  invoke<MemorySearchResult>('cmd_memory_search', { input });
export const listMemories = (input: MemoryListInput = {}) =>
  invoke<MemoryListResult>('cmd_memory_list', { input });
export const updateMemory = (input: MemoryUpdateInput) =>
  invoke<MemoryRecord>('cmd_memory_update', { input });
export const deleteMemory = (id: string) => invoke<MemoryRecord>('cmd_memory_delete', { id });
export const pinMemory = (id: string, pinned: boolean) =>
  invoke<MemoryRecord>('cmd_memory_pin', { id, pinned });

export const queryInsights = (query: InsightsQuery) =>
  invoke<InsightsResult>('cmd_insights_query', { query });
export const generateInsightsReport = (query: InsightsQuery) =>
  invoke<InsightsReport>(
    'cmd_insights_generate_report',
    { query },
  );
export const pinArtifact = (id: string, pinned: boolean) =>
  invoke<ArtifactRecord>(pinned ? 'cmd_artifact_pin' : 'cmd_artifact_unpin', { id });
