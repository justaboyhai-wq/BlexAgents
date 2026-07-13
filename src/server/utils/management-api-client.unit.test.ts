import { afterEach, describe, expect, it } from 'vitest';

import { MANAGEMENT_TOKEN_HEADER, managementApiHeaders } from './management-api-client';

describe('managementApiHeaders', () => {
  afterEach(() => {
    delete process.env.BLEXAGENT_MANAGEMENT_TOKEN;
  });

  it('adds the inherited capability token when available', () => {
    process.env.BLEXAGENT_MANAGEMENT_TOKEN = 'capability-token';

    expect(managementApiHeaders()).toEqual({
      'Content-Type': 'application/json',
      [MANAGEMENT_TOKEN_HEADER]: 'capability-token',
    });
  });

  it('does not manufacture a token for an untrusted process', () => {
    expect(managementApiHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });
});
