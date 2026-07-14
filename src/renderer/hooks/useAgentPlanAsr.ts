import { useCallback, useEffect, useRef, useState } from 'react';

type ApiPost = <T>(path: string, body?: unknown, opts?: { signal?: AbortSignal }) => Promise<T>;

interface AsrUpdate {
  text: string;
  final: boolean;
}

interface AsrResponse {
  success: boolean;
  sessionId?: string;
  update?: AsrUpdate;
  code?: string;
  error?: string;
}

export type AgentPlanAsrState = 'idle' | 'starting' | 'recording' | 'stopping';

export function resampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16_000): Uint8Array {
  if (inputRate <= 0 || outputRate <= 0 || input.length === 0) return new Uint8Array();
  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const bytes = new Uint8Array(outputLength * 2);
  const view = new DataView(bytes.buffer);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex++) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.max(start + 1, Math.min(input.length, Math.floor((outputIndex + 1) * ratio)));
    let sum = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex++) sum += input[inputIndex];
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(outputIndex * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const blockSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    const block = bytes.subarray(offset, Math.min(offset + blockSize, bytes.length));
    binary += String.fromCharCode(...block);
  }
  return btoa(binary);
}

export function useAgentPlanAsr(input: {
  enabled: boolean;
  scopeKey: string;
  apiPost: ApiPost;
  getComposerText: () => string;
  setComposerText: (value: string) => void;
}) {
  const { enabled, scopeKey, apiPost, getComposerText, setComposerText } = input;
  const [state, setState] = useState<AgentPlanAsrState>('idle');
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const baseTextRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const pendingPcmRef = useRef<Uint8Array[]>([]);
  const pendingBytesRef = useRef(0);
  const sendQueueRef = useRef(Promise.resolve());
  const scopeKeyRef = useRef(scopeKey);
  const apiPostRef = useRef(apiPost);
  apiPostRef.current = apiPost;
  const setComposerTextRef = useRef(setComposerText);
  setComposerTextRef.current = setComposerText;

  const applyTranscript = useCallback((update?: AsrUpdate) => {
    if (!update?.text) return;
    const base = baseTextRef.current.trimEnd();
    setComposerTextRef.current(base ? `${base}\n${update.text}` : update.text);
  }, []);

  const teardownAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
    }
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    void audioContextRef.current?.close().catch(() => undefined);
    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }, []);

  const enqueuePendingAudio = useCallback((force: boolean) => {
    const byteCount = pendingBytesRef.current;
    if (byteCount === 0 || (!force && byteCount < 8_000)) return;
    const combined = new Uint8Array(byteCount);
    let offset = 0;
    for (const chunk of pendingPcmRef.current) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    pendingPcmRef.current = [];
    pendingBytesRef.current = 0;
    const capturedSessionId = sessionIdRef.current;
    if (!capturedSessionId) return;

    sendQueueRef.current = sendQueueRef.current.then(async () => {
      if (sessionIdRef.current !== capturedSessionId) return;
      const response = await apiPostRef.current<AsrResponse>('/api/agent-plan/asr/chunk', {
        sessionId: capturedSessionId,
        audioBase64: bytesToBase64(combined),
      });
      applyTranscript(response.update);
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Agent Plan ASR failed.');
    });
  }, [applyTranscript]);

  const cancel = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    teardownAudio();
    pendingPcmRef.current = [];
    pendingBytesRef.current = 0;
    setComposerTextRef.current(baseTextRef.current);
    if (sessionId) {
      await apiPostRef.current('/api/agent-plan/asr/cancel', { sessionId }).catch(() => undefined);
    }
    setState('idle');
  }, [teardownAudio]);

  const stop = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    setState('stopping');
    teardownAudio();
    enqueuePendingAudio(true);
    await sendQueueRef.current;
    try {
      const response = await apiPostRef.current<AsrResponse>('/api/agent-plan/asr/stop', { sessionId });
      applyTranscript(response.update);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent Plan ASR failed.');
    } finally {
      sessionIdRef.current = null;
      setState('idle');
    }
  }, [applyTranscript, enqueuePendingAudio, teardownAudio]);

  const start = useCallback(async () => {
    if (!enabled || sessionIdRef.current) return;
    setState('starting');
    setError(null);
    baseTextRef.current = getComposerText();
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = media;
      const response = await apiPostRef.current<AsrResponse>('/api/agent-plan/asr/start', {});
      if (!response.sessionId) throw new Error(response.error || 'Agent Plan ASR failed to start.');
      sessionIdRef.current = response.sessionId;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(media);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.onaudioprocess = event => {
        const sourceSamples = event.inputBuffer.getChannelData(0);
        const samples = new Float32Array(sourceSamples.length);
        samples.set(sourceSamples);
        const pcm = resampleToPcm16(samples, audioContext.sampleRate);
        if (pcm.length === 0) return;
        pendingPcmRef.current.push(pcm);
        pendingBytesRef.current += pcm.length;
        enqueuePendingAudio(false);
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      setState('recording');
    } catch (err) {
      teardownAudio();
      sessionIdRef.current = null;
      setError(err instanceof Error ? err.message : 'Microphone access failed.');
      setState('idle');
    }
  }, [enabled, enqueuePendingAudio, getComposerText, teardownAudio]);

  const toggle = useCallback(() => {
    if (state === 'recording') return stop();
    if (state === 'idle') return start();
    return Promise.resolve();
  }, [start, state, stop]);

  useEffect(() => {
    if (scopeKeyRef.current === scopeKey) return;
    scopeKeyRef.current = scopeKey;
    if (sessionIdRef.current) void cancel();
  }, [cancel, scopeKey]);

  useEffect(() => () => {
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    teardownAudio();
    if (sessionId) void apiPostRef.current('/api/agent-plan/asr/cancel', { sessionId }).catch(() => undefined);
  }, [teardownAudio]);

  return { state, error, toggle, stop, cancel };
}
