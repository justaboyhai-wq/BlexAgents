import { MessageCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { listenWithCleanup } from '@/utils/tauriListen';
import { isTauriEnvironment } from '@/utils/browserMock';
import { apiPostJson } from '@/api/apiFetch';
import { useAgentPlanAsr } from '@/hooks/useAgentPlanAsr';
import { dispatchHelperRequest } from '@/utils/dispatchHelperRequest';

interface GlobalVoiceWakeOverlayProps { appVersion: string; enabled: boolean; }

/** Compact voice surface opened by the OS-level voice shortcut. */
export default function GlobalVoiceWakeOverlay({ appVersion, enabled }: GlobalVoiceWakeOverlayProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const autoStartedRef = useRef(false);
  const asr = useAgentPlanAsr({
    enabled: enabled && open,
    scopeKey: 'global-voice-wake',
    apiPost: apiPostJson,
    getComposerText: () => text,
    setComposerText: setText,
  });

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    const controller = new AbortController();
    void listenWithCleanup('global-voice-wake-start', () => {
      setText('');
      setOpen(true);
      autoStartedRef.current = true;
    }, controller.signal);
    void listenWithCleanup('global-voice-wake-stop', () => {
      autoStartedRef.current = false;
      if (asr.state === 'recording' || asr.state === 'starting') void asr.stop();
    }, controller.signal);
    return () => controller.abort();
  }, [asr]);

  useEffect(() => {
    if (!open || !autoStartedRef.current || asr.state !== 'idle') return;
    autoStartedRef.current = false;
    void asr.toggle();
  }, [asr, open]);

  const close = () => {
    void asr.cancel();
    autoStartedRef.current = false;
    setOpen(false);
  };
  const openFullChat = () => {
    if (!text.trim()) return;
    dispatchHelperRequest({ description: `请用简洁、直接的方式回答下面这句话，不要展开冗长解释：\n\n${text}`, appVersion, assistantEntry: 'other' });
    close();
  };
  if (!open) return null;

  const recording = asr.state === 'recording' || asr.state === 'starting';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[120] flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-[min(90vw,360px)] items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper-elevated)]/95 px-3 py-2 shadow-xl backdrop-blur-xl">
        <div className={`relative flex size-8 shrink-0 items-center justify-center rounded-full ${recording ? 'bg-[var(--accent)] text-white' : 'bg-[var(--paper-inset)] text-[var(--accent)]'}`}>
          <span className={`absolute inset-0 rounded-full border border-[var(--accent)] ${recording ? 'animate-ping opacity-40' : 'opacity-0'}`} />
          <span className="relative flex items-end gap-px" aria-hidden="true">
            <i className={`h-2 w-0.5 rounded-full bg-current ${recording ? 'animate-bounce [animation-delay:-180ms]' : ''}`} />
            <i className={`h-3 w-0.5 rounded-full bg-current ${recording ? 'animate-bounce [animation-delay:-90ms]' : ''}`} />
            <i className={`h-2.5 w-0.5 rounded-full bg-current ${recording ? 'animate-bounce' : ''}`} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--ink)]">{text || (recording ? '正在聆听…' : '按住右 Alt 说话')}</p>
          {asr.error ? <p className="truncate text-xs text-red-500">{asr.error}</p> : <p className="text-xs text-[var(--ink-muted)]">{recording ? '松开结束录音' : '语音胶囊已就绪'}</p>}
        </div>
        {text.trim() && !recording && <button type="button" onClick={openFullChat} className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"><MessageCircle className="size-3.5" />简短回答</button>}
        <button type="button" onClick={close} className="shrink-0 rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--paper-inset)]" aria-label="关闭"><X className="size-3.5" /></button>
      </div>
    </div>
  );
}
