import { describe, expect, it, vi } from 'vitest';

const { registerApp } = vi.hoisted(() => ({ registerApp: vi.fn() }));
vi.mock('@larksuiteoapi/node-sdk', () => ({ registerApp }));

import {
  BLEXAGENT_FEISHU_ADDONS,
  beginFeishuOneClickAppCreation,
  getFeishuOneClickAppCreation,
  startFeishuOneClickAppCreation,
} from './one-click-app';

describe('startFeishuOneClickAppCreation', () => {
  it('uses the official one-click flow and maps credentials without logging them', async () => {
    registerApp.mockImplementation(async (options: { onQRCodeReady: (info: { url: string; expireIn: number }) => void }) => {
      options.onQRCodeReady({ url: 'https://open.feishu.cn/page/launcher?user_code=test', expireIn: 600 });
      return { client_id: 'cli_test', client_secret: 'secret', user_info: { open_id: 'ou_test', tenant_brand: 'feishu' } };
    });
    const onQrReady = vi.fn();

    await expect(startFeishuOneClickAppCreation({ onQrReady })).resolves.toEqual({
      appId: 'cli_test', appSecret: 'secret', userOpenId: 'ou_test', tenantBrand: 'feishu',
    });
    expect(onQrReady).toHaveBeenCalledWith({ url: expect.stringContaining('user_code='), expiresIn: 600 });
    expect(registerApp).toHaveBeenCalledWith(expect.objectContaining({
      source: 'blexagent', createOnly: true, addons: BLEXAGENT_FEISHU_ADDONS,
    }));
  });

  it('holds credentials only in the short-lived session until the UI consumes them', async () => {
    registerApp.mockImplementation(async (options: { onQRCodeReady: (info: { url: string; expireIn: number }) => void }) => {
      options.onQRCodeReady({ url: 'https://open.feishu.cn/page/launcher?user_code=test-2', expireIn: 600 });
      return { client_id: 'cli_created', client_secret: 'secret', user_info: {} };
    });

    const started = await beginFeishuOneClickAppCreation();
    expect(started.qr.url).toContain('user_code=');
    await vi.waitFor(() => {
      expect(getFeishuOneClickAppCreation(started.sessionId)).toEqual({
        status: 'completed',
        app: { appId: 'cli_created', appSecret: 'secret', userOpenId: undefined, tenantBrand: undefined },
      });
    });
    expect(getFeishuOneClickAppCreation(started.sessionId)).toEqual({ status: 'missing' });
  });
});
