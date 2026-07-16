import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { ArrowUpRight, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

import { listenWithCleanup } from '@/utils/tauriListen';
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

function initialCapsuleKind(): CapsuleKind {
  return new URLSearchParams(window.location.search).get('voiceCapsuleKind') === 'dictation'
    ? 'dictation'
    : 'ai';
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

  useEffect(() => {
    const controller = new AbortController();
    void listenWithCleanup<CapsuleState>('voice-capsule-state', event => setState(event.payload), controller.signal);
    return () => controller.abort();
  }, []);

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
