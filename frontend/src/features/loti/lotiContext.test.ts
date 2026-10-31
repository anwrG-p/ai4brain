import { describe, expect, it, vi } from 'vitest'
import * as dashboard from '../insights/dashboard'
import { lotiContext } from './lotiContext'
import type { SessionRecord } from '../insights/sessionStore'

// Spied on, called through: Loti reads the weakest pillar and the week's count as the dashboard does.
vi.mock('../insights/dashboard', async (importOriginal) => {
  const real = await importOriginal<typeof import('../insights/dashboard')>()
  return {
    ...real,
    currentPillars: vi.fn(real.currentPillars),
    weakestPillar: vi.fn(real.weakestPillar),
    sessionsThisWeek: vi.fn(real.sessionsThisWeek),
  }
})

const now = new Date('2026-10-28T15:00:00') // a Wednesday

const session = (at: string, inputs: SessionRecord['inputs']): SessionRecord => ({ id: at, at, inputs })

describe('lotiContext', () => {
  it('with nothing on the device: no weakest pillar, no mood push, no goals, no sessions', () => {
    expect(lotiContext({ sessions: [], goals: { year: null, goals: {} }, emotion: undefined, now })).toEqual({
      now,
      hasGoalsThisYear: false,
      sessionsThisWeek: 0,
    })
  })

  it('names the lowest pillar as last measured', () => {
    const sessions = [
      session('2026-10-20T10:00:00', { SST_SSRT: { score: 20, trials: 40 }, ANT_Conflict: { score: 20, trials: 40 } }),
      session('2026-10-27T10:00:00', {
        SST_SSRT: { score: 80, trials: 40 },
        ANT_Conflict: { score: 80, trials: 40 },
        UFOV_SOA: { score: 50, trials: 40 },
        ANT_Orienting: { score: 50, trials: 40 },
      }),
    ]
    expect(lotiContext({ sessions, goals: { year: null, goals: {} }, emotion: undefined, now }).weakestPillar).toBe('visual')
  })

  it('counts sessions since Monday, reads this year’s goals and maps the emotion to a mood', () => {
    const sessions = [session('2026-10-25T10:00:00', {}), session('2026-10-26T09:00:00', {}), session('2026-10-28T09:00:00', {})]
    const ctx = lotiContext({ sessions, goals: { year: 2026, goals: { memory: 10 } }, emotion: 'frustrated', now })
    expect(ctx.sessionsThisWeek).toBe(2)
    expect(ctx.hasGoalsThisYear).toBe(true)
    expect(ctx.mood).toBe('frustrated')
  })

  it('uses the dashboard’s own helpers, so Loti and Home agree on the weakest pillar and the week', () => {
    const sessions = [session('2026-10-27T10:00:00', { UFOV_SOA: { score: 50, trials: 40 }, ANT_Orienting: { score: 50, trials: 40 } })]
    const ctx = lotiContext({ sessions, goals: { year: null, goals: {} }, emotion: undefined, now })
    expect(dashboard.currentPillars).toHaveBeenCalledWith(sessions)
    expect(dashboard.weakestPillar).toHaveBeenCalled()
    expect(dashboard.sessionsThisWeek).toHaveBeenCalledWith(sessions, now)
    expect(ctx.weakestPillar).toBe(dashboard.weakestPillar(dashboard.currentPillars(sessions)))
  })
})
