import { describe, expect, it } from 'vitest';

import { extractAgentPlanAsrUpdate } from './asr';

describe('Agent Plan ASR result normalization', () => {
  it('returns partial text without marking it final', () => {
    expect(extractAgentPlanAsrUpdate({ result: { text: '你好', utterances: [{ definite: false }] } }, false))
      .toEqual({ text: '你好', final: false });
  });

  it('marks text final from a final frame or definite utterances', () => {
    expect(extractAgentPlanAsrUpdate({ result: { text: '你好世界' } }, true))
      .toEqual({ text: '你好世界', final: true });
    expect(extractAgentPlanAsrUpdate({ result: { text: '完成', utterances: [{ definite: true }] } }, false))
      .toEqual({ text: '完成', final: true });
  });

  it('ignores frames without recognition text', () => {
    expect(extractAgentPlanAsrUpdate({ audio_info: { duration: 120 } }, false)).toBeNull();
  });
});
