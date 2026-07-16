import { describe, expect, it } from 'vitest';

import { computeAudioLevels } from './useAgentPlanAsr';

describe('computeAudioLevels', () => {
  it('returns a stable zero-filled spectrum for silence', () => {
    expect(computeAudioLevels(new Float32Array(210), 21)).toEqual(Array.from({ length: 21 }, () => 0));
  });

  it('maps louder sample regions to taller normalized bars', () => {
    const samples = new Float32Array(210);
    samples.fill(0.02, 0, 70);
    samples.fill(0.08, 70, 140);
    samples.fill(0.4, 140);
    const levels = computeAudioLevels(samples, 3);
    expect(levels).toHaveLength(3);
    expect(levels[0]).toBeLessThan(levels[1]);
    expect(levels[1]).toBeLessThan(levels[2]);
    expect(levels.every(level => level >= 0 && level <= 1)).toBe(true);
  });
});
