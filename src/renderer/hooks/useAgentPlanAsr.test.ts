import { describe, expect, it } from 'vitest';

import { resampleToPcm16 } from './useAgentPlanAsr';

describe('Agent Plan ASR audio conversion', () => {
  it('resamples mono float audio to little-endian 16 kHz PCM16', () => {
    const input = new Float32Array(48_000);
    input.fill(0.5);
    const pcm = resampleToPcm16(input, 48_000);
    const view = new DataView(pcm.buffer);

    expect(pcm.byteLength).toBe(16_000 * 2);
    expect(view.getInt16(0, true)).toBeCloseTo(16_384, -1);
  });

  it('clamps out-of-range samples', () => {
    const pcm = resampleToPcm16(new Float32Array([2, -2]), 16_000);
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(32_767);
    expect(view.getInt16(2, true)).toBe(-32_768);
  });
});
