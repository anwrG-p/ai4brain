import type { DimensionConfig } from '../types'

// Full 10-dimension pool supporting 3, 6, 7 (Team Default), 8, and 10 dimension presets [DEC-002]
export const FULL_DIMENSION_POOL: readonly DimensionConfig[] = [
  {
    id: 'working_memory',
    code: 'WM',
    slotIndex: 1,
    name: 'Working Memory',
    consumerLabel: 'Memory Sharpness',
    shortDescription: 'Holding and updating spatial or symbolic patterns across active interference.',
    scientificDefinition:
      'Capacity to actively maintain and manipulate transient information across short delays while resisting proactive interference.',
    taskName: 'Dual-Stream Spatial & Symbol N-Back',
    scoringMethod: 'Weighted staircase targeting 85% accuracy + d-prime sensitivity across lure trials.',
    uncertaintyNote: 'Confidence widens when response-time jitter exceeds 180 ms or fewer than 12 trials are logged.',
    knownBiases: ['Time-of-day alertness', 'Familiarity with keyboard shortcuts', 'Screen refresh rate'],
    backendDimensionKey: 'working_memory',
    schemaTypes: ['n_back'],
    colorCssVar: 'var(--dim-1)',
    markerShape: 'circle',
    markerGlyph: '●',
  },
  {
    id: 'inhibition_control',
    code: 'IC',
    slotIndex: 2,
    name: 'Inhibition Control',
    consumerLabel: 'Distraction Shield',
    shortDescription: 'Suppressing prepotent automatic responses when conflicting cues appear.',
    scientificDefinition:
      'Ability to override dominant or automatic motor and attentional impulses in favor of goal-directed responses.',
    taskName: 'Color-Word Stroop & Conflict Suppression',
    scoringMethod: 'Incongruent-minus-congruent reaction time interference cost and error-burst recovery.',
    uncertaintyNote: 'Fast impulsive guesses inflate error bursts and increase interval width.',
    knownBiases: ['Color vision differences (mitigated via shape/label pairing)', 'Motor speed variance'],
    backendDimensionKey: 'executive_function',
    schemaTypes: ['stroop', 'stop_signal'],
    colorCssVar: 'var(--dim-2)',
    markerShape: 'square',
    markerGlyph: '■',
  },
  {
    id: 'cognitive_flexibility',
    code: 'CF',
    slotIndex: 3,
    name: 'Cognitive Flexibility (Set-Shifting)',
    consumerLabel: 'Mental Stamina',
    shortDescription: 'Adapting smoothly when task rules shift between position, symbol, or parity.',
    scientificDefinition:
      'Efficiency of reconfiguring mental task sets when environmental rules or priorities change unexpectedly.',
    taskName: 'Rule-Switch N-Back & Dynamic Set-Shifting',
    scoringMethod: 'Switch-trial latency delta (ms) and post-switch accuracy stabilization rate.',
    uncertaintyNote: 'Requires at least 4 rule-switch transitions per session for a narrow interval.',
    knownBiases: ['First-block rule carryover', 'Notification interruptions'],
    backendDimensionKey: 'executive_function',
    schemaTypes: ['n_back', 'stroop'],
    colorCssVar: 'var(--dim-3)',
    markerShape: 'triangle',
    markerGlyph: '▲',
  },
  {
    id: 'attention_networks',
    code: 'AN',
    slotIndex: 4,
    name: 'Attention Networks',
    consumerLabel: 'Focus Consistency',
    shortDescription: 'Sustaining alerting and orienting focus across central and peripheral targets.',
    scientificDefinition:
      'Coordination of alerting, orienting, and selective target detection across competing visual distractors.',
    taskName: 'Focused Target & Peripheral Cue Detection',
    scoringMethod: 'Central-plus-peripheral hit rate adjusted for distractor ring density.',
    uncertaintyNote: 'Sensitive to ambient visual distractions and viewing distance.',
    knownBiases: ['Display size and viewport scaling', 'Ambient lighting glare'],
    backendDimensionKey: 'processing_speed',
    schemaTypes: ['ufov'],
    colorCssVar: 'var(--dim-4)',
    markerShape: 'diamond',
    markerGlyph: '◆',
  },
  {
    id: 'divided_perceptual_speed',
    code: 'PS',
    slotIndex: 5,
    name: 'Divided Perceptual Speed',
    consumerLabel: 'Wide-Angle Focus',
    shortDescription: 'Rapidly encoding simultaneous central and peripheral visual stimuli.',
    scientificDefinition:
      'Minimum display duration (ms) required to reliably discriminate dual targets under visual masking.',
    taskName: 'Useful Field of View (UFOV) QUEST+ Staircase',
    scoringMethod: 'Bayesian QUEST+ threshold estimation over measured display frame duration (shown_ms).',
    uncertaintyNote: 'Frame-rate rounding (60 Hz vs 120 Hz) is explicitly folded into the confidence band.',
    knownBiases: ['Monitor refresh rate (logged via requestAnimationFrame)', 'Peripheral field angle'],
    backendDimensionKey: 'processing_speed',
    schemaTypes: ['ufov'],
    colorCssVar: 'var(--dim-5)',
    markerShape: 'pentagon',
    markerGlyph: '⬠',
  },
  {
    id: 'episodic_pattern_separation',
    code: 'EP',
    slotIndex: 6,
    name: 'Episodic Pattern Separation',
    consumerLabel: 'Visual Memory Clarity',
    shortDescription: 'Distinguishing previously seen patterns from highly similar visual lures.',
    scientificDefinition:
      'Fidelity of encoding distinct memory traces so overlapping experiences are not confused as identical.',
    taskName: 'Mnemonic Similarity Task (Old / Similar Lure / New)',
    scoringMethod: 'Lure Discrimination Index (p("Similar"|Lure) - p("Similar"|New)) across perturbation deltas.',
    uncertaintyNote: 'High false-alarm rate on low-delta lures widens epistemic uncertainty.',
    knownBiases: ['Visual fatigue over long sessions', 'Response bias toward "Old"'],
    backendDimensionKey: 'episodic_memory',
    schemaTypes: ['mst', 'pal'],
    colorCssVar: 'var(--dim-6)',
    markerShape: 'hexagon',
    markerGlyph: '⬢',
  },
  {
    id: 'visuospatial_planning_gf',
    code: 'VP',
    slotIndex: 7,
    name: 'Visuospatial Planning & Gf',
    consumerLabel: 'Spatial Strategy',
    shortDescription: 'Inducing abstract relational rules and planning multi-step spatial moves.',
    scientificDefinition:
      'Fluid relational reasoning, mental rotation, and look-ahead goal planning under move constraints.',
    taskName: 'Matrix Induction, Relational Hops & Tower Planning',
    scoringMethod: 'Path optimality ratio (l_min / l_user), ms-per-hop slope, and conflict-move pause latency.',
    uncertaintyNote: 'Complex multi-hop items carry higher per-trial variance than rapid perceptual trials.',
    knownBiases: ['Prior puzzle experience', 'Speed-accuracy tradeoff preference'],
    backendDimensionKey: 'pattern_induction',
    schemaTypes: ['matrix', 'relational', 'tower', 'mental_rotation'],
    colorCssVar: 'var(--dim-7)',
    markerShape: 'star',
    markerGlyph: '★',
  },
  {
    id: 'spatial_orientation_extra',
    code: 'SO',
    slotIndex: 8,
    name: 'Mental Spatial Rotation',
    consumerLabel: 'Mental Rotation',
    shortDescription: 'Rotating 2D/3D geometric structures mentally to judge parity vs reflection.',
    scientificDefinition:
      'Rate and accuracy of mental transformation across angular disparities (0° to 180°).',
    taskName: 'Shepard-Metzler Polygons Mental Rotation',
    scoringMethod: 'Angular slope (ms per degree) and mirror-lure rejection accuracy.',
    uncertaintyNote: 'Extra dimension slot #8 for Phase 2 Generalisation verification.',
    knownBiases: ['Handedness', 'Touch vs keyboard response mapping'],
    backendDimensionKey: 'spatial_orientation',
    schemaTypes: ['mental_rotation'],
    colorCssVar: 'var(--dim-8)',
    markerShape: 'cross',
    markerGlyph: '✚',
    strokeDasharray: '6 3',
  },
  {
    id: 'metacognitive_calibration',
    code: 'MC',
    slotIndex: 9,
    name: 'Metacognitive Calibration',
    consumerLabel: 'Self-Awareness Calibration',
    shortDescription: 'Aligning self-estimated confidence with actual trial performance.',
    scientificDefinition:
      'Correspondence between subjective confidence judgments and objective task accuracy.',
    taskName: 'Post-Block Confidence Alignment Check',
    scoringMethod: 'Brier score calibration index between self-report and observed score_norm.',
    uncertaintyNote: 'Extra dimension slot #9 for Phase 2 Generalisation verification.',
    knownBiases: ['Under-confidence in unfamiliar tasks'],
    backendDimensionKey: 'executive_function',
    schemaTypes: ['relational'],
    colorCssVar: 'var(--dim-9)',
    markerShape: 'ring',
    markerGlyph: '◎',
    strokeDasharray: '3 3',
  },
  {
    id: 'sustained_vigilance',
    code: 'SV',
    slotIndex: 10,
    name: 'Sustained Vigilance Stability',
    consumerLabel: 'Rhythm Stability',
    shortDescription: 'Maintaining consistent response timing across extended blocks.',
    scientificDefinition:
      'Resistance to attentional lapses and reaction-time variability over time-on-task.',
    taskName: 'Continuous Temporal Stability Probe',
    scoringMethod: 'Inverse coefficient of variation of reaction times across blocks.',
    uncertaintyNote: 'Extra dimension slot #10 for 10-dimension stress testing.',
    knownBiases: ['Time of day', 'Session length'],
    backendDimensionKey: 'processing_speed',
    schemaTypes: ['n_back'],
    colorCssVar: 'var(--dim-10)',
    markerShape: 'hourglass',
    markerGlyph: '⧗',
    strokeDasharray: '8 3 2 3',
  },
] as const

