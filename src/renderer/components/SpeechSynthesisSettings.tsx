import { Loader2, Volume2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { apiPostJson } from '@/api/apiFetch';
import CustomSelect from '@/components/CustomSelect';
import { useToast } from '@/components/Toast';
import { useConfig } from '@/hooks/useConfig';
import { playAudioBase64 } from '@/utils/audioPlayer';
import {
  DEFAULT_SPEECH_SYNTHESIS_SPEED,
  DEFAULT_SPEECH_SYNTHESIS_VOICE,
  normalizeSpeechSynthesisSpeed,
  normalizeSpeechSynthesisVolume,
  SPEECH_SYNTHESIS_VOICES,
} from '../../shared/speech-synthesis';

export default function SpeechSynthesisSettings() {
  const { t } = useTranslation('settings');
  const { config, updateConfig } = useConfig();
  const toast = useToast();
  const [previewing, setPreviewing] = useState(false);

  const preview = useCallback(async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      const response = await apiPostJson<{
        success: boolean;
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      }>('/api/agent-plan/tts/preview', {
        text: '明日复明日，明日何其多。',
        speaker: config.speechSynthesisVoice ?? DEFAULT_SPEECH_SYNTHESIS_VOICE,
        speed: normalizeSpeechSynthesisSpeed(config.speechSynthesisSpeed),
        volume: normalizeSpeechSynthesisVolume(config.speechSynthesisVolume),
      });
      if (!response.audioBase64) throw new Error(response.error || 'TTS preview did not return audio.');
      await playAudioBase64('speech-settings-preview', response.audioBase64, response.mimeType);
    } catch (error) {
      toast.error(t('floatingBallPet.toasts.voicePreviewFailed', {
        message: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setPreviewing(false);
    }
  }, [config.speechSynthesisSpeed, config.speechSynthesisVoice, config.speechSynthesisVolume, previewing, t, toast]);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-elevated)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-[var(--ink)]">{t('floatingBallPet.voiceTitle')}</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{t('floatingBallPet.voiceDescription')}</p>
        </div>
        <button
          type="button"
          onClick={() => void preview()}
          disabled={previewing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-inset)] disabled:cursor-wait disabled:opacity-60"
        >
          {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
          {t('floatingBallPet.voicePreview')}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex-1 pr-4">
          <p className="text-sm font-medium text-[var(--ink)]">{t('floatingBallPet.voiceRole')}</p>
          <p className="text-xs text-[var(--ink-muted)]">{t('floatingBallPet.voicePreviewText')}</p>
        </div>
        <CustomSelect
          value={config.speechSynthesisVoice ?? DEFAULT_SPEECH_SYNTHESIS_VOICE}
          options={SPEECH_SYNTHESIS_VOICES.map((voice) => ({ value: voice.id, label: voice.name }))}
          onChange={(value) => void updateConfig({ speechSynthesisVoice: value })}
          className="w-[220px]"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="flex-1 pr-4 text-sm font-medium text-[var(--ink)]">{t('floatingBallPet.voiceSpeed')}</p>
        <CustomSelect
          value={String(normalizeSpeechSynthesisSpeed(config.speechSynthesisSpeed))}
          options={[
            { value: '1.5', label: '0.8' },
            { value: '1.2', label: '1.0' },
            { value: String(DEFAULT_SPEECH_SYNTHESIS_SPEED), label: '1.2' },
            { value: '0.8', label: '1.5' },
          ].map((option) => ({
            value: option.value,
            label: t('floatingBallPet.voiceRatio', { value: option.label }),
          }))}
          onChange={(value) => void updateConfig({ speechSynthesisSpeed: Number(value) })}
          className="w-[220px]"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="flex-1 pr-4 text-sm font-medium text-[var(--ink)]">{t('floatingBallPet.voiceVolume')}</p>
        <div className="flex w-[220px] items-center gap-3">
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={normalizeSpeechSynthesisVolume(config.speechSynthesisVolume)}
            aria-label={t('floatingBallPet.voiceVolume')}
            onChange={(event) => void updateConfig({ speechSynthesisVolume: Number(event.target.value) })}
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--line)] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:shadow-md"
          />
          <span className="w-10 text-right text-xs tabular-nums text-[var(--ink-muted)]">
            {Math.round(normalizeSpeechSynthesisVolume(config.speechSynthesisVolume) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
