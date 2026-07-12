import { describe, expect, it } from 'vitest';

import { shortenPathForDisplay } from '@/utils/pathDetection';

describe('shortenPathForDisplay', () => {
  it('shortens macOS and Windows user profile paths', () => {
    expect(shortenPathForDisplay('/Users/zhihu/Documents/project/BlexAgent')).toBe('~/Documents/project/BlexAgent');
    expect(shortenPathForDisplay('C:\\Users\\zhihu\\Documents\\project\\BlexAgent')).toBe('~/Documents/project/BlexAgent');
    expect(shortenPathForDisplay('D:/Users/zhihu/work/BlexAgent')).toBe('~/work/BlexAgent');
  });

  it('keeps non-user paths unchanged', () => {
    expect(shortenPathForDisplay('/opt/BlexAgent')).toBe('/opt/BlexAgent');
  });
});
