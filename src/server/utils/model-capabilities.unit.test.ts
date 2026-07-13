import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  applyContextWindowSuffix,
  parseLiteLLMCatalog,
  lookupModelContextLength,
  lookupModelCapability,
  lookupProviderModelContextLength,
  __resetModelCapabilityCacheForTests,
} from './model-capabilities';

let tmpHome: string;
let prevHome: string | undefined;
let prevUserProfile: string | undefined;

beforeEach(() => {
  prevHome = process.env.HOME;
  prevUserProfile = process.env.USERPROFILE;
  tmpHome = mkdtempSync(join(tmpdir(), 'blexagent-modelcaps-'));
  mkdirSync(join(tmpHome, '.blexagent', 'providers'), { recursive: true });
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  __resetModelCapabilityCacheForTests();
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  __resetModelCapabilityCacheForTests();
  rmSync(tmpHome, { recursive: true, force: true });
});

function writeProviderFixture(
  filename: string,
  id: string,
  models: Array<Record<string, unknown>>,
): void {
  writeFileSync(
    join(tmpHome, '.blexagent', 'providers', filename),
    JSON.stringify({ id, models }),
  );
  __resetModelCapabilityCacheForTests();
}

function writeLiteLlmFixture(entries: Record<string, unknown>): void {
  const cacheDir = join(tmpHome, '.blexagent', 'cache');
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, 'litellm_model_prices.json'), JSON.stringify(entries));
  __resetModelCapabilityCacheForTests();
}

// #1 recurring red line: a >=1M-context model MUST be tagged `[1m]` before it
// reaches SDK ingress, or the SDK silently falls back to the 200K window
// (/context shows 200K, auto-compact fires at ~187K, attachments truncate).
// applyContextWindowSuffix is the single chokepoint. These lock its contract.
//
// Every test redirects both HOME and USERPROFILE. Windows production code
// intentionally prefers USERPROFILE, so replacing only HOME leaks the
// developer's real config/cache into the registry.
describe('applyContextWindowSuffix — registry-independent guards', () => {
  it('returns undefined for empty / null / undefined (never overwrite a model option with "")', () => {
    expect(applyContextWindowSuffix(undefined)).toBeUndefined();
    expect(applyContextWindowSuffix(null)).toBeUndefined();
    expect(applyContextWindowSuffix('')).toBeUndefined();
  });

  it('leaves an already-[1m]-tagged id untouched (case-insensitive, no double-wrap)', () => {
    expect(applyContextWindowSuffix('foo[1m]')).toBe('foo[1m]');
    expect(applyContextWindowSuffix('claude-opus-4-7[1m]')).toBe('claude-opus-4-7[1m]');
    expect(applyContextWindowSuffix('claude-opus-4-6[1m]')).toBe('claude-opus-4-6[1m]');
    expect(applyContextWindowSuffix('claude-sonnet-4-6[1m]')).toBe('claude-sonnet-4-6[1m]');
    expect(applyContextWindowSuffix('FOO[1M]')).toBe('FOO[1M]'); // matches SDK has1mContext regex
  });

  it('leaves an unregistered model unchanged (no entry → no suffix)', () => {
    expect(applyContextWindowSuffix('totally-made-up-model-xyz')).toBe('totally-made-up-model-xyz');
  });

});

