import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { consumeAgentPlanTtsResponse, normalizeTextForSpeech } from './tts';

const scratch: string[] = [];

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Agent Plan TTS', () => {
  it('cleans Markdown and omits fenced code before synthesis', () => {
    expect(normalizeTextForSpeech('# 标题\n\n正文 **加粗** [链接](https://example.com)\n```ts\nalert(1)\n```'))
      .toBe('标题 正文 加粗 链接 代码块已省略。');
  });

  it('streams line-delimited base64 audio into a file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'blexagent-agent-plan-tts-'));
    scratch.push(dir);
    const destination = join(dir, 'speech.mp3');
    const body = [
      JSON.stringify({ code: 0, data: Buffer.from('first').toString('base64') }),
      JSON.stringify({ code: 0, data: Buffer.from('second').toString('base64') }),
      JSON.stringify({ code: 20_000_000 }),
      '',
    ].join('\n');

    const size = await consumeAgentPlanTtsResponse(new Response(body), destination);

    expect(size).toBe(11);
    expect(readFileSync(destination, 'utf8')).toBe('firstsecond');
  });

  it('rejects an incomplete response without audio', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'blexagent-agent-plan-tts-'));
    scratch.push(dir);
    const destination = join(dir, 'speech.mp3');

    await expect(consumeAgentPlanTtsResponse(
      new Response(`${JSON.stringify({ code: 0 })}\n`),
      destination,
    )).rejects.toMatchObject({ code: 'invalid-response' });
  });
});
