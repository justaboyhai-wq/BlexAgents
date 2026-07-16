import { gunzipSync, gzipSync } from 'node:zlib';

const PROTOCOL_VERSION = 1;
const HEADER_SIZE_WORDS = 1;

const MESSAGE_TYPE_FULL_CLIENT_REQUEST = 0x1;
const MESSAGE_TYPE_AUDIO_ONLY_REQUEST = 0x2;
const MESSAGE_TYPE_FULL_SERVER_RESPONSE = 0x9;
const MESSAGE_TYPE_SERVER_ACK = 0xb;
const MESSAGE_TYPE_ERROR = 0xf;

const FLAG_NO_SEQUENCE = 0x0;
const FLAG_POSITIVE_SEQUENCE = 0x1;
const FLAG_LAST_WITHOUT_SEQUENCE = 0x2;
const FLAG_NEGATIVE_SEQUENCE = 0x3;

const SERIALIZATION_NONE = 0x0;
const SERIALIZATION_JSON = 0x1;
const COMPRESSION_NONE = 0x0;
const COMPRESSION_GZIP = 0x1;

export interface AgentPlanAsrRequestPayload {
  user: { uid: string };
  audio: {
    /** Raw PCM frames are sent after the handshake; do not label them WAV. */
    format: 'pcm';
    codec: 'raw';
    rate: 16_000;
    bits: 16;
    channel: 1;
  };
  request: {
    model_name: 'bigmodel';
    enable_itn: true;
    enable_punc: true;
    enable_ddc: true;
    show_utterances: true;
    enable_nonstream: false;
  };
}

export type AgentPlanAsrServerMessage =
  | { type: 'result'; sequence?: number; final: boolean; payload: Record<string, unknown> }
  | { type: 'ack'; sequence?: number; final: boolean; payload?: Record<string, unknown> }
  | { type: 'error'; code: number; message: string };

function header(messageType: number, flags: number, serialization: number, compression: number): Buffer {
  return Buffer.from([
    (PROTOCOL_VERSION << 4) | HEADER_SIZE_WORDS,
    (messageType << 4) | flags,
    (serialization << 4) | compression,
    0,
  ]);
}

function uint32(value: number): Buffer {
  const out = Buffer.allocUnsafe(4);
  out.writeUInt32BE(value, 0);
  return out;
}

function int32(value: number): Buffer {
  const out = Buffer.allocUnsafe(4);
  out.writeInt32BE(value, 0);
  return out;
}

export function defaultAgentPlanAsrRequest(uid: string): AgentPlanAsrRequestPayload {
  return {
    user: { uid },
    audio: { format: 'pcm', codec: 'raw', rate: 16_000, bits: 16, channel: 1 },
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
      enable_ddc: true,
      show_utterances: true,
      enable_nonstream: false,
    },
  };
}

export function encodeAgentPlanAsrFullRequest(payload: AgentPlanAsrRequestPayload): Buffer {
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  return Buffer.concat([
    header(MESSAGE_TYPE_FULL_CLIENT_REQUEST, FLAG_NO_SEQUENCE, SERIALIZATION_JSON, COMPRESSION_GZIP),
    uint32(compressed.length),
    compressed,
  ]);
}

export function encodeAgentPlanAsrAudio(audio: Uint8Array, sequence: number, final = false): Buffer {
  const payload = Buffer.from(audio);
  const wireSequence = final ? -Math.abs(sequence) : Math.abs(sequence);
  const flags = final ? FLAG_NEGATIVE_SEQUENCE : FLAG_POSITIVE_SEQUENCE;
  return Buffer.concat([
    header(MESSAGE_TYPE_AUDIO_ONLY_REQUEST, flags, SERIALIZATION_NONE, COMPRESSION_NONE),
    int32(wireSequence),
    uint32(payload.length),
    payload,
  ]);
}

function decodePayload(payload: Buffer, serialization: number, compression: number): Record<string, unknown> | undefined {
  const bytes = compression === COMPRESSION_GZIP ? gunzipSync(payload) : payload;
  if (serialization !== SERIALIZATION_JSON || bytes.length === 0) return undefined;
  const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined;
}

export function decodeAgentPlanAsrServerMessage(input: Uint8Array): AgentPlanAsrServerMessage {
  const data = Buffer.from(input);
  if (data.length < 4) throw new Error('ASR frame is shorter than the protocol header.');

  const version = data[0] >> 4;
  const headerBytes = (data[0] & 0x0f) * 4;
  if (version !== PROTOCOL_VERSION || headerBytes < 4 || data.length < headerBytes) {
    throw new Error('ASR frame has an unsupported protocol header.');
  }

  const messageType = data[1] >> 4;
  const flags = data[1] & 0x0f;
  const serialization = data[2] >> 4;
  const compression = data[2] & 0x0f;
  let offset = headerBytes;

  if (messageType === MESSAGE_TYPE_ERROR) {
    if (data.length < offset + 8) throw new Error('ASR error frame is truncated.');
    const code = data.readUInt32BE(offset);
    offset += 4;
    const size = data.readUInt32BE(offset);
    offset += 4;
    if (data.length < offset + size) throw new Error('ASR error payload is truncated.');
    return { type: 'error', code, message: data.subarray(offset, offset + size).toString('utf8') };
  }

  let sequence: number | undefined;
  if (flags === FLAG_POSITIVE_SEQUENCE || flags === FLAG_NEGATIVE_SEQUENCE) {
    if (data.length < offset + 4) throw new Error('ASR response sequence is truncated.');
    sequence = data.readInt32BE(offset);
    offset += 4;
  }
  if (data.length < offset + 4) throw new Error('ASR response size is truncated.');
  const size = data.readUInt32BE(offset);
  offset += 4;
  if (data.length < offset + size) throw new Error('ASR response payload is truncated.');
  const payload = decodePayload(data.subarray(offset, offset + size), serialization, compression);
  const final = flags === FLAG_LAST_WITHOUT_SEQUENCE
    || flags === FLAG_NEGATIVE_SEQUENCE
    || (sequence !== undefined && sequence < 0);

  if (messageType === MESSAGE_TYPE_FULL_SERVER_RESPONSE) {
    if (!payload) throw new Error('ASR result frame did not contain JSON.');
    return { type: 'result', sequence, final, payload };
  }
  if (messageType === MESSAGE_TYPE_SERVER_ACK) {
    return { type: 'ack', sequence, final, payload };
  }
  throw new Error(`Unsupported ASR server message type: ${messageType}.`);
}
