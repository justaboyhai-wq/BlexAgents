const MAIN_RENDERER_LOCK = 'blex-main-renderer-background-events';
const INSTALL_FLAG = '__blexBackgroundRendererKeepAliveInstalled';

type KeepAliveWindow = Window & { [INSTALL_FLAG]?: boolean };

/**
 * Keep the main WebView eligible to receive Tauri events while it is hidden.
 *
 * Wry documents that Windows WebView2 may suspend or unload a minimized/hidden
 * view after roughly five minutes, and recommends a pending WebLock transaction
 * as the Windows workaround because native background-throttling control is not
 * supported there. Global voice routing is an always-on responsibility of the
 * main renderer, so it holds one lock for the document lifetime.
 */
export function installBackgroundRendererKeepAlive(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  const keepAliveWindow = window as KeepAliveWindow;
  if (keepAliveWindow[INSTALL_FLAG]) return;
  keepAliveWindow[INSTALL_FLAG] = true;

  if (!navigator.locks?.request) {
    console.warn('[renderer-keepalive] Web Locks API unavailable; hidden renderer can be suspended');
    return;
  }

  void navigator.locks.request(MAIN_RENDERER_LOCK, async () => {
    console.info('[renderer-keepalive] background event lock acquired');
    // Intentionally unresolved: the user closing/reloading this document is
    // the lifecycle boundary, at which point WebView2 releases the lock.
    await new Promise<void>(() => undefined);
  }).catch(cause => {
    keepAliveWindow[INSTALL_FLAG] = false;
    console.warn('[renderer-keepalive] failed to acquire background event lock:', cause);
  });
}
