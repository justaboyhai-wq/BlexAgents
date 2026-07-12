import { describe, expect, it, vi } from 'vitest';

vi.mock('./utils/cli-tools-registry', () => ({
  getUserToolsPromptSection: () => '<blexagent-user-tools>registered</blexagent-user-tools>',
}));

const { buildCliToolsAppend } = await import('./system-prompt-cli-tools');
const { IMAGE_UNDERSTANDING_TOOL_ID } = await import('../shared/official-tools');

describe('buildCliToolsAppend', () => {
  it('keeps stable CLI capabilities while user-registered tools are gated off', () => {
    const text = buildCliToolsAppend({ type: 'desktop' }, { includeUserTools: false });

    expect(text).toContain('<blexagent-cli-cron>');
    expect(text).toContain('<blexagent-cli-thought>');
    expect(text).not.toContain('<blexagent-user-tools>');
  });

  it('includes user-registered CLI tools only when explicitly enabled', () => {
    const text = buildCliToolsAppend({ type: 'desktop' }, { includeUserTools: true });

    expect(text).toContain('<blexagent-user-tools>registered</blexagent-user-tools>');
  });

  it('does not inject official image understanding by default', () => {
    const text = buildCliToolsAppend({ type: 'desktop' }, { includeUserTools: false });

    expect(text).not.toContain('<blexagent-cli-vision>');
  });

  it('injects official image understanding when the session enables it', () => {
    const text = buildCliToolsAppend(
      { type: 'desktop' },
      { includeUserTools: false, enabledOfficialToolIds: [IMAGE_UNDERSTANDING_TOOL_ID] },
    );

    expect(text).toContain('<blexagent-cli-vision>');
    expect(text).toContain('blexagent vision analyze');
    expect(text).toContain('--prompt-file');
    expect(text).toContain('[Unsupported Image]');
    expect(text).toContain('blexagent vision --help');
    expect(text).toContain('shell-sensitive');
    expect(text).toContain('user-provided');
  });
});
