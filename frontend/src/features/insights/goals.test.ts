import { afterEach, describe, expect, it } from 'vitest'
import { GOALS_KEY, WEEKLY_GOAL, WEEKLY_SKIPS, hasGoalsForYear, loadGoals, useGoalsStore, weeklyGoal, weeklyGoalText } from './goals'

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
    expect(JSON.parse(localStorage.getItem(GOALS_KEY)!)).toEqual({ version: 1, year: 2026, goals: { memory: 10 }, bases: {} })
    expect(loadGoals()).toEqual({ year: 2026, goals: { memory: 10 }, bases: {} })
  })

  it('starts a fresh list when a goal is set in a new year', () => {
    useGoalsStore.getState().setGoal('memory', 10, new Date('2026-03-01T12:00:00'))
    useGoalsStore.getState().setGoal('focus', 5, new Date('2027-01-02T12:00:00'))
    expect(useGoalsStore.getState()).toMatchObject({ year: 2027, goals: { focus: 5 } })
  })

  it('ignores corrupt or foreign data', () => {
    for (const raw of ['{not json', '{"version":2,"year":2026,"goals":{}}', '{"version":1,"year":"x","goals":{}}', '[]']) {
      localStorage.setItem(GOALS_KEY, raw)
      expect(loadGoals()).toEqual({ year: null, goals: {}, bases: {} })
    }
    localStorage.setItem(GOALS_KEY, '{"version":1,"year":2026,"goals":{"memory":10,"bogus":3,"focus":"x"}}')
    expect(loadGoals()).toEqual({ year: 2026, goals: { memory: 10 }, bases: {} })
  })

  it('clamps loaded and set targets to 1-100 and drops invalid ones', () => {
    localStorage.setItem(
      GOALS_KEY,
      '{"version":1,"year":2026,"goals":{"memory":250,"focus":0,"agility":-5,"impulse":7.6,"visual":null}}',
    )
    expect(loadGoals()).toEqual({ year: 2026, goals: { memory: 100, impulse: 8 }, bases: {} })
    useGoalsStore.getState().setGoal('visual', 500, new Date('2026-03-01T12:00:00'))
    expect(useGoalsStore.getState().goals).toEqual({ visual: 100 })
    useGoalsStore.getState().setGoal('focus', 0, new Date('2026-03-01T12:00:00'))
    expect(useGoalsStore.getState().goals).toEqual({ visual: 100 })
  })

  it('is empty after clear', () => {
    useGoalsStore.getState().setGoal('visual', 15)
    useGoalsStore.getState().clearGoals()
    expect(useGoalsStore.getState()).toMatchObject({ year: null, goals: {}, bases: {} })
    expect(localStorage.getItem(GOALS_KEY)).toBeNull()
  })

  // Review fix (ticket 08): a goal is "+10 from 52", so it keeps the pillar's score from the moment it was set.
  it('stores the pillar score at the moment the goal is set, and replaces it when the goal is set again', () => {
    const d = new Date('2026-03-01T12:00:00')
    useGoalsStore.getState().setGoal('memory', 10, d, 52.4)
    expect(useGoalsStore.getState().bases).toEqual({ memory: 52.4 })
    expect(loadGoals()).toEqual({ year: 2026, goals: { memory: 10 }, bases: { memory: 52.4 } })
    useGoalsStore.getState().setGoal('memory', 15, d, 60)
    expect(useGoalsStore.getState()).toMatchObject({ goals: { memory: 15 }, bases: { memory: 60 } })
    useGoalsStore.getState().setGoal('focus', 5, new Date('2027-01-02T12:00:00'), 40)
    expect(useGoalsStore.getState()).toMatchObject({ year: 2027, goals: { focus: 5 }, bases: { focus: 40 } })
  })

  it('setBase fills a missing base only (a goal set before the pillar was measured)', () => {
    useGoalsStore.getState().setGoal('memory', 10, new Date('2026-03-01T12:00:00'))
    expect(useGoalsStore.getState().bases).toEqual({})
    useGoalsStore.getState().setBase('memory', 40)
    useGoalsStore.getState().setBase('memory', 70)
    useGoalsStore.getState().setBase('focus', 70) // no goal on focus: ignored
    expect(useGoalsStore.getState().bases).toEqual({ memory: 40 })
    expect(loadGoals().bases).toEqual({ memory: 40 })
  })

  it('drops invalid stored bases and bases without a goal', () => {
    localStorage.setItem(
      GOALS_KEY,
      '{"version":1,"year":2026,"goals":{"memory":10,"focus":5,"visual":5},"bases":{"memory":52,"focus":-3,"visual":"x","agility":40}}',
    )
    expect(loadGoals().bases).toEqual({ memory: 52 })
  })
})

describe('weekly goal (research #10)', () => {
  const NOW = new Date('2026-10-28T15:00:00') // a Wednesday
  const at = (iso: string) => ({ id: iso, at: new Date(iso).toISOString(), inputs: {} })

  it('is 3 sessions a week with one skip, counted from Monday 00:00 local time', () => {
    expect(WEEKLY_GOAL).toBe(3)
    expect(WEEKLY_SKIPS).toBe(1)
    const last = at('2026-10-25T23:59:00') // Sunday: last week
    expect(weeklyGoal([last], NOW)).toEqual({ done: 0, target: 3, kept: false })
    expect(weeklyGoal([last, at('2026-10-26T00:00:00')], NOW)).toEqual({ done: 1, target: 3, kept: false })
    expect(weeklyGoal([at('2026-10-26T08:00:00'), at('2026-10-27T08:00:00')], NOW)).toEqual({ done: 2, target: 3, kept: true })
  })

  it('reads as one plain line; past the goal it counts on; no streak or guilt words', () => {
    expect(weeklyGoalText({ done: 0, target: 3, kept: false })).toBe('0 of 3 this week')
    expect(weeklyGoalText({ done: 1, target: 3, kept: false })).toBe('1 of 3 this week')
    expect(weeklyGoalText({ done: 2, target: 3, kept: true })).toBe('2 of 3 this week · week kept')
    expect(weeklyGoalText({ done: 3, target: 3, kept: true })).toBe('3 of 3 this week · week kept')
    expect(weeklyGoalText({ done: 5, target: 3, kept: true })).toBe('5 this week · week kept')
    for (let done = 0; done < 6; done++) {
      expect(weeklyGoalText({ done, target: 3, kept: done >= 2 })).not.toMatch(/streak|miss|broke|lost|behind|fail/i)
    }
  })

  it('a missed week resets quietly: the next week starts at 0 with nothing carried over', () => {
    const full = [at('2026-10-12T08:00:00'), at('2026-10-13T08:00:00'), at('2026-10-14T08:00:00')]
    expect(weeklyGoal(full, new Date('2026-10-15T12:00:00'))).toMatchObject({ done: 3, kept: true })
    expect(weeklyGoal(full, NOW)).toEqual({ done: 0, target: 3, kept: false }) // the week of 19 Oct had none
  })

  it('a session in the future (clock skew) does not count', () => {
    expect(weeklyGoal([at('2026-10-29T08:00:00')], NOW).done).toBe(0)
  })
})
