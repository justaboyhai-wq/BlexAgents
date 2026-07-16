import { describe, expect, it } from 'vitest';

import { completedSpeechPrefix } from './voiceStreaming';

describe('completedSpeechPrefix', () => {
  it('holds incomplete text and releases complete sentences together', () => {
    expect(completedSpeechPrefix('你好', 0)).toEqual({ segment: '', nextOffset: 0 });
    expect(completedSpeechPrefix('你好。第二句！尾巴', 0)).toEqual({
      segment: '你好。第二句！',
      nextOffset: 7,
    });
  });

  it('continues from the consumed character offset', () => {
    expect(completedSpeechPrefix('你好。下一句？', 3)).toEqual({ segment: '下一句？', nextOffset: 7 });
  });
});
