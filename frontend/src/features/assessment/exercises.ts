import type {
  MstParams,
  NBackParams,
  RelationalParams,
  RotationParams,
  SchemaType,
  StopSignalParams,
  StroopParams,
  TaskPayload,
  UfovParams,
} from './telemetry/types'
import { howToPlay, type HowToPlay } from './howToPlay'
import { EXERCISE_NAME } from './names'
import { isValidTrial } from './tasks/Ufov'

export { EXERCISE_NAME }

export type Intro = { name: string; line: string } & HowToPlay

const LINE: Record<SchemaType, string> = {
  relational: 'Read the clues, then say if the question is true.',
  n_back: 'Watch the grid. Press when it matches {n} steps back.',
  tower: 'Guess your moves, then rebuild the goal one disc at a time.',
  ufov: 'Watch the middle. Then pick the letter and where the circle was.',
  mst: 'Study the shapes. Then say if each is old, similar or new.',
  stroop: 'Pick the color of the ink, not the word.',
  matrix: 'Pick the piece that completes the pattern.',
  mental_rotation: 'Say if the right shape is the left one turned or mirrored.',
  stop_signal: 'Press the way the arrow points. Stop for the sign.',
}

// The instruction screen: the name, one sentence on what to do (under 12 words, anti-slop rule 4)
// and how to play (howToPlay.ts: steps with the keys, the demo's caption, the pillar, More). Null for
// a schema without an exercise (TaskRunner skips it).
export function introFor(task: TaskPayload): Intro | null {
  const name = (EXERCISE_NAME as Partial<Record<string, string>>)[task.schema_type]
  const how = howToPlay(task)
  if (!name || !how) return null
  const n = task.schema_type === 'n_back' ? (task.params as NBackParams).n : 0
  return { name, line: LINE[task.schema_type].replace('{n}', String(n)), ...how }
}

// Trials in one block, for the progress dots: one dot per trial the exercise can record (UFOV skips
// invalid trials, so they get no dot and the dots can complete).
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
      return (p as UfovParams).trials.filter(isValidTrial).length
    case 'mst':
      return (p as MstParams).test.length
    case 'stop_signal':
      return (p as StopSignalParams).trials.length
    default:
      return 1 // matrix and tower: one trial
  }
}

// UFOV and Stop Light draw their own fixation cross before every trial, so the frame does not add one.
export const OWN_FIXATION: ReadonlySet<SchemaType> = new Set<SchemaType>(['ufov', 'stop_signal'])
