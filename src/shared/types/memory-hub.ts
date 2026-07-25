/**
 * Public MemoryHub contracts shared by the renderer and Sidecar.
 *
 * Rust owns persistence. Session/task/thought stores remain the source of
 * truth; every record below is a rebuildable projection with provenance.
 */

export type MemoryScopeKind = 'user' | 'workspace' | 'agent';

export interface MemoryScope {
  kind: MemoryScopeKind;
  id?: string;
}

export type MemoryKind =
  | 'preference'
  | 'fact'
  | 'decision'
  | 'goal'
  | 'procedure'
  | 'project_state';

export type MemoryStatus = 'active' | 'superseded' | 'deleted';

export interface MemorySourceRef {
  type: 'session_message' | 'session_turn' | 'task' | 'thought' | 'manual';
  id: string;
  sessionId?: string;
  messageId?: string;
  taskId?: string;
  path?: string;
  revision?: string;
}

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  canonicalKey: string;
  scope: MemoryScope;
  summary: string;
  tags: string[];
  importance: number;
  confidence: number;
  validFrom: string;
  validTo?: string;
  status: MemoryStatus;
  sourceRefs: MemorySourceRef[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  extractor?: 'local_rules' | 'turn_projection' | 'model' | 'manual' | 'import';
}

export type ActivityEventType =
  | 'chat.turn.completed'
  | 'task.created'
  | 'task.status.changed'
  | 'thought.created'
  | 'thought.converted'
  | 'cron.run.completed'
  | 'artifact.produced';

export interface ActivityMetrics {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  toolCount: number;
}

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  occurredAt: string;
  workspaceId?: string;
  workspacePath?: string;
  agentId?: string;
  sessionId?: string;
  taskId?: string;
  thoughtId?: string;
  messageId?: string;
  title?: string;
  summary?: string;
  status?: string;
  source: 'session' | 'task' | 'thought' | 'cron' | 'manual';
  metrics: ActivityMetrics;
  sourceRevision?: string;
}

export interface ArtifactRecord {
  id: string;
  kind: 'image' | 'audio' | 'pdf' | 'file';
  mimeType: string;
  title: string;
  refPath?: string;
  savedPath?: string;
  sourcePath?: string;
  sizeBytes?: number;
  producedBy?: string;
  workspaceId?: string;
  workspacePath?: string;
  agentId?: string;
  sessionId?: string;
  taskId?: string;
  messageId?: string;
  createdAt: string;
  pinned: boolean;
  missing: boolean;
  deleted?: boolean;
}

export interface MemoryHubConfig {
  enabled: boolean;
  captureEnabled: boolean;
  recallEnabled: boolean;
  userScopeEnabled: boolean;
  workspaceScopeEnabled: boolean;
  agentScopeEnabled: boolean;
  backend: 'local' | 'mem0';
  mem0BaseUrl?: string | null;
  backfillDays: number;
}

export interface MemorySearchInput {
  query: string;
  workspaceId?: string;
  workspacePath?: string;
  agentId?: string;
  limit?: number;
  includeDeleted?: boolean;
}

export interface MemorySearchResult {
  records: MemoryRecord[];
  context: string;
  elapsedMs: number;
}

export interface MemoryListInput {
  workspaceId?: string;
  agentId?: string;
  kind?: MemoryKind;
  status?: MemoryStatus;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface MemoryListResult {
  records: MemoryRecord[];
  total: number;
}

export interface InsightsQuery {
  from: string;
  to: string;
  timezone: string;
  workspaceIds?: string[];
  agentIds?: string[];
}

export interface InsightsMetrics extends ActivityMetrics {
  conversationCount: number;
  completedTaskCount: number;
  blockedTaskCount: number;
  activeTaskCount: number;
  artifactCount: number;
  activeWorkspaceCount: number;
}

export interface InsightsDayPoint {
  date: string;
  conversations: number;
  completedTasks: number;
  artifacts: number;
  inputTokens: number;
  outputTokens: number;
}

export interface InsightsTaskItem {
  id: string;
  name: string;
  status: string;
  workspaceId?: string;
  workspacePath?: string;
  updatedAt: string;
}

export interface InsightsResult {
  query: InsightsQuery;
  metrics: InsightsMetrics;
  timeline: InsightsDayPoint[];
  tasks: InsightsTaskItem[];
  artifacts: ArtifactRecord[];
  highlights: ActivityEvent[];
  dataRevision: string;
  generatedAt: string;
}

export interface InsightsReportSource {
  type: 'session' | 'task' | 'artifact';
  id: string;
  title?: string;
  sessionId?: string;
  taskId?: string;
  workspacePath?: string;
  path?: string;
}

export interface InsightsReport {
  summary: string;
  dataRevision: string;
  generatedAt: string;
  source: 'local-deterministic' | 'model';
  sources: InsightsReportSource[];
}

export interface MemoryHubStatus {
  rootDir: string;
  config: MemoryHubConfig;
  activityCount: number;
  memoryCount: number;
  artifactCount: number;
  pendingExtractionCount: number;
  indexedSessionCount: number;
  backfillRunning: boolean;
  lastReconciledAt?: string;
  lastError?: string;
  backendHealthy: boolean;
}

export interface MemoryUpdateInput {
  id: string;
  summary?: string;
  kind?: MemoryKind;
  tags?: string[];
  importance?: number;
  confidence?: number;
  scope?: MemoryScope;
  pinned?: boolean;
}
