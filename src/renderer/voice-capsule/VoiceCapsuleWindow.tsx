import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { ArrowUpRight, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiPostJson } from '@/api/apiFetch';
import { useAgentPlanAsr } from '@/hooks/useAgentPlanAsr';
import { listenWithCleanup } from '@/utils/tauriListen';
import {
  createCapsuleTranscriptEnvelope,
  type CapsuleTranscriptEnvelope,
} from './capsuleTranscriptBridge';
import './voiceCapsule.css';

type CapsuleKind = 'ai' | 'dictation';
type CapsulePhase = 'idle' | 'recording' | 'recognizing' | 'writing' | 'thinking' | 'answering' | 'complete' | 'error';
interface CapsuleState {
  kind: CapsuleKind;
  phase: CapsulePhase;
  transcript: string;
  response: string;
  audioLevels?: number[];
  error?: string;
}

const BAR_COUNT = 21;
const EMPTY_LEVELS = Array.from({ length: BAR_COUNT }, () => 0);
const MAX_CAPTURE_MS = 90_000;
const TRANSCRIPT_RETRY_MS = 400;

function initialCapsuleKind(): CapsuleKind {
  return new URLSearchParams(window.location.search).get('voiceCapsuleKind') === 'dictation'
    ? 'dictation'
    : 'ai';
}

interface VoiceWakeSnapshot {
  held: boolean;
  surface: 'chat' | 'capsule' | null;
  revision: number;
}

const INITIAL_STATE: CapsuleState = {
  kind: initialCapsuleKind(),
  phase: 'recording',
  transcript: '',
  response: '',
  audioLevels: EMPTY_LEVELS,
};

function normalizeLevels(levels: number[] | undefined): number[] {
  if (!levels || levels.length === 0) return EMPTY_LEVELS;
  return Array.from({ length: BAR_COUNT }, (_, index) => Math.max(0, Math.min(1, levels[index] ?? 0)));
}

