import type {
  MstParams,
  NBackParams,
  RelationalParams,
  RotationParams,
  SchemaType,
  StroopParams,
  TaskPayload,
  UfovParams,
} from './telemetry/types'

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
}

// One hint: the keycaps and what they answer.
export type KeyHint = { keys: string[]; label: string }
export type Intro = { name: string; line: string; keys: KeyHint[] }

const hint = (keys: string[], label: string): KeyHint => ({ keys, label })

// The instruction screen: the name, one sentence on what to do, the answer keys. Null for a schema
// without an exercise (TaskRunner skips it). Lines stay under 12 words (anti-slop rule 4).
export function introFor(task: TaskPayload): Intro | null {
  const name = (EXERCISE_NAME as Partial<Record<string, string>>)[task.schema_type]
  if (!name) return null
  const p = task.params
  switch (task.schema_type) {
    case 'relational':
      return { name, line: 'Read the clues, then say if the question is true.', keys: [hint(['T'], 'True'), hint(['F'], 'False')] }
    case 'n_back': {
      const { n, streams } = p as NBackParams
      const keys = [
        ...(streams.includes('position') ? [hint(['A'], 'Same place')] : []),
        ...(streams.includes('symbol') ? [hint(['L'], 'Same symbol')] : []),
      ]
      return { name, line: `Watch the grid. Press when it matches ${n} steps back.`, keys }
    }
    case 'tower':
      return { name, line: 'Guess your moves, then rebuild the goal one disc at a time.', keys: [] }
    case 'ufov':
      return {
        name,
        line: 'Watch the middle. Then pick the letter and where the circle was.',
        keys: [hint(['A', 'B'], 'Letter'), hint(['1–8'], 'Direction')],
      }
    case 'mst':
      return {
        name,
        line: 'Study the shapes. Then say if each is old, similar or new.',
        keys: [hint(['1'], 'Old'), hint(['2'], 'Similar'), hint(['3'], 'New')],
      }
    case 'stroop':
      return {
        name,
        line: 'Pick the color of the ink, not the word.',
        keys: (p as StroopParams).colors.slice(0, 9).map((c, k) => hint([String(k + 1)], c)),
      }
    case 'matrix':
      return { name, line: 'Pick the piece that completes the pattern.', keys: [] }
    case 'mental_rotation':
      return {
        name,
        line: 'Say if the right shape is the left one turned or mirrored.',
        keys: [hint(['F'], 'Same'), hint(['J'], 'Different')],
      }
  }
}

// Trials in one block, for the progress dots: one dot per trial the exercise can record.
// ponytail: UFOV counts invalid trials too (they are skipped and never fill a dot); fixtures have none.
export function trialCount(task: TaskPayload): number {
  const p = task.params
  switch (task.schema_type) {
    case 'n_back':
      return (p as NBackParams).trials.length
    case 'stroop':
      return (p as StroopParams).trials.length
    case 'mental_rotation':
      return (p as RotationParams).trials.length
    case 'relational': {
      const { n_trials, levels } = p as RelationalParams
      return levels.some((l) => l.length > 0) ? n_trials : 0
    }
    case 'ufov':
      return (p as UfovParams).trials.length
    case 'mst':
      return (p as MstParams).test.length
    default:
      return 1 // matrix and tower: one trial
  }
}

// UFOV draws its own fixation cross before every trial, so the frame does not add one.
export const OWN_FIXATION: ReadonlySet<SchemaType> = new Set<SchemaType>(['ufov'])
