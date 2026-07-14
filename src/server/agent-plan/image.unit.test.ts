import { describe, expect, it } from 'vitest';

import { parseAgentPlanImageResponse } from './image';

describe('Agent Plan image response', () => {
  it('keeps only valid HTTPS image URLs', () => {
    expect(parseAgentPlanImageResponse({
      data: [
        { url: 'https://example.com/a.png', size: '2048x2048' },
        { url: 'http://example.com/insecure.png' },
        { url: 'javascript:alert(1)' },
        { b64_json: 'ignored' },
      ],
    })).toEqual([{ url: 'https://example.com/a.png', size: '2048x2048' }]);
  });

  it('returns an empty list for malformed payloads', () => {
    expect(parseAgentPlanImageResponse(null)).toEqual([]);
    expect(parseAgentPlanImageResponse({ data: 'not-an-array' })).toEqual([]);
  });
});
