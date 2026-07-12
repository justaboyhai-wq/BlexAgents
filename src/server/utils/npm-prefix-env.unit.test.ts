import { describe, expect, it } from 'vitest';

import {
  getBlexAgentNpmGlobalBinDir,
  getBlexAgentNpmGlobalPrefix,
  scrubBlexAgentNpmPrefixEnv,
} from './npm-prefix-env';

describe('npm prefix env utilities', () => {
  it('builds the BlexAgent npm global prefix and bin dir per platform', () => {
    expect(getBlexAgentNpmGlobalPrefix('/Users/tester', 'darwin')).toBe('/Users/tester/.blexagent/npm-global');
    expect(getBlexAgentNpmGlobalBinDir('/Users/tester', 'darwin')).toBe('/Users/tester/.blexagent/npm-global/bin');

    expect(getBlexAgentNpmGlobalPrefix('C:\\Users\\tester', 'win32')).toMatch(/C:[/\\]Users[/\\]tester[/\\]\.blexagent[/\\]npm-global/);
    expect(getBlexAgentNpmGlobalBinDir('C:\\Users\\tester', 'win32')).toMatch(/C:[/\\]Users[/\\]tester[/\\]\.blexagent[/\\]npm-global/);
  });

  it('scrubs only npm prefix variables that point at the BlexAgent prefix', () => {
    const prefix = '/Users/tester/.blexagent/npm-global';
    const env: NodeJS.ProcessEnv = {
      npm_config_prefix: `${prefix}/`,
      NPM_CONFIG_PREFIX: '/Users/tester/.npm-global',
      PREFIX: prefix,
    };

    scrubBlexAgentNpmPrefixEnv(env, prefix, 'darwin');

    expect(env.npm_config_prefix).toBeUndefined();
    expect(env.NPM_CONFIG_PREFIX).toBe('/Users/tester/.npm-global');
    expect(env.PREFIX).toBeUndefined();
  });
});
