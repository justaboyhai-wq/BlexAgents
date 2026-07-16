import { useCallback, useEffect, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';

import { apiPostJson } from '@/api/apiFetch';
import { useAgentPlanAsr } from '@/hooks/useAgentPlanAsr';

interface GlobalVoiceWakeOverlayProps { enabled: boolean; }

/** Owns voice capture when no mounted Chat exists; the capsule is presentation-only. */
export default function GlobalVoiceWakeOverlay({ enabled }: GlobalVoiceWakeOverlayProps) {
  const [text, setText] = useState('');
  const textRef = useRef('');
  const getText = useCallback(() => textRef.current, []);
  const setComposerText = useCallback((value: string) => {
    textRef.current = value;
    setText(value);
  }, []);
  const asr = useAgentPlanAsr({
    enabled,
    scopeKey: 'global-voice-fallback',
    apiPost: apiPostJson,
    getComposerText: getText,
    setComposerText,
  });
  const { audioLevels, start, stop } = asr;
  const startPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const handleStart = () => {
      setComposerText('');
      void emit('voice-capsule-state', { kind: 'ai', phase: 'recording', transcript: '', response: '', audioLevels: [] });
      startPromiseRef.current = start();
    };
    const handleStop = () => {
      void (async () => {
        await startPromiseRef.current;
        const transcript = (await stop()).trim();
        startPromiseRef.current = null;
        if (!transcript) {
          await emit('voice-capsule-state', { kind: 'ai', phase: 'error', transcript: '', response: '', error: '没有识别到语音，请重试', audioLevels: [] });
          return;
        }
        await emit('voice-capsule-state', { kind: 'ai', phase: 'thinking', transcript, response: '', audioLevels: [] });
        sessionStorage.setItem('blex:pending-voice-capsule-turn', transcript);
        window.dispatchEvent(new CustomEvent('blex:voice-capsule-turn', { detail: { transcript } }));
        window.dispatchEvent(new CustomEvent('blex:voice-ordinary-chat', { detail: { transcript } }));
      })();
    };
    window.addEventListener('blex:global-voice-fallback-start', handleStart);
    window.addEventListener('blex:global-voice-fallback-stop', handleStop);
    return () => {
      window.removeEventListener('blex:global-voice-fallback-start', handleStart);
      window.removeEventListener('blex:global-voice-fallback-stop', handleStop);
    };
  }, [setComposerText, start, stop]);

  useEffect(() => {
    if (asr.state === 'idle') return;
    void emit('voice-capsule-state', { kind: 'ai', phase: 'recording', transcript: text, response: '', audioLevels, error: asr.error ?? undefined });
  }, [asr.error, asr.state, audioLevels, text]);

  return null;
}
