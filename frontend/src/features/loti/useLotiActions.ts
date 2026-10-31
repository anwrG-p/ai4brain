import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DimensionPresetKey } from '../../config/dimensions'
import { useAppStore } from '../../state/useAppStore'
import { currentPillars } from '../insights/dashboard'
import { useGoalsStore } from '../insights/goals'
import { dimensionFor } from '../insights/pillars'
import { useSessionStore } from '../insights/sessionStore'
import type { LotiAction } from './types'

/** Where a train action goes under the active preset: the exercise for its schema type when the
    preset has it, else the Train page on the action's pillar, else the Train page. */
export function trainPath(action: Extract<LotiAction, { kind: 'train' }>, preset: DimensionPresetKey = '7'): string {
  const t = action.schemaType && dimensionFor(action.schemaType, preset)
  if (t) return `/task/${t.dimId}?schema=${t.schema}`
  return action.pillar ? `/train?pillar=${action.pillar}` : '/train'
}

/** Runs Loti's side effects. Reply actions are the brain's business and do nothing here. */
export function useLotiActions(): (action: LotiAction) => void {
  const navigate = useNavigate()
  const setGoal = useGoalsStore((s) => s.setGoal)
  const preset = useAppStore((s) => s.dimensionPreset)
  return useCallback(
    (action: LotiAction) => {
      switch (action.kind) {
        case 'train':
          navigate(trainPath(action, preset))
          break
        case 'navigate':
          navigate(action.to)
          break
        case 'setGoal': {
          // The goal keeps the pillar's score from this moment: "+10 from 52".
          const base = currentPillars(useSessionStore.getState().sessions)[action.pillar].score
          setGoal(action.pillar, action.target, new Date(), base ?? undefined)
          break
        }
        case 'reply':
          break
      }
    },
    [navigate, setGoal, preset],
  )
}
