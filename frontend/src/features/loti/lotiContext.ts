import { useState } from 'react'
import { EMOTION_TO_MOOD } from '../../components/features/characters'
import { useEmilyStore } from '../../state/useEmilyStore'
import type { EmilyEmotion } from '../../styles/emilyTokens'
import { currentPillars, sessionsThisWeek, weakestPillar } from '../insights/dashboard'
import { useGoalsStore, type Goals } from '../insights/goals'
import { useSessionStore, type SessionRecord } from '../insights/sessionStore'
import type { LotiContext } from './types'

export interface LotiContextInput {
  sessions: readonly SessionRecord[]
  goals: { year: number | null; goals: Goals }
  emotion: EmilyEmotion | undefined
  now: Date
}

/** What Loti knows when a talk opens, from what is on this device. Pure. The weakest pillar and the
    week's count come from the dashboard's helpers, so Loti and Home always agree. */
export function lotiContext({ sessions, goals, emotion, now }: LotiContextInput): LotiContext {
  const weakest = weakestPillar(currentPillars(sessions))
  const ctx: LotiContext = {
    now,
    hasGoalsThisYear: goals.year === now.getFullYear() && Object.keys(goals.goals).length > 0,
    sessionsThisWeek: sessionsThisWeek(sessions, now),
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
