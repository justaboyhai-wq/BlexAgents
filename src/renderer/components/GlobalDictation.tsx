import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

import { apiPostJson } from '@/api/apiFetch';
import { useAgentPlanAsr } from '@/hooks/useAgentPlanAsr';
import { listenWithCleanup } from '@/utils/tauriListen';

interface GlobalDictationProps { enabled: boolean; }

/** Background push-to-talk dictation. It never activates or sends to BlexAgent. */
export default function GlobalDictation({ enabled }: GlobalDictationProps) {
  const textRef = useRef('');
  const setComposerText = useCallback((value: string) => {
    textRef.current = value;
  }, []);
  const asr = useAgentPlanAsr({
    enabled,
    scopeKey: 'global-os-dictation',
    apiPost: apiPostJson,
    getComposerText: useCallback(() => '', []),
    setComposerText,
  });
  const { state, error, audioLevels, start, stop } = asr;
  const startRef = useRef<Promise<void> | null>(null);
  const heldRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listenWithCleanup('global-dictation-start', () => {
      if (!enabled || heldRef.current) return;
      heldRef.current = true;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setComposerText('');
      void emit('voice-capsule-state', { kind: 'dictation', phase: 'recording', transcript: '', response: '', audioLevels: [] });
      startRef.current = start();
    }, controller.signal);
    void listenWithCleanup('global-dictation-stop', () => {
      if (!heldRef.current) return;
      heldRef.current = false;
      void (async () => {
        await emit('voice-capsule-state', { kind: 'dictation', phase: 'recognizing', transcript: textRef.current, response: '', audioLevels: [] });
        await startRef.current;
        const transcript = (await stop()).trim();
        startRef.current = null;
        if (!transcript) {
          await emit('voice-capsule-state', { kind: 'dictation', phase: 'error', transcript: '', response: '', error: '没有识别到语音，请重试', audioLevels: [] });
          hideTimerRef.current = setTimeout(() => { void invoke('cmd_hide_voice_capsule'); }, 1200);
          return;
        }
        await emit('voice-capsule-state', { kind: 'dictation', phase: 'writing', transcript, response: '', audioLevels: [] });
        await invoke('cmd_insert_global_dictation_text', { text: transcript });
        await emit('voice-capsule-state', { kind: 'dictation', phase: 'complete', transcript, response: '', audioLevels: [] });
        setComposerText('');
        hideTimerRef.current = setTimeout(() => { void invoke('cmd_hide_voice_capsule'); }, 650);
      })().catch(cause => {
        console.error('[global-dictation] failed:', cause);
        void emit('voice-capsule-state', { kind: 'dictation', phase: 'error', transcript: '', response: '', error: '语音输入失败', audioLevels: [] });
        hideTimerRef.current = setTimeout(() => { void invoke('cmd_hide_voice_capsule'); }, 1200);
      });
    }, controller.signal);
    return () => {
      controller.abort();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [enabled, setComposerText, start, stop]);

  useEffect(() => {
    if (!heldRef.current) return;
    void emit('voice-capsule-state', {
      kind: 'dictation',
      phase: state === 'starting' || state === 'recording' ? 'recording' : 'recognizing',
      transcript: textRef.current,
      response: '',
      audioLevels,
      error: error ?? undefined,
    });
  }, [audioLevels, error, state]);

  return null;
}
