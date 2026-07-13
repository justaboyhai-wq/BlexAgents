import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  exists: fsMocks.exists,
  mkdir: vi.fn(),
  readTextFile: fsMocks.readTextFile,
  writeTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
}));
vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn(async () => 'D:\\Users\\test'),
  join: vi.fn(async (...parts: string[]) => parts.join('\\')),
  dirname: vi.fn(async () => 'D:\\Users\\test'),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/utils/browserMock', () => ({ isBrowserDevMode: vi.fn(() => false) }));

import { JsonStoreUnreadableError, safeLoadJsonStrict } from './configStore';

describe('safeLoadJsonStrict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws instead of treating three unreadable recovery candidates as an empty store', async () => {
    fsMocks.exists.mockResolvedValue(true);
    fsMocks.readTextFile.mockRejectedValue(new Error('disk read failed'));

    await expect(safeLoadJsonStrict('projects.json', Array.isArray))
      .rejects.toBeInstanceOf(JsonStoreUnreadableError);
    expect(fsMocks.readTextFile).toHaveBeenCalledTimes(3);
  });

  it('recovers from a valid backup when the main file is invalid', async () => {
    fsMocks.exists.mockResolvedValue(true);
    fsMocks.readTextFile
      .mockResolvedValueOnce('{ invalid json')
      .mockResolvedValueOnce('[{"id":"project-1"}]');

    await expect(safeLoadJsonStrict('projects.json', Array.isArray))
      .resolves.toEqual([{ id: 'project-1' }]);
    expect(fsMocks.readTextFile).toHaveBeenCalledTimes(2);
  });

  it('returns null only when no main, backup, or temporary file exists', async () => {
    fsMocks.exists.mockResolvedValue(false);

    await expect(safeLoadJsonStrict('projects.json', Array.isArray)).resolves.toBeNull();
    expect(fsMocks.readTextFile).not.toHaveBeenCalled();
  });
});
