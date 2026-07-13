import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyAgentHubTemplate,
  createWorkspaceFromAgentHubTemplate,
  finalizeAgentHubWorkspace,
  getAgentHubCatalogue,
  previewAgentHubTemplateApply,
  rollbackAgentHubWorkspace,
  type AgentHubTemplateManifest,
} from '@/api/agentHub';
import { ToastProvider } from '@/components/Toast';
import { i18n } from '@/i18n';
import { ProjectRegistrationCompensationError } from '@/config/services/projectRegistrationService';

import AgentHubApplyDialog from './AgentHubApplyDialog';
import AgentHubCreateDialog from './AgentHubCreateDialog';

vi.mock('@/api/agentHub', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/agentHub')>();
  return {
    ...actual,
    applyAgentHubTemplate: vi.fn(),
    createWorkspaceFromAgentHubTemplate: vi.fn(),
    finalizeAgentHubWorkspace: vi.fn(),
    getAgentHubCatalogue: vi.fn(),
    previewAgentHubTemplateApply: vi.fn(),
    rollbackAgentHubWorkspace: vi.fn(),
  };
});

vi.mock('@/utils/openExternal', () => ({ openExternal: vi.fn() }));

const template: AgentHubTemplateManifest = {
  id: 'life-manager',
  version: '1.0.0',
  category: 'life',
  icon: 'sparkle',
  name: { 'zh-CN': '生活管家', 'en-US': 'Life Manager' },
  description: { 'zh-CN': '整理生活事项', 'en-US': 'Organize daily life' },
  capabilities: [
    { 'zh-CN': '整理事项', 'en-US': 'Organize tasks' },
    { 'zh-CN': '制定计划', 'en-US': 'Make plans' },
    { 'zh-CN': '定期复盘', 'en-US': 'Review progress' },
  ],
  examples: [
    { 'zh-CN': '规划今天', 'en-US': 'Plan today' },
    { 'zh-CN': '整理清单', 'en-US': 'Organize a list' },
    { 'zh-CN': '回顾本周', 'en-US': 'Review this week' },
  ],
  skills: [{ id: 'life-planning', name: { 'zh-CN': '生活规划', 'en-US': 'Life Planning' } }],
  risk: {
    level: 'low',
    boundary: { 'zh-CN': '不主动监控', 'en-US': 'No active monitoring' },
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
    modifications: 'Adapted',
    sourceSha256: 'a'.repeat(64),
    licenseReviewStatus: 'approved',
    securityReviewStatus: 'approved',
    securityReviewNotes: 'Markdown only',
  }],
};

