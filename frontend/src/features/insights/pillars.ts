import type { TaskSchemaType } from '../../types'

/** The five pillars (spec "Five pillars"). Ticket 04 extends this file with the weights and math. */
export const PILLAR_IDS = ['focus', 'agility', 'impulse', 'memory', 'visual'] as const
export type PillarId = (typeof PILLAR_IDS)[number]

/** Consumer names, the only pillar wording shown in the UI (U5). */
export const PILLAR_LABELS: Record<PillarId, string> = {
  focus: 'Focus & Strategy',
  agility: 'Mental Agility',
  impulse: 'Impulse Control',
  memory: 'Deep Memory',
  visual: 'Visual Radar',
}

/** The exercise that practises each pillar most directly, after the doc's main input per pillar:
    focus <- OTS planning (tower), agility <- DCCS switch cost (n-back), impulse <- SST proxy
    (stroop), memory <- MST LDI (mst), visual <- UFOV SOA (ufov). */
export const PILLAR_PRACTICE: Record<PillarId, TaskSchemaType> = {
  focus: 'tower',
  agility: 'n_back',
  impulse: 'stroop',
  memory: 'mst',
  visual: 'ufov',
}

export function isPillarId(value: unknown): value is PillarId {
  return typeof value === 'string' && (PILLAR_IDS as readonly string[]).includes(value)
}
