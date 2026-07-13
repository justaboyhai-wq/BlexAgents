import { invoke } from '@tauri-apps/api/core';

export interface AgentHubLocalizedText {
  'zh-CN': string;
  'en-US': string;
}
export interface AgentHubSkillSummary {
  id: string;
  name: AgentHubLocalizedText;
}

export interface AgentHubRiskSummary {
  level: string;
  boundary: AgentHubLocalizedText;
}

export interface AgentHubSourceAttribution {
  repository: string;
  repositoryUrl: string;
  commit: string;
  paths: string[];
  licenseSpdx: string;
  licenseFile: string;
  copyrightNotice: string;
  upstreamAuthor: string;
  retrievedAt: string;
  includedFiles: string[];
  excludedFiles: string[];
  modifications: string;
  sourceSha256: string;
  licenseReviewStatus: string;
  securityReviewStatus: string;
  securityReviewNotes: string;
}

export type AgentHubCategory = 'life' | 'creation';

export interface AgentHubTemplateManifest {
  id: string;
  version: string;
  category: AgentHubCategory;
  icon: string;
  name: AgentHubLocalizedText;
  description: AgentHubLocalizedText;
  capabilities: AgentHubLocalizedText[];
  examples: AgentHubLocalizedText[];
  skills: AgentHubSkillSummary[];
  risk: AgentHubRiskSummary;
  sources: AgentHubSourceAttribution[];
}

export interface AgentHubCatalogueResponse {
  schemaVersion: number;
  templates: AgentHubTemplateManifest[];
  errors: string[];
}

export interface AgentHubWorkspaceReceipt {
  path: string;
  isNew: boolean;
  receiptId: string;
  templateId: string;
  templateVersion: string;
}

export interface AgentHubApplyPreview {
  previewId: string;
  templateId: string;
  templateVersion: string;
  add: string[];
  overwrite: string[];
  conflicts: string[];
}

export interface AgentHubApplyResult {
  add: string[];
  overwrite: string[];
}

export function getAgentHubCatalogue(): Promise<AgentHubCatalogueResponse> {
  return invoke('cmd_agent_hub_get_catalogue');
}

export function createWorkspaceFromAgentHubTemplate(
  templateId: string,
  workspaceName: string,
): Promise<AgentHubWorkspaceReceipt> {
  return invoke('cmd_create_workspace_from_agent_hub_template', {
    templateId,
    workspaceName,
  });
}

export function finalizeAgentHubWorkspace(receiptId: string): Promise<void> {
  return invoke('cmd_agent_hub_finalize_workspace', { receiptId });
}

export function rollbackAgentHubWorkspace(receiptId: string): Promise<void> {
  return invoke('cmd_agent_hub_rollback_workspace', { receiptId });
}

export function previewAgentHubTemplateApply(
  templateId: string,
  workspacePath: string,
): Promise<AgentHubApplyPreview> {
  return invoke('cmd_agent_hub_template_apply_preview', {
    templateId,
    workspacePath,
  });
}

export function applyAgentHubTemplate(previewId: string): Promise<AgentHubApplyResult> {
  return invoke('cmd_apply_agent_hub_template_to_workspace', { previewId });
}
