import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  applyAgentHubTemplate,
  createWorkspaceFromAgentHubTemplate,
  finalizeAgentHubWorkspace,
  getAgentHubCatalogue,
  previewAgentHubTemplateApply,
  rollbackAgentHubWorkspace,
} from './agentHub';

describe('AgentHub Tauri API', () => {
  beforeEach(() => invoke.mockReset());

  it('uses the dedicated catalogue and create commands', async () => {
    invoke.mockResolvedValue(undefined);

    await getAgentHubCatalogue();
    await createWorkspaceFromAgentHubTemplate('life-manager', '生活管家');

    expect(invoke).toHaveBeenNthCalledWith(1, 'cmd_agent_hub_get_catalogue');
    expect(invoke).toHaveBeenNthCalledWith(2, 'cmd_create_workspace_from_agent_hub_template', {
      templateId: 'life-manager',
      workspaceName: '生活管家',
    });
  });

  it('passes capability receipts and preview IDs without changing payloads', async () => {
    invoke.mockResolvedValue(undefined);

    await finalizeAgentHubWorkspace('receipt-1');
    await rollbackAgentHubWorkspace('receipt-2');
    await previewAgentHubTemplateApply('travel-planner', 'D:\\Agents\\travel');
    await applyAgentHubTemplate('preview-1');

    expect(invoke).toHaveBeenNthCalledWith(1, 'cmd_agent_hub_finalize_workspace', { receiptId: 'receipt-1' });
    expect(invoke).toHaveBeenNthCalledWith(2, 'cmd_agent_hub_rollback_workspace', { receiptId: 'receipt-2' });
    expect(invoke).toHaveBeenNthCalledWith(3, 'cmd_agent_hub_template_apply_preview', {
      templateId: 'travel-planner',
      workspacePath: 'D:\\Agents\\travel',
    });
    expect(invoke).toHaveBeenNthCalledWith(4, 'cmd_apply_agent_hub_template_to_workspace', {
      previewId: 'preview-1',
    });
  });
});