describe('applyContextWindowSuffix — threshold via isolated registry fixtures', () => {
  function installThresholdFixture(): void {
    writeProviderFixture('threshold.json', 'threshold-fixture', [
      { model: 'fixture-one-million-a', contextLength: 1_000_000 },
      { model: 'fixture-one-million-b', contextLength: 1_000_000 },
      { model: 'fixture-exact-200k-a', contextLength: 200_000 },
      { model: 'fixture-exact-200k-b', contextLength: 200_000 },
      { model: 'fixture-exact-200k-c', contextLength: 200_000 },
      { model: 'fixture-midband-a', contextLength: 262_144 },
      { model: 'fixture-midband-b', contextLength: 262_144 },
    ]);
  }

  it('tags 1M registry models with [1m]', () => {
    installThresholdFixture();
    expect(applyContextWindowSuffix('fixture-one-million-a')).toBe('fixture-one-million-a[1m]');
    expect(applyContextWindowSuffix('fixture-one-million-b')).toBe('fixture-one-million-b[1m]');
  });

  it('does NOT auto-tag models at the exact 200K wire-default threshold (#392)', () => {
    installThresholdFixture();
    expect(applyContextWindowSuffix('fixture-exact-200k-a')).toBe('fixture-exact-200k-a');
    expect(applyContextWindowSuffix('fixture-exact-200k-b')).toBe('fixture-exact-200k-b');
    expect(applyContextWindowSuffix('fixture-exact-200k-c')).toBe('fixture-exact-200k-c');
  });

  // #335 — mid-band models (200K < ctx < 1M) MUST be unlocked too. The [1m]
  // suffix is the only lever that raises the SDK window above its 200K
  // default; CLAUDE_CODE_AUTO_COMPACT_WINDOW (injected from the same registry
  // value) then pulls the effective window back to the real limit. Without
  // the wrap, a 512K model's usable window is min(200K, 512K) − 33K ≈ 167K —
  // most of the model's capacity silently wasted.
  it('tags mid-band registry models (>200K, <1M) so the env cap can take effect (#335)', () => {
    installThresholdFixture();
    expect(applyContextWindowSuffix('fixture-midband-a')).toBe('fixture-midband-a[1m]');
    expect(applyContextWindowSuffix('fixture-midband-b')).toBe('fixture-midband-b[1m]');
  });
});

// LiteLLM fallback parser. Shapes mirror the real
// model_prices_and_context_window.json (verified 2026-05: 2748 entries, a
// `sample_spec` doc entry, path-like image_generation keys, provider/model keys).
describe('parseLiteLLMCatalog', () => {
  it('maps max_input_tokens → contextLength and max_output_tokens, tagging source=litellm', () => {
    const m = parseLiteLLMCatalog({
      'gpt-4o': { max_input_tokens: 128000, max_output_tokens: 16384, max_tokens: 16384, litellm_provider: 'openai', mode: 'chat' },
    });
    expect(m.get('gpt-4o')).toEqual({ contextLength: 128000, maxOutputTokens: 16384, source: 'litellm' });
  });

  it('falls back to max_tokens when max_input_tokens is absent', () => {
    const m = parseLiteLLMCatalog({ 'weird-model': { max_tokens: 32000, mode: 'chat' } });
    expect(m.get('weird-model')?.contextLength).toBe(32000);
  });

  it('skips the sample_spec doc entry', () => {
    const m = parseLiteLLMCatalog({
      sample_spec: { max_input_tokens: 999999, max_output_tokens: 1, mode: 'chat' },
      'real-model': { max_input_tokens: 8000, mode: 'chat' },
    });
    expect(m.has('sample_spec')).toBe(false);
    expect(m.get('real-model')?.contextLength).toBe(8000);
  });

  it('filters out non-LLM modes (image_generation / embedding / audio_*) — they would poison the registry', () => {
    const m = parseLiteLLMCatalog({
      '1024-x-1024/50-steps/bedrock/amazon.nova-canvas-v1:0': { max_input_tokens: 2600, mode: 'image_generation' },
      'text-embedding-3-large': { max_input_tokens: 8191, mode: 'embedding' },
      'whisper-1': { max_input_tokens: 0, mode: 'audio_transcription' },
      'gpt-4o': { max_input_tokens: 128000, mode: 'chat' },
    });
    expect(m.has('amazon.nova-canvas-v1:0')).toBe(false);
    expect(m.has('text-embedding-3-large')).toBe(false);
    expect(m.has('whisper-1')).toBe(false);
    expect(m.get('gpt-4o')?.contextLength).toBe(128000);
  });

  it('keeps entries with no mode (some valid text models omit it)', () => {
    const m = parseLiteLLMCatalog({ 'no-mode-model': { max_input_tokens: 65536, max_output_tokens: 8192 } });
    expect(m.get('no-mode-model')?.contextLength).toBe(65536);
  });

  it('indexes provider/model keys under both the full key and the provider-stripped tail', () => {
    const m = parseLiteLLMCatalog({
      'deepseek/deepseek-chat': { max_input_tokens: 131072, max_output_tokens: 8192, mode: 'chat' },
    });
    expect(m.get('deepseek/deepseek-chat')?.contextLength).toBe(131072);
    expect(m.get('deepseek-chat')?.contextLength).toBe(131072); // bare id our presets use
  });

  it('a literal key always beats a provider/model tail collision, regardless of entry order', () => {
    // provider/model listed BEFORE the literal
    const a = parseLiteLLMCatalog({
      'azure/gpt-4': { max_input_tokens: 100, mode: 'chat' },
      'gpt-4': { max_input_tokens: 8192, mode: 'chat' },
    });
    expect(a.get('gpt-4')?.contextLength).toBe(8192); // literal wins, not the 100 tail
    // literal listed BEFORE provider/model
    const b = parseLiteLLMCatalog({
      'gpt-4': { max_input_tokens: 8192, mode: 'chat' },
      'azure/gpt-4': { max_input_tokens: 100, mode: 'chat' },
    });
    expect(b.get('gpt-4')?.contextLength).toBe(8192); // still the literal
  });

  it('skips entries with neither a context window nor an output limit', () => {
    const m = parseLiteLLMCatalog({ 'pricing-only': { input_cost_per_token: 0.0001, mode: 'chat' } });
    expect(m.has('pricing-only')).toBe(false);
  });

  it('is robust to non-object / null inputs', () => {
    expect(parseLiteLLMCatalog(null).size).toBe(0);
    expect(parseLiteLLMCatalog('nope').size).toBe(0);
    expect(parseLiteLLMCatalog({ x: null, y: 42, z: 'str' }).size).toBe(0);
  });
});

