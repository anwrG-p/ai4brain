import { describe, expect, it } from 'vitest'
import {
  HEATMAP_MIN_CELLS,
  curveWindow,
  currentPillars,
  exerciseWeeks,
  goalLines,
  improvedPillars,
  sessionPath,
  sessionsThisWeek,
  unifiedHistory,
  weakestPillar,
  weekStart,
} from './dashboard'
import { PILLAR_IDS, type PillarId, type PillarScore, type TaskScores } from './pillars'
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

describe('weakestPillar (the one weakest pillar: Home, Loti and Train)', () => {
  const score = (s: number | null): PillarScore => ({ score: s, uncertainty: 10, coverage: s === null ? 0 : 1, proxies: [] })
  const scores = (values: Record<PillarId, number | null>) =>
    Object.fromEntries(PILLAR_IDS.map((p) => [p, score(values[p])])) as Record<PillarId, PillarScore>

  it('is the lowest measured pillar, or null', () => {
    expect(weakestPillar(currentPillars([]))).toBeNull()
    const s = full(60)
    s.MST_LDI = { score: 20, trials: 40 }
    expect(weakestPillar(currentPillars([rec('a', 1, s)]))).toBe('memory')
  })

  it('keeps the pillar order on ties and skips unscored pillars', () => {
    expect(weakestPillar(scores({ focus: 40, agility: null, impulse: 40, memory: 90, visual: null }))).toBe('focus')
  })

  it('looks only among the pillars given (Train: the pillars on the page)', () => {
    const all = scores({ focus: 80, agility: 60, impulse: 70, memory: 50, visual: 35 })
    expect(weakestPillar(all)).toBe('visual')
    expect(weakestPillar(all, ['agility', 'impulse'])).toBe('agility')
    expect(weakestPillar(all, [])).toBeNull()
  })
})

describe('improvedPillars (RCI >= 1.96)', () => {
  it('flags a pillar whose latest score passes RCI against its first, and nothing with fewer than 3 sessions', () => {
    expect(improvedPillars([rec('a', 5, full(40))])).toEqual([])
    const later = full(40)
    later.MST_LDI = { score: 53, trials: 40 } // +13: real
    later.UFOV_SOA = { score: 52, trials: 40 } // visual: (52 + 40) / 2 = 46, +6: not real
    // 2 sessions: practice plateau requires >= 3 sessions
    expect(improvedPillars([rec('a', 5, full(40)), rec('b', 1, later)])).toEqual([])
    // 3 sessions: passes RCI and session threshold
    expect(improvedPillars([rec('a', 5, full(40)), rec('mid', 3, full(42)), rec('b', 1, later)])).toEqual(['memory'])
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

describe('goalLines (each goal against its own pillar)', () => {
  const scored = (memory: number, focus = 50) => {
    const t = full(focus)
    t.MST_LDI = { score: memory, trials: 40 }
    return currentPillars([rec('a', 1, t)])
  }
  const stored = (bases: Record<string, number>) => ({ year: 2026, goals: { memory: 10 }, bases })

  it('is never met at the moment it is set: goal = base + target, current = base', () => {
    expect(goalLines(stored({ memory: 52 }), scored(52), NOW)).toEqual([
      { pillar: 'memory', target: 10, base: 52, goal: 62, current: 52, reached: false },
    ])
  })

  it('is reached only by its own pillar', () => {
    expect(goalLines(stored({ memory: 52 }), scored(63), NOW)[0]).toMatchObject({ goal: 62, reached: true })
    // Another skill rising does not meet a Deep Memory goal.
    expect(goalLines(stored({ memory: 52 }), scored(52, 95), NOW)[0]).toMatchObject({ reached: false })
  })

  it('caps the goal at 100 and needs a rise above the base to count as reached', () => {
    expect(goalLines(stored({ memory: 100 }), scored(100), NOW)[0]).toMatchObject({ goal: 100, reached: false })
  })

  it('has no goal level without a base, and nothing for another year', () => {
    expect(goalLines(stored({}), scored(52), NOW)[0]).toMatchObject({ base: null, goal: null, current: 52, reached: false })
    expect(goalLines({ ...stored({ memory: 52 }), year: 2025 }, scored(52), NOW)).toEqual([])
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

  it('files the newer inputs under Stop Light, Arrow Focus and Pair Finder; a proxy under Color Clash', () => {
    const real = { SST_SSRT: { score: 40, trials: 50 }, ANT_Conflict: { score: 60, trials: 90 }, PAL_FirstTrialMemory: { score: 70, trials: 20 } }
    const stand = { SST_SSRT: { score: 20, trials: 4, proxy: true as const }, ANT_Conflict: { score: 30, trials: 4, proxy: true as const } }
    const h = exerciseWeeks([rec('a', 9, real), rec('b', 9, stand)])
    const row = (s: string) => h.rows.find((r) => r.schema === s)
    expect(row('stop_signal')).toMatchObject({ name: 'Stop Light', values: [40] })
    expect(row('flanker')).toMatchObject({ name: 'Arrow Focus', values: [60] })
    expect(row('pal')).toMatchObject({ name: 'Pair Finder', values: [70] })
    expect(row('stroop')).toMatchObject({ name: 'Color Clash', values: [25] }) // mean of the two stand-ins
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
