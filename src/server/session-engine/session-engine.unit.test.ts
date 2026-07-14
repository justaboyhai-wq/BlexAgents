import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stopTurn: vi.fn(async () => ({ success: true })),
}));

vi.mock('./builtin-adapter', () => ({
  createBuiltinSessionEngine: () => ({
    kind: 'builtin',
    stopTurn: mocks.stopTurn,
  }),
}));

import {
  getAskUserQuestionResponseEngine,
  getPermissionResponseEngine,
  getSessionEngine,
  getSessionEngineKind,
  getSessionRuntimeType,
  stopActiveTurn,
} from './selector';

describe('builtin-only session engine selector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always selects the bundled Claude Agent SDK engine', () => {
    expect(getSessionEngine().kind).toBe('builtin');
    expect(getSessionEngineKind()).toBe('builtin');
    expect(getSessionRuntimeType()).toBe('builtin');
  });

  it('keeps permission and AskUserQuestion responses on the builtin owner', () => {
    expect(getPermissionResponseEngine().kind).toBe('builtin');
    expect(getAskUserQuestionResponseEngine('legacy-external-request').kind).toBe('builtin');
  });

  it('stops the builtin turn without consulting a retired runtime', async () => {
    await expect(stopActiveTurn()).resolves.toEqual({ success: true });
    expect(mocks.stopTurn).toHaveBeenCalledOnce();
  });
});
