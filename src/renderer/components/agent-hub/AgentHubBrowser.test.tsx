import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import type { AgentHubTemplateManifest } from '@/api/agentHub';
import { getAgentHubCatalogue } from '@/api/agentHub';
import { i18n } from '@/i18n';
import { openExternal } from '@/utils/openExternal';

import AgentHubBrowser from './AgentHubBrowser';

vi.mock('@/api/agentHub', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/agentHub')>();
  return { ...actual, getAgentHubCatalogue: vi.fn() };
});

vi.mock('@/utils/openExternal', () => ({ openExternal: vi.fn() }));

function template(index: number): AgentHubTemplateManifest {
  const life = index <= 6;
  return {
    id: life ? `life-${index}` : `creation-${index}`,
    version: '1.0.0',
    category: life ? 'life' : 'creation',
    icon: 'sparkle',
    name: {
      'zh-CN': life ? `生活模板 ${index}` : `创作模板 ${index}`,
      'en-US': life ? `Life template ${index}` : `Creation template ${index}`,
    },
    description: {
      'zh-CN': index === 7 ? '短内容与社媒规划' : `模板描述 ${index}`,
      'en-US': index === 7 ? 'Short content and social planning' : `Template description ${index}`,
    },
    capabilities: [
      { 'zh-CN': `能力 ${index}`, 'en-US': `Capability ${index}` },
      { 'zh-CN': '形成清晰计划', 'en-US': 'Build a clear plan' },
      { 'zh-CN': '给出可执行步骤', 'en-US': 'Provide actionable steps' },
    ],
    examples: [
      { 'zh-CN': `帮我开始任务 ${index}`, 'en-US': `Help me start task ${index}` },
      { 'zh-CN': '给我一个示例', 'en-US': 'Give me an example' },
      { 'zh-CN': '复盘我的结果', 'en-US': 'Review my result' },
    ],
    skills: [{
      id: `skill-${index}`,
      name: { 'zh-CN': `精选 Skill ${index}`, 'en-US': `Reviewed Skill ${index}` },
    }],
    risk: {
      level: 'low',
      boundary: { 'zh-CN': '仅基于用户提供的信息协助', 'en-US': 'Uses only information supplied by the user' },
    },
    sources: [{
      repository: 'natea/ExoMind',
      repositoryUrl: 'https://github.com/natea/ExoMind',
      commit: '8794d26d9a334ff386d0fe4b90b4919b95ac201a',
      paths: ['skills/example/SKILL.md'],
      licenseSpdx: 'MIT',
      licenseFile: 'licenses/ExoMind-LICENSE.txt',
      copyrightNotice: 'Copyright 2025',
      upstreamAuthor: 'Nate Aune',
      retrievedAt: '2026-07-13',
      includedFiles: ['SKILL.md'],
      excludedFiles: [],
      modifications: 'Adapted for offline use',
      sourceSha256: 'a'.repeat(64),
      licenseReviewStatus: 'approved',
      securityReviewStatus: 'approved',
      securityReviewNotes: 'Markdown only',
    }],
  };
}

const templates = Array.from({ length: 12 }, (_, index) => template(index + 1));

function BrowserHarness() {
  const [selected, setSelected] = useState<AgentHubTemplateManifest | null>(null);
  return (
    <AgentHubBrowser
      selectedId={selected?.id ?? null}
      onSelectionChange={setSelected}
    />
  );
}

describe('AgentHubBrowser', () => {
  beforeEach(async () => {
    vi.mocked(getAgentHubCatalogue).mockReset();
    vi.mocked(openExternal).mockReset();
    await i18n.changeLanguage('zh-CN');
  });

  it('renders exactly 12 reviewed cards and exposes detail provenance', async () => {
    vi.mocked(getAgentHubCatalogue).mockResolvedValue({ schemaVersion: 1, templates, errors: [] });
    render(<BrowserHarness />);

    const list = await screen.findByRole('list', { name: 'AgentHub' });
    expect(within(list).getAllByRole('button')).toHaveLength(12);
    expect(screen.getByText('主要能力')).toBeInTheDocument();
    expect(screen.getByText('精选 Skill 1')).toBeInTheDocument();
    expect(screen.getByText('“帮我开始任务 1”')).toBeInTheDocument();
    expect(screen.getByText('natea/ExoMind')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /natea\/ExoMind/ }));
    expect(openExternal).toHaveBeenCalledWith('https://github.com/natea/ExoMind');
  });

  it('searches across descriptions and filters life versus creation', async () => {
    vi.mocked(getAgentHubCatalogue).mockResolvedValue({ schemaVersion: 1, templates, errors: [] });
    render(<BrowserHarness />);
    const list = await screen.findByRole('list', { name: 'AgentHub' });
    expect(within(list).getByText('生活模板 1')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索模板、能力或 Skill'), {
      target: { value: '短内容' },
    });
    expect(within(list).getByText('创作模板 7')).toBeInTheDocument();
    expect(within(list).queryByText('生活模板 1')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索模板、能力或 Skill'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生活' }));
    expect(within(list).getAllByRole('button')).toHaveLength(6);
    expect(within(list).queryByText('创作模板 7')).not.toBeInTheDocument();
  });

  it('switches catalogue chrome and manifest content to English', async () => {
    await i18n.changeLanguage('en-US');
    vi.mocked(getAgentHubCatalogue).mockResolvedValue({ schemaVersion: 1, templates, errors: [] });
    render(<BrowserHarness />);

    const list = await screen.findByRole('list', { name: 'AgentHub' });
    expect(within(list).getByText('Life template 1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search templates, capabilities, or Skills')).toBeInTheDocument();
    expect(screen.getByText('Included Skills')).toBeInTheDocument();
  });

  it('keeps a visible error state and can retry without blanking the page', async () => {
    vi.mocked(getAgentHubCatalogue)
      .mockRejectedValueOnce(new Error('catalogue unavailable'))
      .mockResolvedValueOnce({ schemaVersion: 1, templates, errors: [] });
    render(<BrowserHarness />);

    expect(await screen.findByText('AgentHub 暂时无法加载')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    const list = await screen.findByRole('list', { name: 'AgentHub' });
    await waitFor(() => expect(within(list).getByText('生活模板 1')).toBeInTheDocument());
    expect(getAgentHubCatalogue).toHaveBeenCalledTimes(2);
  });
});
