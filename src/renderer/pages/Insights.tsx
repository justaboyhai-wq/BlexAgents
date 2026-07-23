import {
  Archive,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  FolderOpen,
  History,
  Loader2,
  MemoryStick,
  MessageSquare,
  Pencil,
  Pin,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import {
  deleteMemory,
  generateInsightsReport,
  listMemories,
  pinArtifact,
  pinMemory,
  queryInsights,
  updateMemory,
} from '@/api/memoryHubClient';
import { CUSTOM_EVENTS } from '@/../shared/constants';
import type {
  ArtifactRecord,
  InsightsQuery,
  InsightsReport,
  InsightsReportSource,
  InsightsResult,
  MemoryKind,
  MemoryRecord,
} from '@/../shared/types/memory-hub';

type RangeKey = 'today' | '7d' | '30d';
type ViewKey = 'overview' | 'artifacts' | 'progress' | 'memories' | 'efficiency';

interface Props {
  isActive?: boolean;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildRange(key: RangeKey): Pick<InsightsQuery, 'from' | 'to' | 'timezone'> {
  const now = new Date();
  const start = startOfLocalDay(now);
  if (key === '7d') start.setDate(start.getDate() - 6);
  if (key === '30d') start.setDate(start.getDate() - 29);
  return {
    from: start.toISOString(),
    to: new Date(now.getTime() + 1).toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  };
}

function basename(path?: string): string {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() || path;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return `${Math.round(ms / 1000)}s`;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function artifactIcon(record: ArtifactRecord) {
  if (record.kind === 'image') return FileImage;
  if (record.kind === 'audio') return FileAudio;
  return FileText;
}

export default function Insights({ isActive = true }: Props) {
  const { t } = useTranslation('insights');
  const toast = useToast();
  const [rangeKey, setRangeKey] = useState<RangeKey>('7d');
  const [view, setView] = useState<ViewKey>('overview');
  const [workspaceId, setWorkspaceId] = useState('all');
  const [agentId, setAgentId] = useState('all');
  const [data, setData] = useState<InsightsResult | null>(null);
  const [scopeSeed, setScopeSeed] = useState<InsightsResult | null>(null);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memoryKind, setMemoryKind] = useState<'all' | MemoryKind>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; summary: string } | null>(null);

  const query = useMemo<InsightsQuery>(() => ({
    ...buildRange(rangeKey),
    ...(workspaceId !== 'all' ? { workspaceIds: [workspaceId] } : {}),
    ...(agentId !== 'all' ? { agentIds: [agentId] } : {}),
  }), [agentId, rangeKey, workspaceId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextData, memoryResult] = await Promise.all([
        queryInsights(query),
        listMemories({
          ...(workspaceId !== 'all' ? { workspaceId } : {}),
          ...(agentId !== 'all' ? { agentId } : {}),
          ...(memoryKind !== 'all' ? { kind: memoryKind } : {}),
          status: 'active',
          query: memoryQuery,
          limit: 300,
        }),
      ]);
      setData(nextData);
      setScopeSeed(current => (workspaceId === 'all' && agentId === 'all' ? nextData : current ?? nextData));
      setMemories(memoryResult.records);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [agentId, memoryKind, memoryQuery, query, workspaceId]);

  useEffect(() => {
    if (!isActive) return;
    void load();
  }, [isActive, load]);

  useEffect(() => {
    setReport(null);
  }, [query]);

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    const source = scopeSeed;
    for (const event of source?.highlights ?? []) {
      if (event.workspaceId) map.set(event.workspaceId, basename(event.workspacePath) || event.workspaceId);
    }
    for (const artifact of source?.artifacts ?? []) {
      if (artifact.workspaceId) map.set(artifact.workspaceId, basename(artifact.workspacePath) || artifact.workspaceId);
    }
    for (const task of source?.tasks ?? []) {
      if (task.workspaceId) map.set(task.workspaceId, basename(task.workspacePath) || task.workspaceId);
    }
    return [{ value: 'all', label: t('filters.allWorkspaces') }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [scopeSeed, t]);

  const agentOptions = useMemo(() => {
    const values = new Set((scopeSeed?.highlights ?? []).map(event => event.agentId).filter(Boolean) as string[]);
    return [{ value: 'all', label: t('filters.allAgents') }, ...Array.from(values, value => ({ value, label: value.slice(0, 12) }))];
  }, [scopeSeed, t]);

  const handleGenerateReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const result = await generateInsightsReport(query);
      setReport(result);
    } catch (reason) {
      toast.error(t('errors.report', { message: reason instanceof Error ? reason.message : String(reason) }));
    } finally {
      setReportLoading(false);
    }
  }, [query, t, toast]);

  const openSession = useCallback((sessionId?: string, workspacePath?: string) => {
    if (!sessionId || !workspacePath) return;
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_SESSION_IN_NEW_TAB, {
      detail: { sessionId, workspacePath, historyEntrySource: 'task_center_search' },
    }));
  }, []);

  const openArtifact = useCallback(async (artifact: ArtifactRecord) => {
    const path = artifact.sourcePath ?? artifact.savedPath;
    if (path) {
      try {
        await invoke('cmd_open_file', { path });
        return;
      } catch (reason) {
        toast.error(t('errors.openArtifact', { message: reason instanceof Error ? reason.message : String(reason) }));
      }
    }
    openSession(artifact.sessionId, artifact.workspacePath);
  }, [openSession, t, toast]);

  const openReportSource = useCallback(async (source: InsightsReportSource) => {
    if (source.path) {
      try {
        await invoke('cmd_open_file', { path: source.path });
        return;
      } catch (reason) {
        toast.error(t('errors.openArtifact', { message: reason instanceof Error ? reason.message : String(reason) }));
      }
    }
    if (source.sessionId && source.workspacePath) {
      openSession(source.sessionId, source.workspacePath);
      return;
    }
    if (source.taskId) {
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_TASK_CENTER, {
        detail: { taskId: source.taskId },
      }));
    }
  }, [openSession, t, toast]);

  const saveMemoryEdit = useCallback(async () => {
    if (!editing) return;
    try {
      await updateMemory({ id: editing.id, summary: editing.summary });
      setEditing(null);
      await load();
    } catch (reason) {
      toast.error(t('errors.saveMemory', { message: reason instanceof Error ? reason.message : String(reason) }));
    }
  }, [editing, load, t, toast]);

  const maxTimelineValue = Math.max(1, ...(data?.timeline ?? []).map(point => point.conversations + point.completedTasks + point.artifacts));
  const rangeOptions: Array<{ key: RangeKey; label: string }> = [
    { key: 'today', label: t('ranges.today') },
    { key: '7d', label: t('ranges.sevenDays') },
    { key: '30d', label: t('ranges.thirtyDays') },
  ];
  const viewOptions: Array<{ key: ViewKey; label: string; icon: typeof History }> = [
    { key: 'overview', label: t('views.overview'), icon: History },
    { key: 'artifacts', label: t('views.artifacts'), icon: Archive },
    { key: 'progress', label: t('views.progress'), icon: CheckCircle2 },
    { key: 'memories', label: t('views.memories'), icon: MemoryStick },
    { key: 'efficiency', label: t('views.efficiency'), icon: TrendingUp },
  ];

  return (
    <div className="flex h-full flex-col bg-[var(--paper)] text-[var(--ink)]">
      <header className="shrink-0 px-6 pb-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[var(--radius-lg)] bg-[var(--paper-inset)] p-1">
              {rangeOptions.map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRangeKey(option.key)}
                  className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition-colors ${
                    rangeKey === option.key
                      ? 'bg-[var(--paper-elevated)] text-[var(--ink)] shadow-xs'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <CustomSelect value={workspaceId} options={workspaceOptions} onChange={setWorkspaceId} size="toolbar" />
            {agentOptions.length > 1 && (
              <CustomSelect value={agentId} options={agentOptions} onChange={setAgentId} size="toolbar" triggerIcon={<Bot className="h-3.5 w-3.5" />} />
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-inset)] hover:text-[var(--ink)]"
              title={t('actions.refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <nav className="mt-4 flex gap-1 border-b border-[var(--line-subtle)]">
          {viewOptions.map(option => {
            const Icon = option.icon;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setView(option.key)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  view === option.key
                    ? 'border-[var(--accent)] text-[var(--ink)]'
                    : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-8">
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
            <span>{t('errors.load', { message: error })}</span>
            <button type="button" onClick={() => void load()}>{t('actions.retry')}</button>
          </div>
        )}
        {loading && !data ? (
          <div className="flex h-full items-center justify-center text-[var(--ink-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : data ? (
          <>
            {view === 'overview' && (
              <div className="space-y-5">
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    [CheckCircle2, t('metrics.completedTasks'), data.metrics.completedTaskCount],
                    [Archive, t('metrics.artifacts'), data.metrics.artifactCount],
                    [MessageSquare, t('metrics.conversations'), data.metrics.conversationCount],
                    [FolderOpen, t('metrics.workspaces'), data.metrics.activeWorkspaceCount],
                  ].map(([Icon, label, value]) => {
                    const CardIcon = Icon as typeof CheckCircle2;
                    return (
                      <div key={String(label)} className="rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-4 shadow-xs">
                        <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]"><CardIcon className="h-4 w-4" />{String(label)}</div>
                        <div className="mt-3 text-3xl font-semibold">{formatNumber(Number(value))}</div>
                      </div>
                    );
                  })}
                </section>
                <section className="rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{t('timeline.title')}</h2>
                    <span className="text-xs text-[var(--ink-muted)]">{t('timeline.legend')}</span>
                  </div>
                  {data.timeline.length === 0 ? (
                    <p className="py-10 text-center text-sm text-[var(--ink-muted)]">{t('empty.noActivity')}</p>
                  ) : (
                    <div className="mt-5 flex h-44 items-end gap-2">
                      {data.timeline.map(point => {
                        const total = point.conversations + point.completedTasks + point.artifacts;
                        return (
                          <div key={point.date} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                            <div className="relative flex h-36 w-full items-end justify-center">
                              <div
                                className="w-full max-w-8 rounded-t-[var(--radius-sm)] bg-[var(--accent-warm-muted)] transition-colors group-hover:bg-[var(--accent)]"
                                style={{ height: `${Math.max(total ? 8 : 2, Math.round((total / maxTimelineValue) * 100))}%` }}
                                title={t('timeline.point', { date: point.date, count: total })}
                              />
                            </div>
                            <span className="truncate text-xs text-[var(--ink-muted)]">{point.date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
                  <div className="rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-5 shadow-xs">
                    <h2 className="text-sm font-semibold">{t('highlights.title')}</h2>
                    <div className="mt-3 space-y-2">
                      {data.highlights.slice(0, 6).map(event => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => openSession(event.sessionId, event.workspacePath)}
                          className="block w-full rounded-[var(--radius-lg)] px-3 py-2 text-left transition-colors hover:bg-[var(--hover-bg)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium">{event.title || t('highlights.conversation')}</span>
                            <span className="shrink-0 text-xs text-[var(--ink-muted)]">{new Date(event.occurredAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">{event.summary}</p>
                        </button>
                      ))}
                      {data.highlights.length === 0 && <p className="py-8 text-center text-sm text-[var(--ink-muted)]">{t('empty.noHighlights')}</p>}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-5 shadow-xs">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[var(--accent)]" />{t('report.title')}</h2>
                      <button
                        type="button"
                        onClick={() => void handleGenerateReport()}
                        disabled={reportLoading}
                        className="rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--button-secondary-bg-hover)] disabled:opacity-50"
                      >
                        {reportLoading ? t('report.generating') : report ? t('report.regenerate') : t('report.generate')}
                      </button>
                    </div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--ink-secondary)]">{report?.summary || t('report.placeholder')}</p>
                    {report && report.sources.length > 0 && (
                      <div className="mt-4 border-t border-[var(--line-subtle)] pt-3">
                        <p className="text-xs font-medium text-[var(--ink-muted)]">{t('report.sources')}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {report.sources.map(source => (
                            <button
                              key={`${source.type}:${source.id}`}
                              type="button"
                              onClick={() => void openReportSource(source)}
                              className="max-w-full truncate rounded-[var(--radius-md)] bg-[var(--paper-inset)] px-2.5 py-1 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                            >
                              {source.title || source.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {view === 'artifacts' && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{t('artifacts.title', { count: data.artifacts.length })}</h2>
                </div>
                {data.artifacts.length === 0 ? (
                  <EmptyState icon={Archive} text={t('empty.noArtifacts')} />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.artifacts.map(artifact => {
                      const Icon = artifactIcon(artifact);
                      return (
                        <article key={artifact.id} className="group rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-4 shadow-xs transition-shadow hover:shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="rounded-[var(--radius-lg)] bg-[var(--accent-warm-subtle)] p-2 text-[var(--accent)]"><Icon className="h-5 w-5" /></div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-medium">{artifact.title}</h3>
                              <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">{artifact.producedBy || artifact.mimeType}</p>
                              <p className="mt-2 text-xs text-[var(--ink-muted)]">{new Date(artifact.createdAt).toLocaleString()}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void pinArtifact(artifact.id, !artifact.pinned).then(load)}
                              className={`rounded-[var(--radius-md)] p-1.5 ${artifact.pinned ? 'text-[var(--accent)]' : 'text-[var(--ink-subtle)] opacity-0 group-hover:opacity-100'}`}
                              title={artifact.pinned ? t('actions.unpin') : t('actions.pin')}
                            ><Pin className="h-3.5 w-3.5" /></button>
                          </div>
                          {artifact.missing && <p className="mt-3 text-xs text-[var(--warning)]">{t('artifacts.missing')}</p>}
                          <div className="mt-4 flex gap-2">
                            <button type="button" onClick={() => void openArtifact(artifact)} className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--button-secondary-bg)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--button-secondary-bg-hover)]"><ExternalLink className="h-3.5 w-3.5" />{t('actions.open')}</button>
                            {artifact.sessionId && <button type="button" onClick={() => openSession(artifact.sessionId, artifact.workspacePath)} className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-inset)]"><MessageSquare className="h-3.5 w-3.5" />{t('actions.source')}</button>}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {view === 'progress' && (
              <section className="grid gap-4 lg:grid-cols-3">
                {(['done', 'active', 'blocked'] as const).map(bucket => {
                  const items = data.tasks.filter(task => bucket === 'done'
                    ? task.status === 'done'
                    : bucket === 'blocked'
                      ? task.status === 'blocked'
                      : ['todo', 'running', 'verifying'].includes(task.status));
                  return (
                    <div key={bucket} className="rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-4 shadow-xs">
                      <h2 className="flex items-center justify-between text-sm font-semibold"><span>{t(`progress.${bucket}`)}</span><span className="text-xs font-normal text-[var(--ink-muted)]">{items.length}</span></h2>
                      <div className="mt-3 space-y-2">
                        {items.map(task => (
                          <button key={task.id} type="button" onClick={() => window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.OPEN_TASK_CENTER, { detail: { taskId: task.id } }))} className="block w-full rounded-[var(--radius-lg)] px-3 py-2 text-left hover:bg-[var(--hover-bg)]">
                            <div className="text-sm font-medium">{task.name}</div>
                            <div className="mt-1 flex items-center justify-between text-xs text-[var(--ink-muted)]"><span>{basename(task.workspacePath)}</span><span>{new Date(task.updatedAt).toLocaleDateString()}</span></div>
                          </button>
                        ))}
                        {items.length === 0 && <p className="py-8 text-center text-xs text-[var(--ink-muted)]">{t('empty.noTasks')}</p>}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {view === 'memories' && (
              <section>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <input value={memoryQuery} onChange={event => setMemoryQuery(event.target.value)} placeholder={t('memories.search')} className="min-w-64 flex-1 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--paper-elevated)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ink)]" />
                  <CustomSelect
                    value={memoryKind}
                    onChange={value => setMemoryKind(value as 'all' | MemoryKind)}
                    size="toolbar"
                    options={[
                      { value: 'all', label: t('memories.allKinds') },
                      ...(['preference', 'fact', 'decision', 'goal', 'procedure', 'project_state'] as MemoryKind[]).map(value => ({ value, label: t(`memoryKinds.${value}`) })),
                    ]}
                  />
                </div>
                {memories.length === 0 ? (
                  <EmptyState icon={MemoryStick} text={t('empty.noMemories')} />
                ) : (
                  <div className="space-y-2">
                    {memories.map(memory => (
                      <article key={memory.id} className="rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-4 shadow-xs">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                              <span className="rounded-full bg-[var(--paper-inset)] px-2 py-0.5">{t(`memoryKinds.${memory.kind}`)}</span>
                              <span>{t(`memoryScopes.${memory.scope.kind}`)}</span>
                              <span>{new Date(memory.updatedAt).toLocaleString()}</span>
                              <span>{t('memories.sources', { count: memory.sourceRefs.length })}</span>
                            </div>
                            {editing?.id === memory.id ? (
                              <textarea value={editing.summary} onChange={event => setEditing({ id: memory.id, summary: event.target.value })} className="mt-3 min-h-24 w-full rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--paper)] p-3 text-base leading-relaxed outline-none focus:border-[var(--ink)]" />
                            ) : (
                              <p className="mt-3 text-base leading-relaxed">{memory.summary}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {editing?.id === memory.id ? (
                              <>
                                <button type="button" onClick={() => void saveMemoryEdit()} className="rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--success)] hover:bg-[var(--success-bg)]">{t('actions.save')}</button>
                                <button type="button" onClick={() => setEditing(null)} className="rounded-[var(--radius-md)] p-1.5 text-[var(--ink-muted)] hover:bg-[var(--paper-inset)]"><X className="h-4 w-4" /></button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => void pinMemory(memory.id, !memory.pinned).then(load)} className={`rounded-[var(--radius-md)] p-1.5 hover:bg-[var(--paper-inset)] ${memory.pinned ? 'text-[var(--accent)]' : 'text-[var(--ink-muted)]'}`} title={memory.pinned ? t('actions.unpin') : t('actions.pin')}><Pin className="h-4 w-4" /></button>
                                <button type="button" onClick={() => setEditing({ id: memory.id, summary: memory.summary })} className="rounded-[var(--radius-md)] p-1.5 text-[var(--ink-muted)] hover:bg-[var(--paper-inset)]" title={t('actions.edit')}><Pencil className="h-4 w-4" /></button>
                                <button type="button" onClick={() => { if (window.confirm(t('actions.deleteConfirm'))) void deleteMemory(memory.id).then(load); }} className="rounded-[var(--radius-md)] p-1.5 text-[var(--ink-muted)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]" title={t('actions.delete')}><Trash2 className="h-4 w-4" /></button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {memory.sourceRefs.slice(0, 3).map(source => (
                            <button key={source.id} type="button" onClick={() => openSession(source.sessionId, source.path ?? data.highlights.find(item => item.sessionId === source.sessionId)?.workspacePath)} className="flex items-center gap-1 rounded-full bg-[var(--paper-inset)] px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"><ExternalLink className="h-3 w-3" />{source.type}</button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {view === 'efficiency' && (
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  [BarChart3, t('efficiency.inputTokens'), formatNumber(data.metrics.inputTokens)],
                  [BarChart3, t('efficiency.outputTokens'), formatNumber(data.metrics.outputTokens)],
                  [Clock3, t('efficiency.duration'), formatDuration(data.metrics.durationMs)],
                  [Sparkles, t('efficiency.tools'), formatNumber(data.metrics.toolCount)],
                  [CheckCircle2, t('efficiency.completed'), formatNumber(data.metrics.completedTaskCount)],
                  [X, t('efficiency.blocked'), formatNumber(data.metrics.blockedTaskCount)],
                  [TrendingUp, t('efficiency.active'), formatNumber(data.metrics.activeTaskCount)],
                  [MessageSquare, t('efficiency.conversations'), formatNumber(data.metrics.conversationCount)],
                ].map(([Icon, label, value]) => {
                  const CardIcon = Icon as typeof BarChart3;
                  return <div key={String(label)} className="rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] p-5 shadow-xs"><CardIcon className="h-4 w-4 text-[var(--ink-muted)]" /><div className="mt-4 text-3xl font-semibold">{String(value)}</div><div className="mt-2 text-xs text-[var(--ink-muted)]">{String(label)}</div></div>;
                })}
              </section>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Archive; text: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-xl)] bg-[var(--paper-elevated)] text-center text-[var(--ink-muted)]">
      <Icon className="h-6 w-6" />
      <p className="mt-3 text-sm">{text}</p>
    </div>
  );
}