function renderWithToast(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

describe('AgentHub create and apply dialogs', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('zh-CN');
    vi.mocked(getAgentHubCatalogue).mockResolvedValue({
      schemaVersion: 1,
      templates: [template],
      errors: [],
    });
  });

  it('registers a created Agent and finalizes its capability receipt', async () => {
    const onCreateWorkspace = vi.fn(async () => undefined);
    const onClose = vi.fn();
    vi.mocked(createWorkspaceFromAgentHubTemplate).mockResolvedValue({
      path: 'D:\\Agents\\life-manager',
      isNew: true,
      receiptId: 'receipt-success',
      templateId: template.id,
      templateVersion: template.version,
    });
    vi.mocked(finalizeAgentHubWorkspace).mockResolvedValue();
    renderWithToast(<AgentHubCreateDialog onCreateWorkspace={onCreateWorkspace} onClose={onClose} />);

    await screen.findByDisplayValue('生活管家');
    fireEvent.click(screen.getByRole('button', { name: '创建 Agent' }));

    await waitFor(() => expect(onCreateWorkspace).toHaveBeenCalledWith(
      'D:\\Agents\\life-manager',
      expect.objectContaining({ id: 'life-manager', isBuiltin: true }),
      '生活管家',
    ));
    expect(finalizeAgentHubWorkspace).toHaveBeenCalledWith('receipt-success');
    expect(rollbackAgentHubWorkspace).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rolls back the new directory when config registration fails', async () => {
    const onCreateWorkspace = vi.fn(async () => { throw new Error('config write failed'); });
    vi.mocked(createWorkspaceFromAgentHubTemplate).mockResolvedValue({
      path: 'D:\\Agents\\rollback-me',
      isNew: true,
      receiptId: 'receipt-rollback',
      templateId: template.id,
      templateVersion: template.version,
    });
    vi.mocked(rollbackAgentHubWorkspace).mockResolvedValue();
    renderWithToast(<AgentHubCreateDialog onCreateWorkspace={onCreateWorkspace} onClose={vi.fn()} />);

    await screen.findByDisplayValue('生活管家');
    fireEvent.click(screen.getByRole('button', { name: '创建 Agent' }));

    await waitFor(() => expect(rollbackAgentHubWorkspace).toHaveBeenCalledWith('receipt-rollback'));
    expect(finalizeAgentHubWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText('操作失败，请重试。')).toBeInTheDocument();
  });

  it('retains the receipt and retries config compensation before rolling back the directory', async () => {
    const retryCompensation = vi.fn()
      .mockRejectedValueOnce(new Error('config still locked'))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    const onCreateWorkspace = vi.fn(async () => {
      throw new ProjectRegistrationCompensationError(
        new Error('agent binding failed'),
        [new Error('agent cleanup failed')],
        retryCompensation,
      );
    });
    vi.mocked(createWorkspaceFromAgentHubTemplate).mockResolvedValue({
      path: 'D:\\Agents\\preserve-me',
      isNew: true,
      receiptId: 'receipt-preserve',
      templateId: template.id,
      templateVersion: template.version,
    });
    vi.mocked(rollbackAgentHubWorkspace).mockResolvedValue();
    renderWithToast(<AgentHubCreateDialog onCreateWorkspace={onCreateWorkspace} onClose={onClose} />);

    await screen.findByDisplayValue('生活管家');
    fireEvent.click(screen.getByRole('button', { name: '创建 Agent' }));

    await waitFor(() => expect(onCreateWorkspace).toHaveBeenCalled());
    expect(rollbackAgentHubWorkspace).not.toHaveBeenCalled();
    expect(finalizeAgentHubWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText('创建未完成，请先重试恢复后再继续。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭 AgentHub' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '创建 Agent' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '恢复并重试' }));
    await waitFor(() => expect(retryCompensation).toHaveBeenCalledTimes(1));
    expect(rollbackAgentHubWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '关闭 AgentHub' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '恢复并重试' }));
    await waitFor(() => expect(rollbackAgentHubWorkspace).toHaveBeenCalledWith('receipt-preserve'));
    expect(retryCompensation).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole('button', { name: '创建 Agent' })).toBeEnabled());
    expect(screen.getByRole('button', { name: '关闭 AgentHub' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('retains the receipt and blocks close when backend rollback fails', async () => {
    const onClose = vi.fn();
    const onCreateWorkspace = vi.fn(async () => { throw new Error('config write failed'); });
    vi.mocked(createWorkspaceFromAgentHubTemplate).mockResolvedValue({
      path: 'D:\\Agents\\retry-rollback',
      isNew: true,
      receiptId: 'receipt-retry-rollback',
      templateId: template.id,
      templateVersion: template.version,
    });
    vi.mocked(rollbackAgentHubWorkspace)
      .mockRejectedValueOnce(new Error('rollback unavailable'))
      .mockResolvedValueOnce();
    renderWithToast(<AgentHubCreateDialog onCreateWorkspace={onCreateWorkspace} onClose={onClose} />);

    await screen.findByDisplayValue('生活管家');
    fireEvent.click(screen.getByRole('button', { name: '创建 Agent' }));

    expect(await screen.findByText('创建未完成，请先重试恢复后再继续。')).toBeInTheDocument();
    expect(rollbackAgentHubWorkspace).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '关闭 AgentHub' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '恢复并重试' }));
    await waitFor(() => expect(rollbackAgentHubWorkspace).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: '创建 Agent' })).toBeEnabled());
    expect(screen.getByRole('button', { name: '关闭 AgentHub' })).toBeEnabled();
  });

  it('keeps a failed finalize receipt in a blocking retry state', async () => {
    const onClose = vi.fn();
    vi.mocked(createWorkspaceFromAgentHubTemplate).mockResolvedValue({
      path: 'D:\\Agents\\needs-finalize',
      isNew: true,
      receiptId: 'receipt-finalize',
      templateId: template.id,
      templateVersion: template.version,
    });
    vi.mocked(finalizeAgentHubWorkspace)
      .mockRejectedValueOnce(new Error('temporary finalize failure'))
      .mockResolvedValueOnce();
    renderWithToast(<AgentHubCreateDialog onCreateWorkspace={vi.fn(async () => undefined)} onClose={onClose} />);

    await screen.findByDisplayValue('生活管家');
    fireEvent.click(screen.getByRole('button', { name: '创建 Agent' }));
    expect(await screen.findByText('Agent 已加入，但安装确认未完成。请重试以安全结束安装。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭 AgentHub' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '完成安装' }));
    await waitFor(() => expect(finalizeAgentHubWorkspace).toHaveBeenCalledTimes(2));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('previews add/overwrite sets and treats apply as successful even if refresh fails', async () => {
    const onClose = vi.fn();
    const onApplied = vi.fn(async () => { throw new Error('refresh failed'); });
    vi.mocked(previewAgentHubTemplateApply).mockResolvedValue({
      previewId: 'preview-1',
      templateId: template.id,
      templateVersion: template.version,
      add: ['INTRODUCTION.md'],
      overwrite: ['CLAUDE.md'],
      conflicts: [],
    });
    vi.mocked(applyAgentHubTemplate).mockResolvedValue({
      add: ['INTRODUCTION.md'],
      overwrite: ['CLAUDE.md'],
    });
    renderWithToast(
      <AgentHubApplyDialog
        agentDir="D:\\Agents\\current"
        onClose={onClose}
        onApplied={onApplied}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: '预览变更' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '预览变更' }));
    expect(await screen.findByText('新增 1 个文件')).toBeInTheDocument();
    expect(screen.getByText('INTRODUCTION.md')).toBeInTheDocument();
    expect(screen.getByText('CLAUDE.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '应用到当前 Agent' }));

    await waitFor(() => expect(applyAgentHubTemplate).toHaveBeenCalledWith('preview-1'));
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('操作失败，请重试。')).not.toBeInTheDocument();
  });

  it('disables every close path while an apply transaction is in flight', async () => {
    const onClose = vi.fn();
    let resolveApply: ((value: { add: string[]; overwrite: string[] }) => void) | undefined;
    vi.mocked(previewAgentHubTemplateApply).mockResolvedValue({
      previewId: 'preview-blocking',
      templateId: template.id,
      templateVersion: template.version,
      add: ['CLAUDE.md'],
      overwrite: [],
      conflicts: [],
    });
    vi.mocked(applyAgentHubTemplate).mockReturnValue(new Promise(resolve => {
      resolveApply = resolve;
    }));
    renderWithToast(<AgentHubApplyDialog agentDir="D:\\Agents\\current" onClose={onClose} />);

    await waitFor(() => expect(screen.getByRole('button', { name: '预览变更' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '预览变更' }));
    await screen.findByText('新增 1 个文件');
    fireEvent.click(screen.getByRole('button', { name: '应用到当前 Agent' }));

    expect(screen.getByRole('button', { name: '关闭 AgentHub' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolveApply?.({ add: ['CLAUDE.md'], overwrite: [] });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
