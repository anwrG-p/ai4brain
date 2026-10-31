import type { DimensionPresetKey } from '../../config/dimensions'
import type { TaskSchemaType } from '../../types'
import { dimensionFor, PILLAR_IDS, type PillarId, type PillarScore } from '../insights/pillars'

/* What the Train page lists. Each exercise sits under the one pillar its scores feed most, after
   the doc's weights in pillars.ts; the first is the one pillarTraining() practises (the test pins
   it). Ties and leftovers:
   - Strategic Blueprint feeds Focus (planning) and Impulse (execution) equally: Focus.
   - Memory Gauntlet feeds Focus (OSPAN) and Agility (switches): Agility, so every pillar has one.
   - Color Clash feeds Impulse (stop proxy, 0.5) more than Agility (conflict, 0.4): Impulse.
   - Shape Turn feeds no input but error recovery: Agility. */
export const TRAIN_EXERCISES: Record<PillarId, readonly TaskSchemaType[]> = {
  focus: ['tower', 'relational', 'matrix'],
  agility: ['n_back', 'mental_rotation'],
  impulse: ['stroop'],
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

/** The scored pillar with the lowest score; ties keep the pillar order. Null when none is scored. */
export function weakestPillar(scores: Record<PillarId, PillarScore>): PillarId | null {
  let weakest: PillarId | null = null
  for (const p of PILLAR_IDS) {
    const s = scores[p].score
    if (s === null) continue
    if (weakest === null || s < (scores[weakest].score ?? Infinity)) weakest = p
  }
  return weakest
}

/** The pillars in display order: the chosen one first, the rest as usual. */
export function trainOrder(first: PillarId | null): PillarId[] {
  return first ? [first, ...PILLAR_IDS.filter((p) => p !== first)] : [...PILLAR_IDS]
}
