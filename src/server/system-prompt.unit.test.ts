import { describe, expect, it } from 'vitest';

import { buildSystemPromptAppend } from './system-prompt';

describe('buildSystemPromptAppend floating-ball surface', () => {
  it('adds floating-ball instructions only for the floating desktop surface', () => {
    expect(buildSystemPromptAppend({ type: 'desktop' })).not.toContain('<blexagent-floating-ball-instructions>');

    const prompt = buildSystemPromptAppend({ type: 'desktop', surface: 'floating-ball' });
    expect(prompt).toContain('<blexagent-floating-ball-instructions>');
    expect(prompt).toContain('BlexAgent desktop floating window');
    expect(prompt).toContain('Keep responses concise');
  });
});
