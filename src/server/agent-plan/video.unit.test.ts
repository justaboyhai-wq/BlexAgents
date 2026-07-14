import { describe, expect, it } from 'vitest';

import { AgentPlanVideoError } from './video';

describe('Agent Plan video errors', () => {
  it('preserves structured status and code', () => {
    const error = new AgentPlanVideoError('rate-limited', 'later', 429);
    expect(error).toMatchObject({ name: 'AgentPlanVideoError', code: 'rate-limited', status: 429 });
  });
});
