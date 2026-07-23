export type SettingsSection =
  | 'general'
  | 'shortcuts'
  | 'providers'
  | 'mcp'
  | 'skills'
  | 'sub-agents'
  | 'plugins'
  | 'agent'
  | 'usage-stats'
  | 'memory-hub'
  | 'desktop-pet'
  | 'about';

export const VALID_SECTIONS: SettingsSection[] = [
  'general',
  'shortcuts',
  'providers',
  'mcp',
  'skills',
  'sub-agents',
  'plugins',
  'agent',
  'usage-stats',
  'memory-hub',
  'desktop-pet',
  'about',
];

export const BLEXAGENT_GITHUB_URL = 'https://github.com/justaboyhai-wq/BlexAgents';
export const BLEXAGENT_RELEASES_URL = `${BLEXAGENT_GITHUB_URL}/releases`;

export const PLAYWRIGHT_DEVICE_PRESETS = [
  'iPhone 15 Pro',
  'iPhone 15',
  'iPhone SE',
  'iPad Pro 11',
  'Pixel 7',
  'Galaxy S23',
];
