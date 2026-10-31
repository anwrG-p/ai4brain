import { afterEach, describe, expect, it } from 'vitest'
import { GOALS_KEY, hasGoalsForYear, loadGoals, useGoalsStore } from './goals'

afterEach(() => {
  useGoalsStore.getState().clearGoals()
  localStorage.clear()
})

describe('goals slice', () => {
  it('sets a goal for the year and persists it with a version', () => {
    useGoalsStore.getState().setGoal('memory', 10, new Date('2026-03-01T12:00:00'))
    const state = useGoalsStore.getState()
    expect(state.goals).toEqual({ memory: 10 })
    expect(hasGoalsForYear(state, 2026)).toBe(true)
    expect(hasGoalsForYear(state, 2027)).toBe(false)
    expect(JSON.parse(localStorage.getItem(GOALS_KEY)!)).toEqual({ version: 1, year: 2026, goals: { memory: 10 } })
    expect(loadGoals()).toEqual({ year: 2026, goals: { memory: 10 } })
  })

  it('starts a fresh list when a goal is set in a new year', () => {
    useGoalsStore.getState().setGoal('memory', 10, new Date('2026-03-01T12:00:00'))
    useGoalsStore.getState().setGoal('focus', 5, new Date('2027-01-02T12:00:00'))
    expect(useGoalsStore.getState()).toMatchObject({ year: 2027, goals: { focus: 5 } })
  })

  it('ignores corrupt or foreign data', () => {
    for (const raw of ['{not json', '{"version":2,"year":2026,"goals":{}}', '{"version":1,"year":"x","goals":{}}', '[]']) {
      localStorage.setItem(GOALS_KEY, raw)
      expect(loadGoals()).toEqual({ year: null, goals: {} })
    }
    localStorage.setItem(GOALS_KEY, '{"version":1,"year":2026,"goals":{"memory":10,"bogus":3,"focus":"x"}}')
    expect(loadGoals()).toEqual({ year: 2026, goals: { memory: 10 } })
  })

  it('clamps loaded and set targets to 1-100 and drops invalid ones', () => {
    localStorage.setItem(
      GOALS_KEY,
      '{"version":1,"year":2026,"goals":{"memory":250,"focus":0,"agility":-5,"impulse":7.6,"visual":null}}',
    )
    expect(loadGoals()).toEqual({ year: 2026, goals: { memory: 100, impulse: 8 } })
    useGoalsStore.getState().setGoal('visual', 500, new Date('2026-03-01T12:00:00'))
    expect(useGoalsStore.getState().goals).toEqual({ visual: 100 })
    useGoalsStore.getState().setGoal('focus', 0, new Date('2026-03-01T12:00:00'))
    expect(useGoalsStore.getState().goals).toEqual({ visual: 100 })
  })

  it('is empty after clear', () => {
    useGoalsStore.getState().setGoal('visual', 15)
    useGoalsStore.getState().clearGoals()
    expect(useGoalsStore.getState()).toMatchObject({ year: null, goals: {} })
    expect(localStorage.getItem(GOALS_KEY)).toBeNull()
  })
})
