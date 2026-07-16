export interface CapsuleTranscriptEnvelope {
  id: string;
  transcript: string;
}

const PENDING_KEY = 'blex:pending-voice-capsule-transcript';
const RECEIVED_KEY = 'blex:received-voice-capsule-transcripts';
const MAX_RECEIVED_IDS = 32;

function isEnvelope(value: unknown): value is CapsuleTranscriptEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapsuleTranscriptEnvelope>;
  return typeof candidate.id === 'string'
    && candidate.id.length > 0
    && typeof candidate.transcript === 'string'
    && candidate.transcript.trim().length > 0;
}

export function createCapsuleTranscriptEnvelope(transcript: string): CapsuleTranscriptEnvelope {
  return {
    id: typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    transcript: transcript.trim(),
  };
}

export function storePendingCapsuleTranscript(envelope: CapsuleTranscriptEnvelope): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(envelope));
}

export function readPendingCapsuleTranscript(): CapsuleTranscriptEnvelope | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isEnvelope(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingCapsuleTranscript(id: string): void {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return;
  try {
    const value: unknown = JSON.parse(raw);
    if (isEnvelope(value) && value.id === id) sessionStorage.removeItem(PENDING_KEY);
  } catch {
    sessionStorage.removeItem(PENDING_KEY);
  }
}

/**
 * Returns true once per transcript id in this renderer lifetime, including
 * across React remounts/HMR. The bounded sessionStorage journal prevents a
 * capsule retry from creating a second turn when its acknowledgement was lost.
 */
export function markCapsuleTranscriptReceived(id: string): boolean {
  let received: string[] = [];
  try {
    const raw = sessionStorage.getItem(RECEIVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) received = parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    received = [];
  }
  if (received.includes(id)) return false;
  received.push(id);
  sessionStorage.setItem(RECEIVED_KEY, JSON.stringify(received.slice(-MAX_RECEIVED_IDS)));
  return true;
}
