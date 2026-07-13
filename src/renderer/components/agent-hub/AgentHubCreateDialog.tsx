import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  createWorkspaceFromAgentHubTemplate,
  finalizeAgentHubWorkspace,
  rollbackAgentHubWorkspace,
  type AgentHubTemplateManifest,
  type AgentHubWorkspaceReceipt,
} from '@/api/agentHub';
import type { WorkspaceTemplate } from '@/config/types';
import {
  getProjectRegistrationCompensationRecovery,
  type RetryProjectRegistrationCompensation,
} from '@/config/services/projectRegistrationService';
import OverlayBackdrop from '@/components/OverlayBackdrop';
import { useToast } from '@/components/Toast';
import { useCloseLayer } from '@/hooks/useCloseLayer';

import AgentHubBrowser, { localizeAgentHubText } from './AgentHubBrowser';

interface AgentHubCreateDialogProps {
  onCreateWorkspace: (
    path: string,
    template: WorkspaceTemplate,
    displayName?: string,
  ) => Promise<void>;
  onClose: () => void;
}

interface PendingRollbackRecovery {
  receipt: AgentHubWorkspaceReceipt;
  retryConfigCompensation: RetryProjectRegistrationCompensation | null;
}

export default function AgentHubCreateDialog({
  onCreateWorkspace,
  onClose,
}: AgentHubCreateDialogProps) {
  const { t, i18n } = useTranslation('agenthub');
  const toast = useToast();
  const locale = i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN';
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentHubTemplateManifest | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFinalize, setPendingFinalize] = useState<AgentHubWorkspaceReceipt | null>(null);
  const [pendingRollback, setPendingRollback] = useState<PendingRollbackRecovery | null>(null);
  const hasPendingReceipt = !!pendingFinalize || !!pendingRollback;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleClose = useCallback(() => {
    // A retained receipt must stay reachable until finalize or rollback
    // succeeds. Closing here would strand backend capability state without a
    // recovery path in the UI.
    if (inFlightRef.current || hasPendingReceipt) return;
    onClose();
  }, [hasPendingReceipt, onClose]);
  useCloseLayer(() => {
    handleClose();
    return true;
  }, 220);

  const handleSelectionChange = useCallback((template: AgentHubTemplateManifest | null) => {
    setSelectedTemplate(template);
    setWorkspaceName(template ? localizeAgentHubText(template.name, locale) : '');
    setError(null);
  }, [locale]);

  const finishSuccess = useCallback(() => {
    toast.success(t('create.created'));
    onClose();
  }, [onClose, t, toast]);

  const handleRetryFinalize = useCallback(async () => {
    if (!pendingFinalize || inFlightRef.current) return;
    inFlightRef.current = true;
    setInFlight(true);
    setError(null);
    try {
      await finalizeAgentHubWorkspace(pendingFinalize.receiptId);
      finishSuccess();
    } catch (finalizeError) {
      console.error('[AgentHub] Failed to finalize created workspace:', finalizeError);
      if (isMountedRef.current) setError(t('create.finalizeRetry'));
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setInFlight(false);
    }
  }, [finishSuccess, pendingFinalize, t]);

  const handleRetryRollback = useCallback(async () => {
    if (!pendingRollback || inFlightRef.current) return;
    inFlightRef.current = true;
    setInFlight(true);
    setError(null);
    try {
      if (pendingRollback.retryConfigCompensation) {
        await pendingRollback.retryConfigCompensation();
        if (isMountedRef.current) {
          setPendingRollback({
            receipt: pendingRollback.receipt,
            retryConfigCompensation: null,
          });
        }
      }
      await rollbackAgentHubWorkspace(pendingRollback.receipt.receiptId);
      if (isMountedRef.current) {
        setPendingRollback(null);
        setError(null);
      }
    } catch (recoveryError) {
      console.error('[AgentHub] Failed to recover workspace creation:', recoveryError);
      if (isMountedRef.current) setError(t('create.recoveryRetry'));
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setInFlight(false);
    }
  }, [pendingRollback, t]);

  const handleCreate = useCallback(async () => {
    const name = workspaceName.trim();
    if (!selectedTemplate || !name || inFlightRef.current) return;
    inFlightRef.current = true;
    setInFlight(true);
    setError(null);
    let receipt: AgentHubWorkspaceReceipt | null = null;
    let registered = false;
    try {
      receipt = await createWorkspaceFromAgentHubTemplate(selectedTemplate.id, name);
      const workspaceTemplate: WorkspaceTemplate = {
        id: selectedTemplate.id,
        name: localizeAgentHubText(selectedTemplate.name, locale),
        description: localizeAgentHubText(selectedTemplate.description, locale),
        icon: selectedTemplate.icon,
        isBuiltin: true,
      };
      await onCreateWorkspace(receipt.path, workspaceTemplate, name);
      registered = true;
      try {
        await finalizeAgentHubWorkspace(receipt.receiptId);
      } catch (finalizeError) {
        console.error('[AgentHub] Failed to finalize created workspace:', finalizeError);
        if (isMountedRef.current) {
          setPendingFinalize(receipt);
          setError(t('create.finalizeRetry'));
        }
        return;
      }
      finishSuccess();
    } catch (createError) {
      console.error('[AgentHub] Failed to create workspace:', createError);
      if (receipt && !registered) {
        const retryConfigCompensation = getProjectRegistrationCompensationRecovery(createError);
        if (retryConfigCompensation) {
          if (isMountedRef.current) {
            setPendingRollback({ receipt, retryConfigCompensation });
            setError(t('create.recoveryRetry'));
          }
          return;
        }
        try {
          await rollbackAgentHubWorkspace(receipt.receiptId);
        } catch (rollbackError) {
          console.error('[AgentHub] Failed to roll back workspace creation:', rollbackError);
          if (isMountedRef.current) {
            setPendingRollback({ receipt, retryConfigCompensation: null });
            setError(t('create.recoveryRetry'));
          }
          return;
        }
      }
      if (isMountedRef.current) setError(t('common.unknownError'));
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setInFlight(false);
    }
  }, [finishSuccess, locale, onCreateWorkspace, selectedTemplate, t, workspaceName]);

  return (
    <OverlayBackdrop onClose={handleClose} className="z-[220] p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenthub-create-title"
        className="flex h-[min(860px,90vh)] w-[min(1180px,96vw)] flex-col overflow-hidden rounded-3xl bg-[var(--paper-elevated)] shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 id="agenthub-create-title" className="text-lg font-semibold text-[var(--ink)]">{t('create.title')}</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">{t('create.description')}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={inFlight || hasPendingReceipt}
            aria-label={t('close')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper-inset)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 p-4">
          <AgentHubBrowser
            selectedId={selectedTemplate?.id ?? null}
            onSelectionChange={handleSelectionChange}
            disabled={inFlight || hasPendingReceipt}
          />
        </div>

        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2 rounded-xl bg-[var(--error-bg)] px-3 py-2.5 text-sm text-[var(--error)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <footer className="flex items-end justify-between gap-4 border-t border-[var(--line)] px-6 py-4">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">{t('create.agentName')}</span>
            <input
              type="text"
              value={workspaceName}
              onChange={event => setWorkspaceName(event.target.value.replace(/[/\\]/g, ''))}
              disabled={inFlight || hasPendingReceipt}
              placeholder={t('create.agentNamePlaceholder')}
              className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-muted)] focus:border-[var(--focus-border)] disabled:opacity-60"
            />
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={inFlight || hasPendingReceipt}
              className="rounded-xl bg-[var(--button-secondary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--button-secondary-bg-hover)] disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            {pendingFinalize ? (
              <button
                type="button"
                onClick={() => void handleRetryFinalize()}
                disabled={inFlight}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-bg-hover)] disabled:opacity-50"
              >
                {inFlight && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('create.retryFinalize')}
              </button>
            ) : pendingRollback ? (
              <button
                type="button"
                onClick={() => void handleRetryRollback()}
                disabled={inFlight}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-bg-hover)] disabled:opacity-50"
              >
                {inFlight && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('create.retryRecovery')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={inFlight || !selectedTemplate || !workspaceName.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inFlight ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {inFlight ? t('create.creating') : t('create.action')}
              </button>
            )}
          </div>
        </footer>
      </div>
    </OverlayBackdrop>
  );
}
