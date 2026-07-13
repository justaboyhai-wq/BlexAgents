import AgentHubApplyDialog from '@/components/agent-hub/AgentHubApplyDialog';

interface TemplateApplyDialogProps {
  agentDir: string;
  onClose: () => void;
  onApplied?: () => void | Promise<void>;
}

/**
 * Compatibility facade for the System Prompts surface.
 *
 * Official AgentHub templates are intentionally separate from the legacy
 * Blex/user-template library. The Launcher keeps that existing library for
 * local template CRUD, while this entry presents only reviewed offline packs.
 */
export default function TemplateApplyDialog(props: TemplateApplyDialogProps) {
  return <AgentHubApplyDialog {...props} />;
}
