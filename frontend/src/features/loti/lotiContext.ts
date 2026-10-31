import { useState } from 'react'
import { EMOTION_TO_MOOD } from '../../components/features/characters'
import { useEmilyStore } from '../../state/useEmilyStore'
import type { EmilyEmotion } from '../../styles/emilyTokens'
import { useGoalsStore, type Goals } from '../insights/goals'
import { PILLAR_IDS, pillarScores, type PillarId } from '../insights/pillars'
import { useSessionStore, type SessionRecord } from '../insights/sessionStore'
import type { LotiContext } from './types'

export interface LotiContextInput {
  sessions: readonly SessionRecord[]
  goals: { year: number | null; goals: Goals }
  emotion: EmilyEmotion | undefined
  now: Date
}

/** What Loti knows when a talk opens, from what is on this device. Pure.
    ponytail: the weakest pillar is the lowest one as last measured; the dashboard's helpers can
    replace this once they land. */
export function lotiContext({ sessions, goals, emotion, now }: LotiContextInput): LotiContext {
  const last: Partial<Record<PillarId, number>> = {}
  for (const s of [...sessions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const p = pillarScores(s.inputs)
    for (const id of PILLAR_IDS) {
      const score = p[id].score
      if (score !== null) last[id] = score
    }
  }
  let weakest: PillarId | undefined
  for (const id of PILLAR_IDS) {
    const s = last[id]
    if (s !== undefined && (weakest === undefined || s < last[weakest]!)) weakest = id
  }

  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const sessionsThisWeek = sessions.filter((s) => {
    const t = Date.parse(s.at)
    return t >= monday.getTime() && t <= now.getTime()
  }).length

  const ctx: LotiContext = {
    now,
    hasGoalsThisYear: goals.year === now.getFullYear() && Object.keys(goals.goals).length > 0,
    sessionsThisWeek,
  }
  if (weakest) ctx.weakestPillar = weakest
  if (emotion) ctx.mood = EMOTION_TO_MOOD[emotion]
  return ctx
}

/** Loti's context from the stores, read once per mount (a talk does not restart mid-way). */
export function useLotiContext(): LotiContext {
  const [ctx] = useState(() => {
    const { year, goals } = useGoalsStore.getState()
    return lotiContext({
      sessions: useSessionStore.getState().sessions,
      goals: { year, goals },
      emotion: useEmilyStore.getState().currentEmotion,
      now: new Date(),
    })
  })
  return ctx
}
