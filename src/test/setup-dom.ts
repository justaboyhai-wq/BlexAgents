// Setup for the `dom` vitest project (jsdom + @testing-library/react).
// - Extends expect() with jest-dom matchers (toBeInTheDocument, toBeDisabled, …).
// - Unmounts rendered trees after each test so DOM/listeners don't leak across
//   tests sharing the same jsdom document.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { i18n } from '@/i18n';

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string) {
      return entries.get(String(key)) ?? null;
    },
    key(index: number) {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(String(key));
    },
    setItem(key: string, value: string) {
      entries.set(String(key), String(value));
    },
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  let storage: Storage | undefined;
  try {
    storage = window[name];
    // Node 26 exposes an unusable global Storage placeholder unless it was
    // started with --localstorage-file. Exercise it before accepting it.
    storage.setItem('__blexagent_storage_probe__', '1');
    storage.removeItem('__blexagent_storage_probe__');
  } catch {
    storage = undefined;
  }

  if (!storage) {
    storage = createMemoryStorage();
    Object.defineProperty(window, name, {
      configurable: true,
      value: storage,
    });
  }

  // Vitest's jsdom environment can retain Node's global descriptor even when
  // window has a valid Storage object, so keep both references identical.
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: storage,
  });
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

// jsdom lacks ResizeObserver, which several components (CollapsibleContent,
// MessageList, editors) construct in effects. Provide a no-op stub so rendering
// them under jsdom doesn't throw. Tests that assert on observed sizes mock it
// per-test; this default just keeps construction from crashing.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
  } as unknown as typeof ResizeObserver;
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  cleanup();
});
