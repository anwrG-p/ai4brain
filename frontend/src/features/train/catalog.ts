import type { DimensionPresetKey } from '../../config/dimensions'
import type { TaskSchemaType } from '../../types'
import { dimensionFor, PILLAR_IDS, type PillarId } from '../insights/pillars'

/* What the Train page lists: each exercise once. The first under each pillar is the one that
   practises it (the page's Start when that pillar leads; the test pins it): Strategic Blueprint for
   Focus, Memory Gauntlet (n_back) for Agility, Color Clash for Impulse. The others sit under a
   pillar whose inputs they feed (doc weights in pillars.ts):
   - Logic Web and Pattern Puzzle: FluidMatrices, Focus.
   - Shape Turn feeds no pillar input except error recovery, which is Agility's.
   - Stop Light: SST_SSRT, Impulse (the stop-signal measure; Color Clash only stands in without it).
   None of the newer exercises is in the six-exercise baseline (R10). */
export const TRAIN_EXERCISES: Record<PillarId, readonly TaskSchemaType[]> = {
  focus: ['tower', 'relational', 'matrix'],
  agility: ['n_back', 'mental_rotation'],
  impulse: ['stroop', 'stop_signal'],
  memory: ['mst'],
  visual: ['ufov'],
}

/** One short line per pillar, in plain words (rule 13). */
export const PILLAR_LINE: Record<PillarId, string> = {
  focus: 'Plan, then solve.',
  agility: 'Switch rules quickly.',
  impulse: 'Pause before answering.',
  memory: 'Spot small differences.',
  visual: 'Notice more at once.',
}

/** The runner route for an exercise under the active set of dimensions, or null when the set has
    none that offers it (only the judge-mode sets lack some). */
export function startPath(schema: TaskSchemaType, preset: DimensionPresetKey = '7'): string | null {
  const t = dimensionFor(schema, preset)
  return t ? `/task/${t.dimId}?schema=${t.schema}` : null
}

/** The pillars on the page (`among`) in display order: `first` leads when it is among them, the
    rest keep the pillar order. */
export function trainOrder(first: PillarId | null, among: readonly PillarId[] = PILLAR_IDS): PillarId[] {
  const shown = PILLAR_IDS.filter((p) => among.includes(p))
  return first && shown.includes(first) ? [first, ...shown.filter((p) => p !== first)] : shown
}