// 6-Dimension Intake / Backend Preset [VERIFY-01]
export const SIX_DIMENSION_PRESET: readonly DimensionConfig[] = [
  { ...FULL_DIMENSION_POOL[3]!, id: 'attention', code: 'AT', slotIndex: 1, name: 'Attention' },
  { ...FULL_DIMENSION_POOL[0]!, id: 'working_memory', code: 'WM', slotIndex: 2, name: 'Working Memory' },
  { ...FULL_DIMENSION_POOL[4]!, id: 'processing_speed', code: 'PS', slotIndex: 3, name: 'Processing Speed' },
  { ...FULL_DIMENSION_POOL[2]!, id: 'cognitive_flexibility', code: 'CF', slotIndex: 4, name: 'Cognitive Flexibility' },
  { ...FULL_DIMENSION_POOL[1]!, id: 'inhibitory_control', code: 'IC', slotIndex: 5, name: 'Inhibitory Control' },
  { ...FULL_DIMENSION_POOL[5]!, id: 'episodic_pattern_separation', code: 'EP', slotIndex: 6, name: 'Episodic Pattern Separation', consumerLabel: 'Visual Memory Clarity' },
]

export type DimensionPresetKey = '3' | '6' | '7' | '8' | '10'

export interface DimensionPresetOption {
  key: DimensionPresetKey
  label: string
}

export const DIMENSION_PRESETS: readonly DimensionPresetOption[] = [
  { key: '3', label: '3 Dims' },
  { key: '6', label: '6 Dims' },
  { key: '7', label: '7 Dims (Default)' },
  { key: '8', label: '8 Dims' },
  { key: '10', label: '10 Dims (Stress)' },
]


export function getDimensionsByPreset(preset: DimensionPresetKey = '7'): DimensionConfig[] {
  switch (preset) {
    case '3':
      return FULL_DIMENSION_POOL.slice(0, 3)
    case '6':
      return [...SIX_DIMENSION_PRESET]
    case '7':
      return FULL_DIMENSION_POOL.slice(0, 7)
    case '8':
      return FULL_DIMENSION_POOL.slice(0, 8)
    case '10':
      return FULL_DIMENSION_POOL.slice(0, 10)
  }
}
