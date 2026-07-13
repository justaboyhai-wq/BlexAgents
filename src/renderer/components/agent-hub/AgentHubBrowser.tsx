import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  getAgentHubCatalogue,
  type AgentHubCategory,
  type AgentHubLocalizedText,
  type AgentHubTemplateManifest,
} from '@/api/agentHub';
import WorkspaceIcon from '@/components/launcher/WorkspaceIcon';
import { openExternal } from '@/utils/openExternal';

type CategoryFilter = 'all' | AgentHubCategory;

interface AgentHubBrowserProps {
  selectedId: string | null;
  onSelectionChange: (template: AgentHubTemplateManifest | null) => void;
  disabled?: boolean;
}

function useAgentHubLocale(): 'zh-CN' | 'en-US' {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN';
}

export function localizeAgentHubText(
  text: AgentHubLocalizedText,
  locale: 'zh-CN' | 'en-US',
): string {
  return text[locale] || text['zh-CN'] || text['en-US'];
}

export default function AgentHubBrowser({
  selectedId,
  onSelectionChange,
  disabled = false,
}: AgentHubBrowserProps) {
  const { t } = useTranslation('agenthub');
  const locale = useAgentHubLocale();
  const isMountedRef = useRef(true);
  const selectionCallbackRef = useRef(onSelectionChange);
  selectionCallbackRef.current = onSelectionChange;

  const [templates, setTemplates] = useState<AgentHubTemplateManifest[]>([]);
  const [catalogueErrors, setCatalogueErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [loadNonce, setLoadNonce] = useState(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    void getAgentHubCatalogue()
      .then((catalogue) => {
        if (cancelled || !isMountedRef.current) return;
        setTemplates(catalogue.templates);
        setCatalogueErrors(catalogue.errors);
        const current = catalogue.templates.find(template => template.id === selectedId);
        selectionCallbackRef.current(current ?? catalogue.templates[0] ?? null);
      })
      .catch((error) => {
        console.error('[AgentHub] Failed to load bundled catalogue:', error);
        if (cancelled || !isMountedRef.current) return;
        setTemplates([]);
        setCatalogueErrors([]);
        setLoadFailed(true);
        selectionCallbackRef.current(null);
      })
      .finally(() => {
        if (!cancelled && isMountedRef.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `selectedId` deliberately is not a dependency: selection changes must not
    // reload the immutable bundled catalogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadNonce]);

  const filteredTemplates = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    return templates.filter((template) => {
      if (category !== 'all' && template.category !== category) return false;
      if (!needle) return true;
      const searchable = [
        template.id,
        template.name['zh-CN'],
        template.name['en-US'],
        template.description['zh-CN'],
        template.description['en-US'],
        ...template.capabilities.flatMap(item => [item['zh-CN'], item['en-US']]),
        ...template.skills.flatMap(skill => [skill.id, skill.name['zh-CN'], skill.name['en-US']]),
      ].join('\n').toLocaleLowerCase(locale);
      return searchable.includes(needle);
    });
  }, [category, locale, search, templates]);

  const selectedTemplate = templates.find(template => template.id === selectedId) ?? null;

  const retry = useCallback(() => setLoadNonce(value => value + 1), []);

  if (loading) {
    return (
      <div className="flex min-h-[520px] flex-1 items-center justify-center rounded-2xl bg-[var(--paper)]">
        <div className="flex flex-col items-center gap-3 text-sm text-[var(--ink-muted)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-warm)]" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="flex min-h-[520px] flex-1 items-center justify-center rounded-2xl bg-[var(--paper)] px-6">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--error-bg)] text-[var(--error)]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[var(--ink)]">{t('loadFailedTitle')}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">{t('loadFailedDescription')}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-bg-hover)]"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <section className="flex min-w-0 flex-[1.45] flex-col overflow-hidden rounded-2xl bg-[var(--paper)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              disabled={disabled}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper-elevated)] py-2.5 pl-9 pr-3 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-muted)] focus:border-[var(--focus-border)] disabled:opacity-60"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-xl bg-[var(--paper-inset)] p-1">
              {(['all', 'life', 'creation'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  disabled={disabled}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === value
                      ? 'bg-[var(--paper-elevated)] text-[var(--ink)] shadow-sm'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {t(`category.${value}`)}
                </button>
              ))}
            </div>
            <span className="shrink-0 text-xs text-[var(--ink-muted)]">
              {t('templateCount', { count: templates.length })}
            </span>
          </div>
          {catalogueErrors.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t('partialCatalogue', { count: catalogueErrors.length })}</span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredTemplates.length === 0 ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <Search className="h-8 w-8 text-[var(--ink-muted)]/40" />
              <h3 className="mt-3 text-sm font-semibold text-[var(--ink)]">{t('emptyTitle')}</h3>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{t('emptyDescription')}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3" aria-label={t('title')}>
              {filteredTemplates.map((template) => {
                const active = template.id === selectedId;
                return (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => selectionCallbackRef.current(template)}
                      disabled={disabled}
                      aria-pressed={active}
                      className={`flex h-full min-h-32 w-full flex-col rounded-2xl border p-4 text-left transition-all disabled:opacity-60 ${
                        active
                          ? 'border-[var(--accent-warm)] bg-[var(--accent-warm-subtle)] shadow-sm'
                          : 'border-[var(--line)] bg-[var(--paper-elevated)] hover:-translate-y-px hover:border-[var(--line-strong)] hover:shadow-sm'
                      }`}
                    >
                      <div className="flex w-full items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--paper-inset)]">
                          <WorkspaceIcon icon={template.icon} size={22} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                            {localizeAgentHubText(template.name, locale)}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                            {t(`category.${template.category}`)}
                          </span>
                        </span>
                      </div>
                      <span className="mt-3 line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                        {localizeAgentHubText(template.description, locale)}
                      </span>
                      <span className="mt-auto flex items-center gap-2 pt-3 text-xs text-[var(--ink-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="h-3.5 w-3.5 text-[var(--success)]" />
                          {t('reviewed')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <WifiOff className="h-3.5 w-3.5" />
                          {t('offline')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <aside className="min-w-0 flex-1 overflow-y-auto rounded-2xl bg-[var(--paper)] p-5">
        {selectedTemplate ? (
          <div>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-warm-subtle)]">
                <WorkspaceIcon icon={selectedTemplate.icon} size={26} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-[var(--ink)]">
                  {localizeAgentHubText(selectedTemplate.name, locale)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {localizeAgentHubText(selectedTemplate.description, locale)}
                </p>
              </div>
            </div>

            <DetailSection icon={<Sparkles className="h-4 w-4" />} title={t('details.capabilities')}>
              <ul className="space-y-1.5">
                {selectedTemplate.capabilities.map((capability, index) => (
                  <li key={index} className="flex gap-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-warm)]" />
                    {localizeAgentHubText(capability, locale)}
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection icon={<BookOpen className="h-4 w-4" />} title={t('details.skills')}>
              <div className="flex flex-wrap gap-2">
                {selectedTemplate.skills.map(skill => (
                  <span key={skill.id} className="rounded-lg bg-[var(--paper-inset)] px-2.5 py-1.5 text-xs text-[var(--ink-secondary)]">
                    {localizeAgentHubText(skill.name, locale)}
                  </span>
                ))}
              </div>
            </DetailSection>

            <DetailSection icon={<Sparkles className="h-4 w-4" />} title={t('details.examples')}>
              <ul className="space-y-2">
                {selectedTemplate.examples.map((example, index) => (
                  <li key={index} className="rounded-xl bg-[var(--paper-elevated)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ink-secondary)]">
                    “{localizeAgentHubText(example, locale)}”
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection icon={<ShieldCheck className="h-4 w-4" />} title={t('details.risk')}>
              <p className="rounded-xl bg-[var(--success-bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ink-secondary)]">
                {localizeAgentHubText(selectedTemplate.risk.boundary, locale)}
              </p>
            </DetailSection>

            <DetailSection icon={<ExternalLink className="h-4 w-4" />} title={t('details.sources')}>
              <div className="space-y-2">
                {selectedTemplate.sources.map(source => (
                  <button
                    key={`${source.repository}:${source.commit}:${source.paths.join('|')}`}
                    type="button"
                    onClick={() => void openExternal(source.repositoryUrl)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-[var(--paper-elevated)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover-bg)]"
                    title={t('details.openSource')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--ink)]">{source.repository}</span>
                      <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                        {t('details.license', { license: source.licenseSpdx })} · {t('details.commit', { commit: source.commit.slice(0, 7) })}
                      </span>
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
                  </button>
                ))}
              </div>
            </DetailSection>
          </div>
        ) : (
          <div className="flex h-full min-h-64 items-center justify-center text-center text-sm leading-relaxed text-[var(--ink-muted)]">
            {t('details.selectHint')}
          </div>
        )}
      </aside>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-[var(--line)] pt-4">
      <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        <span className="text-[var(--accent-warm)]">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}
