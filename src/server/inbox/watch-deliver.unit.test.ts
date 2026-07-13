import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => ({
  cancellableFetch: vi.fn(),
}));

vi.mock('../utils/cancellation', () => ({
  cancellableFetch: fetchMock.cancellableFetch,
}));

import { deliverSessionWatchEvents } from './watch-deliver';
import {
  clearPendingSessionWatchesForTest,
  pendingSessionWatchCount,
  registerPendingSessionWatch,
} from './watch-registry';

function registerWatch(): void {
  registerPendingSessionWatch({
    watchId: 'watch-1',
    watcherSessionId: 'watcher-session',
    targetSessionId: 'target-session',
    targetLabel: 'Target',
    targetStateAtRegistration: 'running',
    registeredAt: '2026-06-20T12:00:00.000Z',
  });
}

describe('deliverSessionWatchEvents', () => {
  afterEach(() => {
    clearPendingSessionWatchesForTest();
    fetchMock.cancellableFetch.mockReset();
    delete process.env.BLEXAGENT_MANAGEMENT_PORT;
    delete process.env.BLEXAGENT_MANAGEMENT_TOKEN;
  });

  it('acks a watch only after confirmed delivery', async () => {
    process.env.BLEXAGENT_MANAGEMENT_PORT = '8123';
    process.env.BLEXAGENT_MANAGEMENT_TOKEN = 'test-capability-token';
    registerWatch();
    fetchMock.cancellableFetch.mockResolvedValue(new Response(
      JSON.stringify({ ok: true, outcome: { status: 'delivered', message_id: 'msg-1' } }),
      { status: 200 },
    ));

    await deliverSessionWatchEvents('target-session', { text: 'done' });

    expect(pendingSessionWatchCount()).toBe(0);
    expect(fetchMock.cancellableFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8123/api/inbox/deliver',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-BlexAgent-Management-Token': 'test-capability-token',
        }),
      }),
      expect.anything(),
    );
  });

  it('keeps a watch pending when delivery fails', async () => {
    process.env.BLEXAGENT_MANAGEMENT_PORT = '8123';
    registerWatch();
    fetchMock.cancellableFetch.mockResolvedValue(new Response(
      JSON.stringify({ ok: false, outcome: { status: 'delivery_failed', reason: 'starting' } }),
      { status: 200 },
    ));

    await deliverSessionWatchEvents('target-session', { text: 'done' });

    expect(pendingSessionWatchCount()).toBe(1);
  });
});
