import { afterEach, describe, expect, it, vi } from 'vitest'
import { coachBrain } from './coachAdapter'
import { scriptedBrain } from './scriptedBrain'
import type { LotiContext } from './types'

afterEach(() => vi.unstubAllGlobals())

describe('coachBrain (stub)', () => {
  it('makes no network calls and answers like the scripted brain', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const ctx: LotiContext = { now: new Date('2026-10-28T15:00:00'), hasGoalsThisYear: true, sessionsThisWeek: 0 }

    expect(coachBrain.opening(ctx)).toEqual(scriptedBrain.opening(ctx))
    expect(coachBrain.respond('day', 'great', ctx)).toEqual(scriptedBrain.respond('day', 'great', ctx))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
