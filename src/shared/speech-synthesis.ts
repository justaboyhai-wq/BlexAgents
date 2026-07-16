export const DEFAULT_SPEECH_SYNTHESIS_VOICE = 'zh_female_vv_uranus_bigtts';
export const DEFAULT_SPEECH_SYNTHESIS_SPEED = 1;
export const DEFAULT_SPEECH_SYNTHESIS_VOLUME = 1;

export const SPEECH_SYNTHESIS_VOICES = [
  { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi 2.0', description: '自然亲切的通用女声' },
  { id: 'zh_male_dayi_saturn_bigtts', name: '大毅', description: '沉稳清晰的通用男声' },
  { id: 'zh_female_mizai_saturn_bigtts', name: '米仔', description: '轻快活泼的年轻女声' },
  { id: 'zh_female_jitangnv_saturn_bigtts', name: '鸡汤女声', description: '温暖舒缓的陪伴女声' },
  { id: 'zh_female_meilinvyou_saturn_bigtts', name: '魅力女友', description: '柔和自然的角色女声' },
  { id: 'zh_female_santongyongns_saturn_bigtts', name: '流畅女声', description: '清晰自然的视频配音女声' },
  { id: 'zh_male_ruyayichen_saturn_bigtts', name: '儒雅逸辰', description: '温和儒雅的青年男声' },
  { id: 'zh_female_xueayi_saturn_bigtts', name: '儿童绘本', description: '适合故事和儿童内容的女声' },
] as const;

export function normalizeSpeechSynthesisSpeed(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(2, Math.max(0.1, Math.round(value * 10) / 10))
    : DEFAULT_SPEECH_SYNTHESIS_SPEED;
}

export function normalizeSpeechSynthesisVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(2, Math.max(0.5, Math.round(value * 10) / 10))
    : DEFAULT_SPEECH_SYNTHESIS_VOLUME;
}
