import type { SchemaType } from './telemetry/types'

// Consumer names (brand v2 spec, IA). Also each exercise's region label, so the screen-reader name
// matches the heading on its instruction screen.
export const EXERCISE_NAME: Record<SchemaType, string> = {
  relational: 'Logic Web',
  n_back: 'Memory Gauntlet',
  tower: 'Strategic Blueprint',
  ufov: 'Perceptual Radar',
  mst: 'Precision Archive',
  stroop: 'Color Clash',
  matrix: 'Pattern Puzzle',
  mental_rotation: 'Shape Turn',
  stop_signal: 'Stop Light',
}
