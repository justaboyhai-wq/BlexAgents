import { Database, Download, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  backfillMemoryHub,
  clearMemoryHub,
  exportMemoryHub,
  getMemoryHubStatus,
  rebuildMemoryHub,
  updateMemoryHubConfig,
} from '@/api/memoryHubClient';
import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import type { MemoryHubConfig, MemoryHubStatus } from '../../shared/types/memory-hub';

type BusyAction = 'save' | 'rebuild' | 'backfill' | 'export' | 'clear' | null;

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--toggle-thumb)] shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function MemoryHubSettings() {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const [status, setStatus] = useState<MemoryHubStatus | null>(null);
  const [config, setConfig] = useState<MemoryHubConfig | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getMemoryHubStatus();
      setStatus(next);
      setConfig(next.config);
      setError(null);
    } catch (reason) {
      setError(String(reason));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (patch: Partial<MemoryHubConfig>) => {
    if (!config) return;
    const previous = config;
    const next = { ...config, ...patch };
    setConfig(next);
    setBusy('save');
    try {
      const saved = await updateMemoryHubConfig(next);
      setConfig(saved);
      await load();
      setError(null);
    } catch (reason) {
      setConfig(previous);
      toast.error(t('memoryHub.toasts.saveFailed', { message: String(reason) }));
    } finally {
      setBusy(null);
    }
  };

  const run = async (action: Exclude<BusyAction, 'save' | null>) => {
    setBusy(action);
    try {
      if (action === 'rebuild') {
        setStatus(await rebuildMemoryHub());
        toast.success(t('memoryHub.toasts.rebuilt'));
      } else if (action === 'backfill') {
        setStatus(await backfillMemoryHub(config?.backfillDays));
        toast.success(t('memoryHub.toasts.backfilled'));
      } else if (action === 'export') {
        const { save: chooseDestination } = await import('@tauri-apps/plugin-dialog');
        const destinationPath = await chooseDestination({
          defaultPath: `blexagent-memory-hub-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!destinationPath) return;
        await exportMemoryHub(destinationPath);
        toast.success(t('memoryHub.toasts.exported'));
      } else {
        if (!window.confirm(t('memoryHub.clearConfirm'))) return;
        await clearMemoryHub();
        toast.success(t('memoryHub.toasts.cleared'));
        await load();
      }
      setError(null);
    } catch (reason) {
      toast.error(t('memoryHub.toasts.operationFailed', { message: String(reason) }));
    } finally {
      setBusy(null);
    }
  };

  if (!config) {
    return <div className="flex min-h-48 items-center justify-center text-[var(--ink-muted)]"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const toggleRows = [
    ['captureEnabled', 'memoryHub.captureTitle', 'memoryHub.captureDescription'],
    ['recallEnabled', 'memoryHub.recallTitle', 'memoryHub.recallDescription'],
    ['userScopeEnabled', 'memoryHub.userScopeTitle', 'memoryHub.userScopeDescription'],
    ['workspaceScopeEnabled', 'memoryHub.workspaceScopeTitle', 'memoryHub.workspaceScopeDescription'],
    ['agentScopeEnabled', 'memoryHub.agentScopeTitle', 'memoryHub.agentScopeDescription'],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <div>
        <div className="flex items-center gap-2"><Database className="h-5 w-5 text-[var(--accent)]" /><h2 className="text-lg font-semibold text-[var(--ink)]">{t('memoryHub.title')}</h2></div>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">{t('memoryHub.description')}</p>
      </div>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-elevated)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div><h3 className="text-base font-medium text-[var(--ink)]">{t('memoryHub.enableTitle')}</h3><p className="mt-1 text-xs text-[var(--ink-muted)]">{t('memoryHub.enableDescription')}</p></div>
          <Toggle checked={config.enabled} disabled={busy !== null} onChange={() => void save({ enabled: !config.enabled })} />
        </div>
        <div className="mt-5 space-y-4 border-t border-[var(--line)] pt-5">
          {toggleRows.map(([key, title, description]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-medium text-[var(--ink)]">{t(title)}</p><p className="mt-0.5 text-xs text-[var(--ink-muted)]">{t(description)}</p></div>
              <Toggle checked={config[key]} disabled={!config.enabled || busy !== null} onChange={() => void save({ [key]: !config[key] })} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-elevated)] p-5">
        <h3 className="text-base font-medium text-[var(--ink)]">{t('memoryHub.backendTitle')}</h3>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">{t('memoryHub.backendDescription')}</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-sm text-[var(--ink-secondary)]">{t('memoryHub.backendLabel')}</span>
          <CustomSelect value={config.backend} options={[{ value: 'local', label: t('memoryHub.backendLocal') }, { value: 'mem0', label: t('memoryHub.backendMem0') }]} onChange={(value) => void save({ backend: value as MemoryHubConfig['backend'] })} className="w-56" />
        </div>
        {config.backend === 'mem0' && (
          <label className="mt-4 block">
            <span className="text-sm text-[var(--ink-secondary)]">{t('memoryHub.mem0Url')}</span>
            <input value={config.mem0BaseUrl ?? ''} onChange={(event) => setConfig({ ...config, mem0BaseUrl: event.target.value })} onBlur={() => void save({ mem0BaseUrl: config.mem0BaseUrl?.trim() || null })} placeholder="http://127.0.0.1:8000" className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--focus-border)]" />
            <span className="mt-1 block text-xs text-[var(--ink-muted)]">{t('memoryHub.mem0Hint')}</span>
          </label>
        )}
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-elevated)] p-5">
        <h3 className="text-base font-medium text-[var(--ink)]">{t('memoryHub.statusTitle')}</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['activityCount', status?.activityCount ?? 0], ['memoryCount', status?.memoryCount ?? 0], ['artifactCount', status?.artifactCount ?? 0], ['indexedSessionCount', status?.indexedSessionCount ?? 0]] as const).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[var(--paper-inset)] px-3 py-3"><div className="text-xl font-semibold text-[var(--ink)]">{value}</div><div className="mt-1 text-xs text-[var(--ink-muted)]">{t(`memoryHub.metrics.${label}`)}</div></div>
          ))}
        </div>
        <dl className="mt-4 space-y-2 text-xs text-[var(--ink-muted)]">
          <div className="flex gap-2"><dt>{t('memoryHub.rootDir')}</dt><dd className="min-w-0 break-all text-[var(--ink-secondary)]">{status?.rootDir ?? '—'}</dd></div>
          <div className="flex gap-2"><dt>{t('memoryHub.lastReconciled')}</dt><dd className="text-[var(--ink-secondary)]">{status?.lastReconciledAt ? new Date(status.lastReconciledAt).toLocaleString() : '—'}</dd></div>
          <div className="flex gap-2"><dt>{t('memoryHub.backendHealth')}</dt><dd className={status?.backendHealthy ? 'text-emerald-600' : 'text-amber-600'}>{status?.backendHealthy ? t('memoryHub.healthy') : t('memoryHub.unavailable')}</dd></div>
        </dl>
        {(error || status?.lastError) && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error ?? status?.lastError}</p>}
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-elevated)] p-5">
        <h3 className="text-base font-medium text-[var(--ink)]">{t('memoryHub.maintenanceTitle')}</h3>
        <div className="mt-4 flex items-end gap-3">
          <label className="flex-1"><span className="text-xs text-[var(--ink-muted)]">{t('memoryHub.backfillDays')}</span><input type="number" min={1} max={3650} value={config.backfillDays} onChange={(event) => setConfig({ ...config, backfillDays: Math.max(1, Math.min(3650, Number(event.target.value) || 1)) })} onBlur={() => void save({ backfillDays: config.backfillDays })} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--focus-border)]" /></label>
          <button type="button" disabled={busy !== null} onClick={() => void run('backfill')} className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-inset)] disabled:opacity-50">{busy === 'backfill' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}{t('memoryHub.backfill')}</button>
          <button type="button" disabled={busy !== null} onClick={() => void run('rebuild')} className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-inset)] disabled:opacity-50">{busy === 'rebuild' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t('memoryHub.rebuild')}</button>
          <button type="button" disabled={busy !== null} onClick={() => void run('export')} className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper-inset)] disabled:opacity-50">{busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('memoryHub.export')}</button>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-5">
          <div><p className="text-sm font-medium text-[var(--ink)]">{t('memoryHub.clearTitle')}</p><p className="text-xs text-[var(--ink-muted)]">{t('memoryHub.clearDescription')}</p></div>
          <button type="button" disabled={busy !== null} onClick={() => void run('clear')} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" />{t('memoryHub.clear')}</button>
        </div>
      </section>
    </div>
  );
}
