// Theme presets — predefined color schemes for light/dark modes
// Each preset defines a complete set of CSS custom properties

export type ThemePresetId =
  | 'warm-brown'
  | 'ocean-blue'
  | 'forest-green'
  | 'midnight-purple'
  | 'slate-gray'
  | 'sunset-orange';

export interface ThemeColors {
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  inkSubtle: string;
  inkFaint: string;
  paper: string;
  paperElevated: string;
  paperInset: string;
  accent: string;
  accentWarm: string;
  accentWarmHover: string;
  accentWarmSubtle: string;
  accentWarmMuted: string;
  accentCool: string;
  accentCoolHover: string;
  buttonPrimaryBg: string;
  buttonPrimaryBgHover: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryBgHover: string;
  buttonSecondaryText: string;
  line: string;
  lineStrong: string;
  lineSubtle: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  nameKey: string; // i18n key for display name
  preview: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

// ─── Warm Brown ───
const warmBrown: ThemePreset = {
  id: 'warm-brown',
  nameKey: 'general.preset.warmBrown',
  preview: {
    light: {
      ink: '#1c1612',
      inkSecondary: '#2e2825',
      inkMuted: '#6f6156',
      inkSubtle: '#a69a90',
      inkFaint: '#c4b8ad',
      paper: '#faf6ee',
      paperElevated: '#fffcf7',
      paperInset: '#e8dccf',
      accent: '#c26d3a',
      accentWarm: '#c26d3a',
      accentWarmHover: '#e18a58',
      accentWarmSubtle: 'rgba(194, 109, 58, 0.08)',
      accentWarmMuted: 'rgba(194, 109, 58, 0.15)',
      accentCool: '#2e6f5e',
      accentCoolHover: '#3d8a75',
      buttonPrimaryBg: '#c26d3a',
      buttonPrimaryBgHover: '#b05e2d',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#e8dccf',
      buttonSecondaryBgHover: '#ddd0c2',
      buttonSecondaryText: '#1c1612',
      line: 'rgb(28 22 18 / 0.10)',
      lineStrong: 'rgb(28 22 18 / 0.18)',
      lineSubtle: 'rgb(28 22 18 / 0.06)',
      success: '#2d8a5e',
      error: '#dc2626',
      warning: '#d97706',
      info: '#4a7ab5',
    },
    dark: {
      ink: '#e4dcd4',
      inkSecondary: '#cfc5ba',
      inkMuted: '#968a7e',
      inkSubtle: '#685c52',
      inkFaint: '#4a4038',
      paper: '#1a1614',
      paperElevated: '#242018',
      paperInset: '#12100e',
      accent: '#d4803f',
      accentWarm: '#d4803f',
      accentWarmHover: '#e89860',
      accentWarmSubtle: 'rgba(212, 128, 63, 0.12)',
      accentWarmMuted: 'rgba(212, 128, 63, 0.20)',
      accentCool: '#4aad8a',
      accentCoolHover: '#5ec49e',
      buttonPrimaryBg: '#d4803f',
      buttonPrimaryBgHover: '#c06e30',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#3a3532',
      buttonSecondaryBgHover: '#4a4540',
      buttonSecondaryText: '#e4dcd4',
      line: 'rgb(228 220 212 / 0.10)',
      lineStrong: 'rgb(228 220 212 / 0.18)',
      lineSubtle: 'rgb(228 220 212 / 0.06)',
      success: '#4aad8a',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#60a5fa',
    },
  },
};

// ─── Ocean Blue ───
const oceanBlue: ThemePreset = {
  id: 'ocean-blue',
  nameKey: 'general.preset.oceanBlue',
  preview: {
    light: {
      ink: '#0f172a',
      inkSecondary: '#1e293b',
      inkMuted: '#64748b',
      inkSubtle: '#94a3b8',
      inkFaint: '#cbd5e1',
      paper: '#f8fafc',
      paperElevated: '#ffffff',
      paperInset: '#e2e8f0',
      accent: '#2563eb',
      accentWarm: '#2563eb',
      accentWarmHover: '#3b82f6',
      accentWarmSubtle: 'rgba(37, 99, 235, 0.08)',
      accentWarmMuted: 'rgba(37, 99, 235, 0.15)',
      accentCool: '#0891b2',
      accentCoolHover: '#06b6d4',
      buttonPrimaryBg: '#2563eb',
      buttonPrimaryBgHover: '#1d4ed8',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#e2e8f0',
      buttonSecondaryBgHover: '#cbd5e1',
      buttonSecondaryText: '#0f172a',
      line: 'rgb(15 23 42 / 0.10)',
      lineStrong: 'rgb(15 23 42 / 0.18)',
      lineSubtle: 'rgb(15 23 42 / 0.06)',
      success: '#059669',
      error: '#dc2626',
      warning: '#d97706',
      info: '#2563eb',
    },
    dark: {
      ink: '#e2e8f0',
      inkSecondary: '#cbd5e1',
      inkMuted: '#94a3b8',
      inkSubtle: '#64748b',
      inkFaint: '#475569',
      paper: '#0f172a',
      paperElevated: '#1e293b',
      paperInset: '#020617',
      accent: '#3b82f6',
      accentWarm: '#3b82f6',
      accentWarmHover: '#60a5fa',
      accentWarmSubtle: 'rgba(59, 130, 246, 0.12)',
      accentWarmMuted: 'rgba(59, 130, 246, 0.20)',
      accentCool: '#22d3ee',
      accentCoolHover: '#67e8f9',
      buttonPrimaryBg: '#3b82f6',
      buttonPrimaryBgHover: '#2563eb',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#1e293b',
      buttonSecondaryBgHover: '#334155',
      buttonSecondaryText: '#e2e8f0',
      line: 'rgb(226 232 240 / 0.10)',
      lineStrong: 'rgb(226 232 240 / 0.18)',
      lineSubtle: 'rgb(226 232 240 / 0.06)',
      success: '#34d399',
      error: '#f87171',
      warning: '#fbbf24',
      info: '#60a5fa',
    },
  },
};

// ─── Forest Green ───
const forestGreen: ThemePreset = {
  id: 'forest-green',
  nameKey: 'general.preset.forestGreen',
  preview: {
    light: {
      ink: '#14210d',
      inkSecondary: '#1a2f12',
      inkMuted: '#5a7247',
      inkSubtle: '#8fa87a',
      inkFaint: '#b5c9a5',
      paper: '#f6f9f4',
      paperElevated: '#fbfcfa',
      paperInset: '#e0ead8',
      accent: '#3d8b37',
      accentWarm: '#3d8b37',
      accentWarmHover: '#4ea847',
      accentWarmSubtle: 'rgba(61, 139, 55, 0.08)',
      accentWarmMuted: 'rgba(61, 139, 55, 0.15)',
      accentCool: '#0e7490',
      accentCoolHover: '#0891b2',
      buttonPrimaryBg: '#3d8b37',
      buttonPrimaryBgHover: '#2d7028',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#e0ead8',
      buttonSecondaryBgHover: '#d0deca',
      buttonSecondaryText: '#14210d',
      line: 'rgb(20 33 13 / 0.10)',
      lineStrong: 'rgb(20 33 13 / 0.18)',
      lineSubtle: 'rgb(20 33 13 / 0.06)',
      success: '#3d8b37',
      error: '#dc2626',
      warning: '#d97706',
      info: '#0e7490',
    },
    dark: {
      ink: '#e0ead8',
      inkSecondary: '#c5d9b8',
      inkMuted: '#8fa87a',
      inkSubtle: '#5a7247',
      inkFaint: '#3d5230',
      paper: '#0d1a08',
      paperElevated: '#162510',
      paperInset: '#080f05',
      accent: '#4ea847',
      accentWarm: '#4ea847',
      accentWarmHover: '#6bc464',
      accentWarmSubtle: 'rgba(78, 168, 71, 0.12)',
      accentWarmMuted: 'rgba(78, 168, 71, 0.20)',
      accentCool: '#22d3ee',
      accentCoolHover: '#67e8f9',
      buttonPrimaryBg: '#4ea847',
      buttonPrimaryBgHover: '#3d8b37',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#162510',
      buttonSecondaryBgHover: '#1f3518',
      buttonSecondaryText: '#e0ead8',
      line: 'rgb(224 234 216 / 0.10)',
      lineStrong: 'rgb(224 234 216 / 0.18)',
      lineSubtle: 'rgb(224 234 216 / 0.06)',
      success: '#6bc464',
      error: '#f87171',
      warning: '#fbbf24',
      info: '#22d3ee',
    },
  },
};

// ─── Midnight Purple ───
const midnightPurple: ThemePreset = {
  id: 'midnight-purple',
  nameKey: 'general.preset.midnightPurple',
  preview: {
    light: {
      ink: '#1e1033',
      inkSecondary: '#2d1b4e',
      inkMuted: '#7c6a9a',
      inkSubtle: '#a89bc4',
      inkFaint: '#cec4e2',
      paper: '#f9f7fc',
      paperElevated: '#ffffff',
      paperInset: '#ede8f5',
      accent: '#7c3aed',
      accentWarm: '#7c3aed',
      accentWarmHover: '#8b5cf6',
      accentWarmSubtle: 'rgba(124, 58, 237, 0.08)',
      accentWarmMuted: 'rgba(124, 58, 237, 0.15)',
      accentCool: '#0891b2',
      accentCoolHover: '#06b6d4',
      buttonPrimaryBg: '#7c3aed',
      buttonPrimaryBgHover: '#6d28d9',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#ede8f5',
      buttonSecondaryBgHover: '#ddd5ec',
      buttonSecondaryText: '#1e1033',
      line: 'rgb(30 16 51 / 0.10)',
      lineStrong: 'rgb(30 16 51 / 0.18)',
      lineSubtle: 'rgb(30 16 51 / 0.06)',
      success: '#059669',
      error: '#dc2626',
      warning: '#d97706',
      info: '#7c3aed',
    },
    dark: {
      ink: '#e8e0f0',
      inkSecondary: '#cec4e2',
      inkMuted: '#9a8bb8',
      inkSubtle: '#6b5d85',
      inkFaint: '#4a3d65',
      paper: '#130d20',
      paperElevated: '#1e1535',
      paperInset: '#0a0615',
      accent: '#a78bfa',
      accentWarm: '#a78bfa',
      accentWarmHover: '#c4b5fd',
      accentWarmSubtle: 'rgba(167, 139, 250, 0.12)',
      accentWarmMuted: 'rgba(167, 139, 250, 0.20)',
      accentCool: '#22d3ee',
      accentCoolHover: '#67e8f9',
      buttonPrimaryBg: '#a78bfa',
      buttonPrimaryBgHover: '#8b5cf6',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#1e1535',
      buttonSecondaryBgHover: '#2d2248',
      buttonSecondaryText: '#e8e0f0',
      line: 'rgb(232 224 240 / 0.10)',
      lineStrong: 'rgb(232 224 240 / 0.18)',
      lineSubtle: 'rgb(232 224 240 / 0.06)',
      success: '#34d399',
      error: '#f87171',
      warning: '#fbbf24',
      info: '#a78bfa',
    },
  },
};

// ─── Slate Gray ───
const slateGray: ThemePreset = {
  id: 'slate-gray',
  nameKey: 'general.preset.slateGray',
  preview: {
    light: {
      ink: '#1e293b',
      inkSecondary: '#334155',
      inkMuted: '#64748b',
      inkSubtle: '#94a3b8',
      inkFaint: '#cbd5e1',
      paper: '#f8fafc',
      paperElevated: '#ffffff',
      paperInset: '#e2e8f0',
      accent: '#475569',
      accentWarm: '#475569',
      accentWarmHover: '#64748b',
      accentWarmSubtle: 'rgba(71, 85, 105, 0.08)',
      accentWarmMuted: 'rgba(71, 85, 105, 0.15)',
      accentCool: '#0ea5e9',
      accentCoolHover: '#38bdf8',
      buttonPrimaryBg: '#475569',
      buttonPrimaryBgHover: '#334155',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#e2e8f0',
      buttonSecondaryBgHover: '#cbd5e1',
      buttonSecondaryText: '#1e293b',
      line: 'rgb(30 41 59 / 0.10)',
      lineStrong: 'rgb(30 41 59 / 0.18)',
      lineSubtle: 'rgb(30 41 59 / 0.06)',
      success: '#059669',
      error: '#dc2626',
      warning: '#d97706',
      info: '#0ea5e9',
    },
    dark: {
      ink: '#e2e8f0',
      inkSecondary: '#cbd5e1',
      inkMuted: '#94a3b8',
      inkSubtle: '#64748b',
      inkFaint: '#475569',
      paper: '#0f172a',
      paperElevated: '#1e293b',
      paperInset: '#020617',
      accent: '#94a3b8',
      accentWarm: '#94a3b8',
      accentWarmHover: '#cbd5e1',
      accentWarmSubtle: 'rgba(148, 163, 184, 0.12)',
      accentWarmMuted: 'rgba(148, 163, 184, 0.20)',
      accentCool: '#38bdf8',
      accentCoolHover: '#7dd3fc',
      buttonPrimaryBg: '#94a3b8',
      buttonPrimaryBgHover: '#64748b',
      buttonPrimaryText: '#0f172a',
      buttonSecondaryBg: '#1e293b',
      buttonSecondaryBgHover: '#334155',
      buttonSecondaryText: '#e2e8f0',
      line: 'rgb(226 232 240 / 0.10)',
      lineStrong: 'rgb(226 232 240 / 0.18)',
      lineSubtle: 'rgb(226 232 240 / 0.06)',
      success: '#34d399',
      error: '#f87171',
      warning: '#fbbf24',
      info: '#38bdf8',
    },
  },
};

// ─── Sunset Orange ───
const sunsetOrange: ThemePreset = {
  id: 'sunset-orange',
  nameKey: 'general.preset.sunsetOrange',
  preview: {
    light: {
      ink: '#2a1508',
      inkSecondary: '#3d200e',
      inkMuted: '#8a5a3a',
      inkSubtle: '#b88a66',
      inkFaint: '#d4b89c',
      paper: '#fef8f3',
      paperElevated: '#fffdfb',
      paperInset: '#f0e4d6',
      accent: '#ea580c',
      accentWarm: '#ea580c',
      accentWarmHover: '#f97316',
      accentWarmSubtle: 'rgba(234, 88, 12, 0.08)',
      accentWarmMuted: 'rgba(234, 88, 12, 0.15)',
      accentCool: '#0d9488',
      accentCoolHover: '#14b8a6',
      buttonPrimaryBg: '#ea580c',
      buttonPrimaryBgHover: '#c2410c',
      buttonPrimaryText: '#ffffff',
      buttonSecondaryBg: '#f0e4d6',
      buttonSecondaryBgHover: '#e6d5c2',
      buttonSecondaryText: '#2a1508',
      line: 'rgb(42 21 8 / 0.10)',
      lineStrong: 'rgb(42 21 8 / 0.18)',
      lineSubtle: 'rgb(42 21 8 / 0.06)',
      success: '#059669',
      error: '#dc2626',
      warning: '#d97706',
      info: '#0d9488',
    },
    dark: {
      ink: '#f5e6d8',
      inkSecondary: '#e0ccb8',
      inkMuted: '#a88a6c',
      inkSubtle: '#7a6048',
      inkFaint: '#5a4535',
      paper: '#1a0f08',
      paperElevated: '#281a10',
      paperInset: '#100a05',
      accent: '#fb923c',
      accentWarm: '#fb923c',
      accentWarmHover: '#fdba74',
      accentWarmSubtle: 'rgba(251, 146, 60, 0.12)',
      accentWarmMuted: 'rgba(251, 146, 60, 0.20)',
      accentCool: '#2dd4bf',
      accentCoolHover: '#5eead4',
      buttonPrimaryBg: '#fb923c',
      buttonPrimaryBgHover: '#f97316',
      buttonPrimaryText: '#1a0f08',
      buttonSecondaryBg: '#281a10',
      buttonSecondaryBgHover: '#3a2818',
      buttonSecondaryText: '#f5e6d8',
      line: 'rgb(245 230 216 / 0.10)',
      lineStrong: 'rgb(245 230 216 / 0.18)',
      lineSubtle: 'rgb(245 230 216 / 0.06)',
      success: '#34d399',
      error: '#f87171',
      warning: '#fbbf24',
      info: '#2dd4bf',
    },
  },
};

// ─── Registry ───

export const THEME_PRESETS: ThemePreset[] = [
  oceanBlue,
  warmBrown,
  forestGreen,
  midnightPurple,
  slateGray,
  sunsetOrange,
];

export const THEME_PRESET_MAP = Object.fromEntries(
  THEME_PRESETS.map((p) => [p.id, p]),
) as Record<ThemePresetId, ThemePreset>;

export const DEFAULT_THEME_PRESET: ThemePresetId = 'ocean-blue';

/**
 * Apply a theme preset's CSS variables to the document root.
 * Called by useThemeEffect when theme or preset changes.
 */
export function applyThemePreset(
  presetId: ThemePresetId | undefined,
  mode: 'light' | 'dark',
): void {
  const preset = THEME_PRESET_MAP[presetId ?? DEFAULT_THEME_PRESET] ?? THEME_PRESET_MAP[DEFAULT_THEME_PRESET];
  const colors = preset.preview[mode];
  const root = document.documentElement;

  // Ink
  root.style.setProperty('--ink', colors.ink);
  root.style.setProperty('--ink-secondary', colors.inkSecondary);
  root.style.setProperty('--ink-muted', colors.inkMuted);
  root.style.setProperty('--ink-subtle', colors.inkSubtle);
  root.style.setProperty('--ink-faint', colors.inkFaint);

  // Paper
  root.style.setProperty('--paper', colors.paper);
  root.style.setProperty('--paper-elevated', colors.paperElevated);
  root.style.setProperty('--paper-inset', colors.paperInset);

  // Accent
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-warm', colors.accentWarm);
  root.style.setProperty('--accent-warm-hover', colors.accentWarmHover);
  root.style.setProperty('--accent-warm-subtle', colors.accentWarmSubtle);
  root.style.setProperty('--accent-warm-muted', colors.accentWarmMuted);
  root.style.setProperty('--accent-cool', colors.accentCool);
  root.style.setProperty('--accent-cool-hover', colors.accentCoolHover);

  // Button
  root.style.setProperty('--button-primary-bg', colors.buttonPrimaryBg);
  root.style.setProperty('--button-primary-bg-hover', colors.buttonPrimaryBgHover);
  root.style.setProperty('--button-primary-text', colors.buttonPrimaryText);
  root.style.setProperty('--button-secondary-bg', colors.buttonSecondaryBg);
  root.style.setProperty('--button-secondary-bg-hover', colors.buttonSecondaryBgHover);
  root.style.setProperty('--button-secondary-text', colors.buttonSecondaryText);

  // Line
  root.style.setProperty('--line', colors.line);
  root.style.setProperty('--line-strong', colors.lineStrong);
  root.style.setProperty('--line-subtle', colors.lineSubtle);

  // Semantic
  root.style.setProperty('--success', colors.success);
  root.style.setProperty('--error', colors.error);
  root.style.setProperty('--warning', colors.warning);
  root.style.setProperty('--info', colors.info);
}
