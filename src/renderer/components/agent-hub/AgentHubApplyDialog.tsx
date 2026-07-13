import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, FilePlus, FileWarning, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  applyAgentHubTemplate,
  previewAgentHubTemplateApply,
  type AgentHubApplyPreview,
  type AgentHubTemplateManifest,
} from '@/api/agentHub';
import OverlayBackdrop from '@/components/OverlayBackdrop';
import { useToast } from '@/components/Toast';
import { useCloseLayer } from '@/hooks/useCloseLayer';

import AgentHubBrowser, { localizeAgentHubText } from './AgentHubBrowser';

interface AgentHubApplyDialogProps {
  agentDir: string;
  onClose: () => void;
  onApplied?: () => void | Promise<void>;
}

export default function AgentHubApplyDialog({
  agentDir,
  onClose,
  onApplied,
}: AgentHubApplyDialogProps) {
  const { t, i18n } = useTranslation('agenthub');
  const toast = useToast();
  const locale = i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN';
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentHubTemplateManifest | null>(null);
  const [preview, setPreview] = useState<AgentHubApplyPreview | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleClose = useCallback(() => {
    if (inFlightRef.current) return;
    onClose();
  }, [onClose]);
  useCloseLayer(() => {
    handleClose();
    return true;
  }, 220);

  const handleSelectionChange = useCallback((template: AgentHubTemplateManifest | null) => {
    setSelectedTemplate(template);
    setPreview(null);
    setError(null);
  }, []);

  const requestPreview = useCallback(async () => {
    if (!selectedTemplate || inFlightRef.current) return;
    inFlightRef.current = true;
    setInFlight(true);
    setError(null);
    try {
      const result = await previewAgentHubTemplateApply(selectedTemplate.id, agentDir);
      if (isMountedRef.current) setPreview(result);
    } catch (previewError) {
      console.error('[AgentHub] Failed to preview template apply:', previewError);
      if (isMountedRef.current) setError(t('common.unknownError'));
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setInFlight(false);
    }
  }, [agentDir, selectedTemplate, t]);

  const confirmApply = useCallback(async () => {
    if (!preview || preview.conflicts.length > 0 || inFlightRef.current) return;
    inFlightRef.current = true;
    setInFlight(true);
    setError(null);
    try {
      await applyAgentHubTemplate(preview.previewId);
    } catch (applyError) {
      console.error('[AgentHub] Failed to apply template:', applyError);
      if (isMountedRef.current) setError(t('common.unknownError'));
      inFlightRef.current = false;
      if (isMountedRef.current) setInFlight(false);
      return;
    }
    try {
      await onApplied?.();
    } catch (refreshError) {
      // The transactional backend apply has already committed. A renderer
      // refresh failure must not be presented as an apply failure or invite a
      // second merge attempt.
      console.error('[AgentHub] Template applied but workspace refresh failed:', refreshError);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setInFlight(false);
    }
    toast.success(t('apply.applied'));
    onClose();
  }, [onApplied, onClose, preview, t, toast]);

  return (
    <OverlayBackdrop onClose={handleClose} className="z-[220] p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenthub-apply-title"
        className="flex h-[min(860px,90vh)] w-[min(1180px,96vw)] flex-col overflow-hidden rounded-3xl bg-[var(--paper-elevated)] shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
          <div className="flex items-start gap-3">
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
                disabled={inFlight}
                aria-label={t('apply.back')}
                className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-inset)] hover:text-[var(--ink)] disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 id="agenthub-apply-title" className="text-lg font-semibold text-[var(--ink)]">
                {preview ? t('apply.confirmTitle') : t('apply.title')}
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                {preview ? t('apply.confirmDescription') : t('apply.description')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={inFlight}
            aria-label={t('close')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-inset)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 p-4">
          {preview ? (
            <ApplyPreviewPanel
              preview={preview}
              templateName={selectedTemplate ? localizeAgentHubText(selectedTemplate.name, locale) : ''}
            />
          ) : (
            <AgentHubBrowser
              selectedId={selectedTemplate?.id ?? null}
              onSelectionChange={handleSelectionChange}
              disabled={inFlight}
            />
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2 rounded-xl bg-[var(--error-bg)] px-3 py-2.5 text-sm text-[var(--error)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={inFlight}
            className="rounded-xl bg-[var(--button-secondary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-bg-hover)] disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          {preview ? (
            <button
              type="button"
              onClick={() => void confirmApply()}
              disabled={inFlight || preview.conflicts.length > 0 || (preview.add.length === 0 && preview.overwrite.length === 0)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inFlight && <Loader2 className="h-4 w-4 animate-spin" />}
              {inFlight ? t('apply.applying') : t('apply.action')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void requestPreview()}
              disabled={inFlight || !selectedTemplate}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inFlight && <Loader2 className="h-4 w-4 animate-spin" />}
              {inFlight ? t('apply.previewing') : t('apply.preview')}
            </button>
          )}
        </footer>
      </div>
    </OverlayBackdrop>
  );
}

function ApplyPreviewPanel({
  preview,
  templateName,
}: {
  preview: AgentHubApplyPreview;
  templateName: string;
}) {
  const { t } = useTranslation('agenthub');
  const hasChanges = preview.add.length > 0 || preview.overwrite.length > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl bg-[var(--paper)] p-6">
      <div className="rounded-2xl bg-[var(--paper-elevated)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--ink)]">{templateName}</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">v{preview.templateVersion}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <FileList
          icon={<FilePlus className="h-4 w-4 text-[var(--success)]" />}
          title={t('apply.add', { count: preview.add.length })}
          files={preview.add}
        />
        <FileList
          icon={<FileWarning className="h-4 w-4 text-[var(--warning)]" />}
          title={t('apply.overwrite', { count: preview.overwrite.length })}
          files={preview.overwrite}
        />
      </div>
      {preview.conflicts.length > 0 && (
        <div className="mt-4 rounded-2xl bg-[var(--error-bg)] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--error)]">
            <AlertCircle className="h-4 w-4" />
            {t('apply.conflicts', { count: preview.conflicts.length })}
          </h3>
          <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--error)]">
            {preview.conflicts.map(file => <li key={file}>{file}</li>)}
          </ul>
        </div>
      )}
      {!hasChanges && preview.conflicts.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-[var(--ink-muted)]">
          {t('apply.none')}
        </div>
      )}
    </div>
  );
}

function FileList({
  icon,
  title,
  files,
}: {
  icon: React.ReactNode;
  title: string;
  files: string[];
}) {
  return (
    <section className="min-w-0 rounded-2xl bg-[var(--paper-elevated)] p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        {icon}
        {title}
      </h3>
      {files.length > 0 ? (
        <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto font-mono text-xs text-[var(--ink-muted)]">
          {files.map(file => <li key={file} className="break-all rounded-lg bg-[var(--paper-inset)] px-2.5 py-1.5">{file}</li>)}
        </ul>
      ) : (
        <span className="mt-3 block text-xs text-[var(--ink-muted)]">—</span>
      )}
    </section>
  );
}
