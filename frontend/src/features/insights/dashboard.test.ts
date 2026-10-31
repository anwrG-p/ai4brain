import { describe, expect, it } from 'vitest'
import {
  HEATMAP_MIN_CELLS,
  curveWindow,
  currentPillars,
  exerciseWeeks,
  goalLevel,
  improvedPillars,
  sessionPath,
  sessionsThisWeek,
  unifiedHistory,
  weakestPillar,
  weekStart,
} from './dashboard'
import type { TaskScores } from './pillars'
import type { SessionRecord } from './sessionStore'

const DAY = 86_400_000
const NOW = new Date('2026-10-31T12:00:00') // a Saturday

/** A session where every sourceable input scores `s` (with enough trials for a narrow band). */
function full(s: number, trials = 40): TaskScores {
  const i = { score: s, trials }
  return {
    OSPAN: i,
    OTS_Planning: i,
    OTS_Execution: i,
    FluidMatrices: i,
    ANT_Conflict: i,
    DCCS_SwitchCost: i,
    ErrorRecovery: i,
    SST_SSRT: { ...i, proxy: true },
    MST_LDI: i,
    UFOV_SOA: i,
    ANT_Orienting: i,
  }
}
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString()
const rec = (id: string, daysAgo: number, inputs: TaskScores): SessionRecord => ({ id, at: at(daysAgo), inputs })

describe('currentPillars', () => {
  it('is all null without sessions', () => {
    const p = currentPillars([])
    expect(Object.values(p).every((s) => s.score === null)).toBe(true)
  })

  it('takes each pillar from the latest session that measured it', () => {
    const sessions = [rec('a', 10, full(40)), rec('b', 2, { MST_LDI: { score: 80, trials: 40 } })]
    const p = currentPillars(sessions)
    expect(p.memory.score).toBeCloseTo(80)
    expect(p.focus.score).toBeCloseTo(40) // not in b: carried from a
  })
})

describe('weakestPillar', () => {
  it('is the lowest measured pillar, or undefined', () => {
    expect(weakestPillar(currentPillars([]))).toBeUndefined()
    const s = full(60)
    s.MST_LDI = { score: 20, trials: 40 }
    expect(weakestPillar(currentPillars([rec('a', 1, s)]))).toBe('memory')
  })
})

describe('improvedPillars (RCI >= 1.96)', () => {
  it('flags a pillar whose latest score passes RCI against its first, and nothing with one session', () => {
    expect(improvedPillars([rec('a', 5, full(40))])).toEqual([])
    // SEdiff = sqrt(2) * 10 * sqrt(0.2) = 6.32; 1.96 x 6.32 = 12.4 points.
    const later = full(40)
    later.MST_LDI = { score: 53, trials: 40 } // +13: real
    later.UFOV_SOA = { score: 52, trials: 40 } // visual: (52 + 40) / 2 = 46, +6: not real
    expect(improvedPillars([rec('a', 5, full(40)), rec('b', 1, later)])).toEqual(['memory'])
  })
})

describe('unifiedHistory', () => {
  it('lists each session with a unified score, oldest first', () => {
    const h = unifiedHistory([rec('b', 1, full(50)), rec('a', 3, full(30)), rec('c', 2, {})])
    expect(h.map((p) => Math.round(p.score))).toEqual([30, 50])
    expect(h[0]!.at).toBe(at(3))
  })
})

describe('sessionsThisWeek', () => {
  it('counts sessions since Monday 00:00', () => {
    // NOW is Saturday 31 Oct; Monday is 26 Oct.
    const s = [rec('a', 6, {}), rec('b', 5, {}), rec('c', 1, {})]
    expect(sessionsThisWeek(s, NOW)).toBe(2)
    expect(weekStart(NOW).getDay()).toBe(1)
  })
})

describe('goalLevel', () => {
  it('is the year\'s first unified score plus the targets spread over the measured pillars', () => {
    const sessions = [rec('a', 20, full(40)), rec('b', 1, full(50))]
    // 5 pillars measured, goals +10 and +15: 40 + 25 / 5 = 45.
    expect(goalLevel({ year: 2026, goals: { memory: 10, focus: 15 } }, sessions, NOW)).toBeCloseTo(45)
  })

  it('is null without goals for this year or without sessions', () => {
    expect(goalLevel({ year: 2025, goals: { memory: 10 } }, [rec('a', 1, full(40))], NOW)).toBeNull()
    expect(goalLevel({ year: 2026, goals: {} }, [rec('a', 1, full(40))], NOW)).toBeNull()
    expect(goalLevel({ year: 2026, goals: { memory: 10 } }, [], NOW)).toBeNull()
  })

  it('never goes above 100', () => {
    expect(goalLevel({ year: 2026, goals: { memory: 100, focus: 100, agility: 100 } }, [rec('a', 1, full(90))], NOW)).toBe(100)
  })
})

describe('curveWindow', () => {
  it('shows at least 21 past days and a forecast of at most 30% of the range', () => {
    const w = curveWindow([{ at: at(3), score: 40 }, { at: at(1), score: 45 }], NOW)
    expect(NOW.getTime() - w.start).toBe(21 * DAY)
    expect(w.horizonDays).toBe(9)
    expect((w.end - NOW.getTime()) / (w.end - w.start)).toBeLessThanOrEqual(0.3)
  })

  it('caps the forecast at 30 days for a long history', () => {
    const w = curveWindow([{ at: at(200), score: 40 }, { at: at(1), score: 45 }], NOW)
    expect(w.horizonDays).toBe(30)
    expect((w.end - NOW.getTime()) / (w.end - w.start)).toBeLessThanOrEqual(0.3)
  })
})

describe('exerciseWeeks', () => {
  it('averages each exercise\'s inputs per Monday week, in week order', () => {
    const s1 = { OSPAN: { score: 40, trials: 10 }, DCCS_SwitchCost: { score: 60, trials: 10 }, MST_LDI: { score: 30, trials: 10 } }
    const s2 = { OSPAN: { score: 70, trials: 10 } }
    const s3 = { MST_LDI: { score: 50, trials: 10 } }
    const h = exerciseWeeks([rec('c', 1, s3), rec('a', 9, s1), rec('b', 8, s2)])
    expect(h.weeks).toHaveLength(2)
    const nback = h.rows.find((r) => r.schema === 'n_back')!
    // Week 1: a (50) and b (70) -> 60. Week 2: nothing.
    expect(nback.name).toBe('Memory Gauntlet')
    expect(nback.values).toEqual([60, null])
    expect(h.rows.find((r) => r.schema === 'mst')!.values).toEqual([30, 50])
    expect(h.cells).toBe(3)
    expect(h.rows.every((r) => r.values.some((v) => v !== null))).toBe(true) // empty exercises left out
  })

  it('needs 20 cells for a heatmap', () => {
    expect(HEATMAP_MIN_CELLS).toBe(20)
  })
})

describe('sessionPath', () => {
  it('trains the weakest measured pillar; with no data it opens the five-exercise baseline', () => {
    expect(sessionPath('memory')).toBe('/train?pillar=memory')
    expect(sessionPath('agility')).toBe('/train?pillar=agility')
    expect(sessionPath(undefined)).toBe('/baseline')
  })
})