export default function VoiceCapsuleWindow() {
  const [state, setState] = useState(INITIAL_STATE);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const textRef = useRef('');
  const heldRef = useRef(false);
  const wakeHeldRef = useRef(false);
  const desiredWakeRevisionRef = useRef(0);
  const activeWakeRevisionRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const latestWakeRevisionRef = useRef(0);
  const beginCaptureRef = useRef<() => void>(() => undefined);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTranscriptRef = useRef<CapsuleTranscriptEnvelope | null>(null);

  const getComposerText = useCallback(() => '', []);
  const setComposerText = useCallback((value: string) => {
    textRef.current = value;
    setState(current => ({
      ...current,
      kind: 'ai',
      phase: 'recording',
      transcript: value,
      response: '',
      error: undefined,
    }));
  }, []);
  const asr = useAgentPlanAsr({
    enabled: true,
    scopeKey: 'voice-capsule-window',
    apiPost: apiPostJson,
    getComposerText,
    setComposerText,
  });
  const {
    audioLevels,
    error: asrError,
    start: startAsr,
    state: asrState,
    stop: stopAsr,
  } = asr;

  const clearCaptureTimeout = useCallback(() => {
    if (!captureTimeoutRef.current) return;
    clearTimeout(captureTimeoutRef.current);
    captureTimeoutRef.current = null;
  }, []);

  const clearTranscriptRetry = useCallback(() => {
    if (!transcriptRetryRef.current) return;
    clearInterval(transcriptRetryRef.current);
    transcriptRetryRef.current = null;
  }, []);

  const publishTranscript = useCallback(
    (transcript: string) => {
      clearTranscriptRetry();
      const envelope = createCapsuleTranscriptEnvelope(transcript);
      pendingTranscriptRef.current = envelope;
      const send = () => {
        if (pendingTranscriptRef.current?.id !== envelope.id) return;
        void emit('voice-capsule-transcript', envelope).catch(cause => {
          console.warn('[voice-capsule] transcript delivery attempt failed:', cause);
        });
      };
      send();
      // Tauri events are transient. Keep replaying until the main renderer has
      // durably journaled the turn and acknowledges this exact id. This covers
      // main-window boot, HMR, and a temporarily suspended renderer.
      transcriptRetryRef.current = setInterval(send, TRANSCRIPT_RETRY_MS);
    },
    [clearTranscriptRetry],
  );

  const finishCapture = useCallback(() => {
    if (!heldRef.current || finishingRef.current) return;
    heldRef.current = false;
    finishingRef.current = true;
    clearCaptureTimeout();
    setState(current => ({
      ...current,
      kind: 'ai',
      phase: 'recognizing',
      audioLevels: EMPTY_LEVELS,
    }));
    void (async () => {
      try {
        await startPromiseRef.current;
        const transcript = (await stopAsr()).trim();
        startPromiseRef.current = null;
        if (!transcript) {
          setState(current => ({
            ...current,
            kind: 'ai',
            phase: 'error',
            transcript: '',
            response: '',
            audioLevels: EMPTY_LEVELS,
            error: '没有识别到语音，请重试',
          }));
          return;
        }
        setState(current => ({
          ...current,
          kind: 'ai',
          phase: 'thinking',
          transcript,
          response: '',
          audioLevels: EMPTY_LEVELS,
          error: undefined,
        }));
        publishTranscript(transcript);
      } catch (cause) {
        console.error('[voice-capsule] failed to finish capture:', cause);
        setState(current => ({
          ...current,
          kind: 'ai',
          phase: 'error',
          response: '',
          audioLevels: EMPTY_LEVELS,
          error: '语音识别失败，请重试',
        }));
      } finally {
        activeWakeRevisionRef.current = null;
        finishingRef.current = false;
        // A recovered native edge can close a stale capture and deliver the
        // next DOWN while `/asr/stop` is still finalizing. Desired native
        // state is durable; begin the replacement turn once cleanup finishes.
        if (wakeHeldRef.current) queueMicrotask(() => beginCaptureRef.current());
      }
    })();
  }, [clearCaptureTimeout, publishTranscript, stopAsr]);

  const finishCaptureRef = useRef(finishCapture);
  finishCaptureRef.current = finishCapture;

  const beginCapture = useCallback(() => {
    if (heldRef.current || finishingRef.current) return;
    heldRef.current = true;
    activeWakeRevisionRef.current = desiredWakeRevisionRef.current;
    textRef.current = '';
    setState({
      kind: 'ai',
      phase: 'recording',
      transcript: '',
      response: '',
      audioLevels: EMPTY_LEVELS,
    });
    console.info('[voice-capsule] visible capsule owns AI-key ASR capture');
    startPromiseRef.current = startAsr();
    clearCaptureTimeout();
    captureTimeoutRef.current = setTimeout(() => {
      console.warn('[voice-capsule] capture exceeded safety limit; finalizing');
      wakeHeldRef.current = false;
      finishCaptureRef.current();
    }, MAX_CAPTURE_MS);
  }, [clearCaptureTimeout, startAsr]);
  beginCaptureRef.current = beginCapture;

  useEffect(() => {
    const controller = new AbortController();
    const acceptRevision = (revision: number | undefined): boolean => {
      if (!Number.isFinite(revision)) return true;
      const next = Number(revision);
      if (next < latestWakeRevisionRef.current) return false;
      latestWakeRevisionRef.current = next;
      return true;
    };
    const applyWakeState = (
      held: boolean,
      surface: 'chat' | 'capsule' | null,
      revision?: number,
    ) => {
      if (!acceptRevision(revision)) return;
      if (Number.isFinite(revision)) {
        desiredWakeRevisionRef.current = Number(revision);
      }
      wakeHeldRef.current = held && surface === 'capsule';
      if (!wakeHeldRef.current) {
        finishCaptureRef.current();
        return;
      }
      // A newer DOWN is a new physical turn even if its preceding synthetic
      // UP event was lost. Rotate the ASR owner instead of treating it as a
      // harmless repeat of the stale capture.
      if (
        heldRef.current
        && activeWakeRevisionRef.current !== null
        && activeWakeRevisionRef.current !== desiredWakeRevisionRef.current
      ) {
        finishCaptureRef.current();
        return;
      }
      beginCaptureRef.current();
    };

    void (async () => {
      // Install listeners before reading the native snapshot. Every later edge
      // carries a monotonically increasing revision, so a stale invoke result
      // cannot overwrite an event that arrived while the command was in flight.
      await Promise.all([
        listenWithCleanup<CapsuleState>(
          'voice-capsule-state',
          event => setState(event.payload),
          controller.signal,
        ),
        listenWithCleanup<{ surface?: 'chat' | 'capsule'; revision?: number }>(
          'global-voice-wake-start',
          event => {
            applyWakeState(
              true,
              event.payload?.surface ?? null,
              event.payload?.revision,
            );
          },
          controller.signal,
        ),
        listenWithCleanup<{ surface?: 'chat' | 'capsule'; revision?: number }>(
          'global-voice-wake-stop',
          event => {
            applyWakeState(
              false,
              event.payload?.surface ?? null,
              event.payload?.revision,
            );
          },
          controller.signal,
        ),
        listenWithCleanup<{ id?: string }>(
          'voice-capsule-transcript-ack',
          event => {
            if (
              !event.payload?.id
              || event.payload.id !== pendingTranscriptRef.current?.id
            ) return;
            console.info(
              `[voice-capsule] transcript acknowledged id=${event.payload.id}`,
            );
            pendingTranscriptRef.current = null;
            clearTranscriptRetry();
          },
          controller.signal,
        ),
      ]);
      if (controller.signal.aborted || INITIAL_STATE.kind !== 'ai') return;
      try {
        const snapshot = await invoke<VoiceWakeSnapshot>(
          'cmd_get_global_voice_wake_snapshot',
        );
        if (!controller.signal.aborted) {
          applyWakeState(snapshot.held, snapshot.surface, snapshot.revision);
          console.info(
            `[voice-capsule] native wake snapshot held=${snapshot.held} surface=${snapshot.surface ?? 'none'} revision=${snapshot.revision}`,
          );
        }
      } catch (cause) {
        console.warn('[voice-capsule] failed to read native wake snapshot:', cause);
      }
    })();

    return () => {
      controller.abort();
      wakeHeldRef.current = false;
      clearCaptureTimeout();
      clearTranscriptRetry();
    };
  }, [beginCapture, clearCaptureTimeout, clearTranscriptRetry]);

  useEffect(() => {
    if (!heldRef.current) return;
    const nextState: CapsuleState = {
      kind: 'ai',
      phase: asrState === 'starting' || asrState === 'recording'
        ? 'recording'
        : 'recognizing',
      transcript: textRef.current,
      response: '',
      audioLevels,
      error: asrError ?? undefined,
    };
    setState(nextState);
    void emit('voice-capsule-state', nextState);
  }, [asrError, asrState, audioLevels]);

  const levels = normalizeLevels(state.audioLevels);
  const hasLiveLevels = levels.some(level => level > 0.015);
  const showAnswer = state.kind === 'ai'
    && !!state.response
    && (state.phase === 'answering' || state.phase === 'complete');

  const toggleSpeech = () => {
    const enabled = !speechEnabled;
    setSpeechEnabled(enabled);
    void emit('voice-capsule-speech-toggle', { enabled });
  };

  return (
    <main className="voice-capsule-root">
      <section className={`voice-answer ${showAnswer ? 'voice-answer--visible' : ''}`} aria-hidden={!showAnswer}>
        <p>{state.response}</p>
        <div className="voice-answer__actions">
          <button type="button" aria-label="转到 BlexAgent 主窗口" title="转到 BlexAgent 主窗口" onPointerDown={event => { event.stopPropagation(); void invoke('cmd_open_main_from_voice_capsule'); }}>
            <ArrowUpRight />
          </button>
          <button
            type="button"
            className={speechEnabled ? 'is-enabled' : ''}
            aria-label={speechEnabled ? '关闭自动语音播放' : '开启自动语音播放'}
            title={speechEnabled ? '自动语音播放：已开启' : '自动语音播放：已关闭'}
            aria-pressed={speechEnabled}
            onPointerDown={event => { event.stopPropagation(); toggleSpeech(); }}
          >
            {speechEnabled ? <Volume2 className={state.phase === 'answering' ? 'is-speaking' : ''} /> : <VolumeX />}
          </button>
          <button
            type="button"
            aria-label="关闭语音交互"
            title="关闭"
            onPointerDown={event => { event.stopPropagation(); void invoke('cmd_hide_voice_capsule'); }}
          >
            <X />
          </button>
        </div>
      </section>

      <section
        className={`voice-spectrum ${hasLiveLevels ? 'voice-spectrum--live' : ''}`}
        data-kind={state.kind}
        data-phase={state.phase}
        aria-label={state.kind === 'ai' ? 'AI 语音交互状态' : '全局语音输入状态'}
        title={state.error || undefined}
      >
        {levels.map((level, index) => (
          <i
            // Fixed physical bars intentionally use their stable position as identity.
            key={index}
            style={{ height: `${3 + level * 19}px`, opacity: 0.45 + level * 0.55 }}
          />
        ))}
      </section>
    </main>
  );
}
