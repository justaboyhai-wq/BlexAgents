import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

import { apiPostJson } from '@/api/apiFetch';
import { useAgentPlanAsr } from '@/hooks/useAgentPlanAsr';
import { listenWithCleanup } from '@/utils/tauriListen';

interface GlobalDictationProps { enabled: boolean; }

/** Background push-to-talk dictation. It never activates or sends to BlexAgent. */
export default function GlobalDictation({ enabled }: GlobalDictationProps) {
  const textRef = useRef('');
  const [liveText, setLiveText] = useState('');
  const setComposerText = useCallback((value: string) => {
    textRef.current = value;
    setLiveText(value);
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
  const insertedTextRef = useRef('');
  const insertionQueueRef = useRef(Promise.resolve());
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listenWithCleanup('global-dictation-start', () => {
      if (!enabled || heldRef.current) return;
      heldRef.current = true;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setComposerText('');
      insertedTextRef.current = '';
      insertionQueueRef.current = Promise.resolve();
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
        await insertionQueueRef.current;
        await emit('voice-capsule-state', { kind: 'dictation', phase: 'writing', transcript, response: '', audioLevels: [] });
        await invoke('cmd_insert_global_dictation_text', {
          text: transcript,
          replaceCharacters: Array.from(insertedTextRef.current).length,
          finalize: true,
        });
        insertedTextRef.current = '';
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
      transcript: liveText,
      response: '',
      audioLevels,
      error: error ?? undefined,
    });
  }, [audioLevels, error, liveText, state]);

  useEffect(() => {
    if (!heldRef.current || !liveText || liveText === insertedTextRef.current) return;
    insertionQueueRef.current = insertionQueueRef.current.then(async () => {
      if (!heldRef.current) return;
      const previous = insertedTextRef.current;
      if (liveText === previous) return;
      await invoke('cmd_insert_global_dictation_text', {
        text: liveText,
        replaceCharacters: Array.from(previous).length,
        finalize: false,
      });
      insertedTextRef.current = liveText;
    }).catch(cause => {
      console.warn('[global-dictation] live insertion failed:', cause);
    });
  }, [liveText]);

  return null;
}
