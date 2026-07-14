import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  decodeAgentPlanAsrServerMessage,
  defaultAgentPlanAsrRequest,
  encodeAgentPlanAsrAudio,
  encodeAgentPlanAsrFullRequest,
} from './asr-protocol';

function serverResult(payload: Record<string, unknown>, sequence = 1, final = false): Buffer {
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload)));
  const header = Buffer.from([0x11, final ? 0x93 : 0x91, 0x11, 0x00]);
  const sequenceBytes = Buffer.alloc(4);
  sequenceBytes.writeInt32BE(final ? -Math.abs(sequence) : sequence);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(compressed.length);
  return Buffer.concat([header, sequenceBytes, size, compressed]);
}

describe('Agent Plan ASR binary protocol', () => {
  it('encodes the documented full client request as gzip JSON', () => {
    const frame = encodeAgentPlanAsrFullRequest(defaultAgentPlanAsrRequest('user-id'));
    expect([...frame.subarray(0, 4)]).toEqual([0x11, 0x10, 0x11, 0x00]);
    expect(frame.readUInt32BE(4)).toBe(frame.length - 8);
    expect(defaultAgentPlanAsrRequest('user-id').audio).toMatchObject({ format: 'pcm', codec: 'raw' });
  });

  it('encodes positive audio sequences and a negative final sequence', () => {
    const audio = Buffer.from([1, 2, 3, 4]);
    const normal = encodeAgentPlanAsrAudio(audio, 2);
    const final = encodeAgentPlanAsrAudio(audio, 3, true);

    expect([...normal.subarray(0, 4)]).toEqual([0x11, 0x21, 0x00, 0x00]);
    expect(normal.readInt32BE(4)).toBe(2);
    expect(normal.readUInt32BE(8)).toBe(4);
    expect([...final.subarray(0, 4)]).toEqual([0x11, 0x23, 0x00, 0x00]);
    expect(final.readInt32BE(4)).toBe(-3);
  });

  it('decodes partial and final gzip JSON server results', () => {
    expect(decodeAgentPlanAsrServerMessage(serverResult({ result: { text: '你好' } }, 2)))
      .toEqual({ type: 'result', sequence: 2, final: false, payload: { result: { text: '你好' } } });
    expect(decodeAgentPlanAsrServerMessage(serverResult({ result: { text: '你好世界' } }, 3, true)))
      .toMatchObject({ type: 'result', sequence: -3, final: true });
  });

  it('decodes upstream error frames without treating text as JSON', () => {
    const message = Buffer.from('permission denied');
    const code = Buffer.alloc(4);
    code.writeUInt32BE(401);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(message.length);
    const frame = Buffer.concat([Buffer.from([0x11, 0xf0, 0x00, 0x00]), code, size, message]);

    expect(decodeAgentPlanAsrServerMessage(frame))
      .toEqual({ type: 'error', code: 401, message: 'permission denied' });
  });
});
