import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FULL_DIMENSION_POOL } from '../../config/dimensions'
import { useGoalsStore } from '../insights/goals'
import { PILLAR_PRACTICE } from '../insights/pillars'
import type { LotiAction } from './types'

/** Where a train action goes: the exercise for its schema type, else for its pillar.
    Ticket 09 may send these to /train?pillar= once the Train page exists. */
export function trainPath(action: Extract<LotiAction, { kind: 'train' }>): string {
  const schema = action.schemaType ?? (action.pillar ? PILLAR_PRACTICE[action.pillar] : undefined)
  const dim = schema && FULL_DIMENSION_POOL.find((d) => d.schemaTypes.includes(schema))
  return dim && schema ? `/task/${dim.id}?schema=${schema}` : '/assessment'
}

/** Runs Loti's side effects. Reply actions are the brain's business and do nothing here. */
export function useLotiActions(): (action: LotiAction) => void {
  const navigate = useNavigate()
  const setGoal = useGoalsStore((s) => s.setGoal)
  return useCallback(
    (action: LotiAction) => {
      switch (action.kind) {
        case 'train':
          navigate(trainPath(action))
          break
        case 'navigate':
          navigate(action.to)
          break
        case 'setGoal':
          setGoal(action.pillar, action.target)
          break
        case 'reply':
          break
      }
    },
    [navigate, setGoal],
  )
}
