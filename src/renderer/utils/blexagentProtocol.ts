/**
 * Resolve app-owned custom-protocol subresource URLs for the current WebView.
 *
 * Tauri 2 serves custom protocols as `http://<scheme>.localhost/...` on
 * Windows, while macOS/Linux continue to use the scheme form. The Rust
 * `attachment_protocol` handler accepts both; renderer code must emit the form
 * the platform WebView can actually load as an <img>/<audio> subresource.
 */

const BLEXAGENT_WINDOWS_ORIGIN = 'http://blexagent.localhost';
const BLEXAGENT_SCHEME_PREFIX = 'blexagent://';

export function isWindowsPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win/i.test(navigator.platform || '') || /Windows/i.test(navigator.userAgent || '');
}

export function resolveBlexAgentProtocolUrl(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (isWindowsPlatform()) {
    return `${BLEXAGENT_WINDOWS_ORIGIN}${path}`;
  }
  return `${BLEXAGENT_SCHEME_PREFIX}${path.slice(1)}`;
}
