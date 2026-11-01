/**
 * EMILY (Emotion & Micro-Interaction Listener for You) Design Tokens
 * 
 * Isolated in src/styles to adhere to strict design token linter rules.
 * Grounded in James Russell's Circumplex Model of Affect (Valence x Arousal).
 * 
 * Enforces the Anti-Red Policy:
 * 'frustrated' uses Tranquil Eucalyptus Sage (#4D9078), NEVER alert red (#DC2626)
 * to prevent cortisol and task anxiety spikes.
 */

export type EmilyEmotion =
  | 'calm_flow'
  | 'energized'
  | 'frustrated'
  | 'hesitant'
  | 'fatigued'

export interface EmilyEmotionConfig {
  emotion: EmilyEmotion
  label: string
  valence: 'positive' | 'negative'
  arousal: 'high' | 'low' | 'moderate'
  colorDescription: string
  accentLight: string
  tintLight: string
  accentNight: string
  glowNight: string
  brianPose: 'waving' | 'explorer' | 'thinking' | 'sleepy'
  brianAdvice: string
  actionPrompt?: string
}

export const EMILY_EMOTION_CONFIGS: Record<EmilyEmotion, EmilyEmotionConfig> = {
  calm_flow: {
    emotion: 'calm_flow',
    label: 'Calm Flow',
    valence: 'positive',
    arousal: 'moderate',
    colorDescription: 'Deep Teal / Sage Green (Parasympathetic balance & clarity)',
    accentLight: '#0D9488',
    tintLight: '#F2F9F8',
    accentNight: '#4FD1C5',
    glowNight: 'rgba(79, 209, 197, 0.14)',
    brianPose: 'waving',
    brianAdvice: 'Smooth focus rhythm — enjoy the flow.',
  },
  energized: {
    emotion: 'energized',
    label: 'Confident Spark',
    valence: 'positive',
    arousal: 'high',
    colorDescription: 'Warm Terracotta Amber & Doodle Sky (High self-efficacy)',
    accentLight: '#D96B43',
    tintLight: '#FDF6F0',
    accentNight: '#F5A65B',
    glowNight: 'rgba(245, 166, 91, 0.15)',
    brianPose: 'explorer',
    brianAdvice: 'Brisk, high-energy momentum.',
  },
  frustrated: {
    emotion: 'frustrated',
    label: 'Gentle De-Escalation',
    valence: 'negative',
    arousal: 'high',
    colorDescription: 'Tranquil Eucalyptus Sage & Soft Slate (Anti-Red Policy)',
    accentLight: '#4D9078',
    tintLight: '#F1F7F4',
    accentNight: '#68D391',
    glowNight: 'rgba(104, 211, 145, 0.14)',
    brianPose: 'thinking',
    brianAdvice: 'Take a 60s breather — no rush at all.',
    actionPrompt: 'Slow down pace / Take a 60s breather',
  },
  hesitant: {
    emotion: 'hesitant',
    label: 'Reassuring Guidance',
    valence: 'negative',
    arousal: 'low',
    colorDescription: 'Calm Sky & Warm Honey (Cognitive grounding)',
    accentLight: '#2F7AB0',
    tintLight: '#EEF5FB',
    accentNight: '#90CDF4',
    glowNight: 'rgba(144, 205, 244, 0.14)',
    brianPose: 'thinking',
    brianAdvice: 'Take your time — every exploration counts.',
    actionPrompt: 'Take your time — no wrong answers',
  },
  fatigued: {
    emotion: 'fatigued',
    label: 'Restorative Wind-Down',
    valence: 'negative',
    arousal: 'low',
    colorDescription: 'Dusk Slate & Revitalizing Mint (Circadian recovery)',
    accentLight: '#5A7186',
    tintLight: '#F1F5F8',
    accentNight: '#A3BBD0',
    glowNight: 'rgba(163, 187, 208, 0.14)',
    brianPose: 'sleepy',
    brianAdvice: 'Pacing is slowing down. A short rest is fine.',
    actionPrompt: 'Scheduled rest mode active',
  },
}
