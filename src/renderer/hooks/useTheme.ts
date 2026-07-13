import { useEffect } from 'react';
import { useConfig } from './useConfig';
import { applyThemePreset, type ThemePresetId, DEFAULT_THEME_PRESET } from '../config/themePresets';

/**
 * Applies the theme to the document based on config.theme ('light' | 'dark' | 'system').
 * Adds/removes `.dark` class on <html> which activates CSS variable overrides in index.css.
 * Also applies the selected theme preset's color variables.
 *
 * Must be called once at app root level (inside ConfigProvider).
 */
export function useThemeEffect(): void {
  const { config } = useConfig();
  const theme = config.theme ?? 'system';
  const presetId = (config.themePreset ?? DEFAULT_THEME_PRESET) as ThemePresetId;

  useEffect(() => {
    const html = document.documentElement;

    function applyResolved(resolved: 'light' | 'dark') {
      if (resolved === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      // Apply theme preset colors
      applyThemePreset(presetId, resolved);
      // Mirror to localStorage for FOUC prevention (index.html inline script)
      try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
    }

    if (theme === 'light' || theme === 'dark') {
      applyResolved(theme);
      return;
    }

    // system mode — follow OS preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyResolved(mq.matches ? 'dark' : 'light');

    const handler = (e: MediaQueryListEvent) => applyResolved(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, presetId]);
}
