import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearPendingCapsuleTranscript,
  createCapsuleTranscriptEnvelope,
  markCapsuleTranscriptReceived,
  readPendingCapsuleTranscript,
  storePendingCapsuleTranscript,
} from './capsuleTranscriptBridge';

describe('capsule transcript bridge journal', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps a pending transcript until the matching consumer clears it', () => {
    const envelope = createCapsuleTranscriptEnvelope('  明天天气怎么样  ');
    storePendingCapsuleTranscript(envelope);

    expect(readPendingCapsuleTranscript()).toEqual({
      id: envelope.id,
      transcript: '明天天气怎么样',
    });

    clearPendingCapsuleTranscript('another-id');
    expect(readPendingCapsuleTranscript()).toEqual(envelope);

    clearPendingCapsuleTranscript(envelope.id);
    expect(readPendingCapsuleTranscript()).toBeNull();
  });

  it('accepts each retried transcript id only once', () => {
    expect(markCapsuleTranscriptReceived('turn-1')).toBe(true);
    expect(markCapsuleTranscriptReceived('turn-1')).toBe(false);
    expect(markCapsuleTranscriptReceived('turn-2')).toBe(true);
  });
});