// #338 — the configured 1M contextLength silently fell back to 200K because the
// bare-keyed registry was queried with a suffixed/whitespace-cruft model id, OR
// an incomplete higher-priority entry shadowed the real window. These pin BOTH
// mechanisms. The file-wide HOME + USERPROFILE sandbox prevents local
// config/cache from participating, and each case installs only its own source.
describe('capability-suffix tolerance + per-field merge (#338)', () => {
  // Mechanism #1: a [1m] / " 1m" suffixed active model id must resolve to its
  // BARE registry contextLength (pre-fix: lookup missed → undefined → 200K).
  it('resolves a [1m] / " 1m" suffixed id to the bare registry contextLength', () => {
    writeProviderFixture('suffix.json', 'suffix-fixture', [
      { model: 'fixture-suffix-1m', contextLength: 1_000_000 },
      { model: 'fixture-suffix-200k-a', contextLength: 200_000 },
      { model: 'fixture-suffix-200k-b', contextLength: 200_000 },
    ]);
    expect(lookupModelContextLength('fixture-suffix-1m[1m]')).toBe(1_000_000);
    expect(lookupModelContextLength('fixture-suffix-1m 1m')).toBe(1_000_000);
    expect(lookupModelContextLength('fixture-suffix-200k-a[1m]')).toBe(200_000);
    expect(lookupModelContextLength('fixture-suffix-200k-a 1m')).toBe(200_000);
    expect(lookupModelContextLength('fixture-suffix-200k-b[1m]')).toBe(200_000);
    expect(lookupModelContextLength('fixture-suffix-200k-b 1m')).toBe(200_000);
  });

  it('canonicalizes a hand-typed " 1m" id (#338): append [1m] >200K, strip it off otherwise', () => {
    writeProviderFixture('suffix.json', 'suffix-fixture', [
      { model: 'fixture-suffix-1m', contextLength: 1_000_000 },
      { model: 'fixture-suffix-200k-a', contextLength: 200_000 },
      { model: 'fixture-suffix-200k-b', contextLength: 200_000 },
    ]);
    expect(applyContextWindowSuffix('fixture-suffix-1m 1m')).toBe('fixture-suffix-1m[1m]');
    // ≤200K: drop the malformed " 1m" so it never leaks to the upstream wire.
    expect(applyContextWindowSuffix('fixture-suffix-200k-a 1m')).toBe('fixture-suffix-200k-a');
    expect(applyContextWindowSuffix('fixture-suffix-200k-b 1m')).toBe('fixture-suffix-200k-b');
  });

  // Mechanism #2: an incomplete higher-priority entry (modalities, NO
  // contextLength) must NOT shadow a lower-priority catalog window. Pre-fix this
  // exact on-disk shape (observed in a real config) made lookup return
  // undefined for a CLEAN model id → window collapsed to the SDK 200K default.
  it('an incomplete discovered entry does NOT shadow a lower-priority catalog contextLength', () => {
    writeFileSync(
      join(tmpHome, '.blexagent', 'config.json'),
      JSON.stringify({ presetCustomModels: { fixture: [{ model: 'fixture-merge-model', inputModalities: ['text'] }] } }),
    );
    writeLiteLlmFixture({
      'fixture-merge-model': { max_input_tokens: 204_800, mode: 'chat' },
    });
    expect(lookupModelContextLength('fixture-merge-model')).toBe(204_800);
  });

  // A discovered 1M override stored with the suffix baked into the model id.
  // Bare AND suffixed lookups must see 1M and applyContextWindowSuffix must tag it.
  it('a 1M override stored under a [1m]-suffixed custom key resolves by the bare id', () => {
    writeFileSync(
      join(tmpHome, '.blexagent', 'config.json'),
      JSON.stringify({
        presetCustomModels: { fixture: [{ model: 'fixture-config-model[1m]', contextLength: 1_000_000 }] },
      }),
    );
    __resetModelCapabilityCacheForTests();
    expect(lookupModelContextLength('fixture-config-model')).toBe(1_000_000);
    expect(lookupModelContextLength('fixture-config-model[1m]')).toBe(1_000_000);
    expect(applyContextWindowSuffix('fixture-config-model')).toBe('fixture-config-model[1m]');
  });

  it('prefers the active provider contextLength when duplicate custom providers reuse a model id', () => {
    const providersDir = join(tmpHome, '.blexagent', 'providers');
    mkdirSync(providersDir, { recursive: true });
    writeFileSync(
      join(providersDir, 'dragon-a.json'),
      JSON.stringify({
        id: 'dragon-a',
        models: [{ model: 'fixture-duplicate-model', contextLength: 1_000_000 }],
      }),
    );
    writeFileSync(
      join(providersDir, 'dragon-b.json'),
      JSON.stringify({
        id: 'dragon-b',
        models: [{ model: 'fixture-duplicate-model', contextLength: 200_000 }],
      }),
    );
    __resetModelCapabilityCacheForTests();

    expect(lookupProviderModelContextLength('fixture-duplicate-model[1m]', 'dragon-b')).toBe(200_000);
    expect(lookupProviderModelContextLength('fixture-duplicate-model[1m]', 'dragon-a')).toBe(1_000_000);
  });

  // Per-field merge interaction with modalities (Codex review note): a higher-
  // priority entry that defines inputModalities but omits contextLength keeps
  // its explicit modalities AND inherits a lower source's contextLength. This is the
  // intended "undefined field = defer to lower source" semantics.
  it('per-field merge: explicit modalities win, missing contextLength fills from lower-priority catalog', () => {
    writeFileSync(
      join(tmpHome, '.blexagent', 'config.json'),
      JSON.stringify({ presetCustomModels: { fixture: [{ model: 'fixture-merge-model', inputModalities: ['text'] }] } }),
    );
    writeLiteLlmFixture({
      'fixture-merge-model': { max_input_tokens: 204_800, mode: 'chat' },
    });
    const cap = lookupModelCapability('fixture-merge-model');
    expect(cap?.inputModalities).toEqual(['text']); // explicit override preserved
    expect(cap?.contextLength).toBe(204_800);        // gap filled from the lower-priority catalog
  });

  // applyContextWindowSuffix must not feed the SDK a garbage model option built
  // from whitespace-/suffix-only input (Codex review edge case).
  it('applyContextWindowSuffix returns undefined for whitespace-/suffix-only input', () => {
    expect(applyContextWindowSuffix(' 1m')).toBeUndefined();
    expect(applyContextWindowSuffix('[1m]')).toBeUndefined();
    expect(applyContextWindowSuffix('[1M]   ')).toBeUndefined();
    expect(applyContextWindowSuffix('   ')).toBeUndefined();
  });
});
