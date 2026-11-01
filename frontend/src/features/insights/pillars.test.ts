import { describe, expect, it } from 'vitest'
import {
  PILLAR_IDS,
  PILLAR_WEIGHTS,
  pillarScores,
  unifiedScore,
  type TaskScores,
} from './pillars'

describe('PILLAR_WEIGHTS', () => {
  it('are the doc weights, exactly', () => {
    expect(PILLAR_WEIGHTS).toEqual({
      focus: { OSPAN: 0.45, OTS_Planning: 0.3, FluidMatrices: 0.25 },
      agility: { ANT_Conflict: 0.4, DCCS_SwitchCost: 0.4, ErrorRecovery: 0.2 },
      impulse: { SST_SSRT: 0.5, OTS_Execution: 0.3, DDM_Caution: 0.2 },
      memory: { MST_LDI: 0.55, PAL_FirstTrialMemory: 0.45 },
      visual: { UFOV_SOA: 0.5, ANT_Orienting: 0.5 },
    })
  })

  it('sum to 1 for every pillar', () => {
    for (const p of PILLAR_IDS) {
      const sum = Object.values(PILLAR_WEIGHTS[p]).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 12)
    }
  })
})

describe('pillarScores', () => {
  const full: TaskScores = {
    OSPAN: { score: 80, trials: 20 },
    OTS_Planning: { score: 50, trials: 20 },
    FluidMatrices: { score: 60, trials: 20 },
  }

  it('is the weighted sum when every input is there', () => {
    const focus = pillarScores(full).focus
    expect(focus.score).toBeCloseTo(0.45 * 80 + 0.3 * 50 + 0.25 * 60, 10)
    expect(focus.coverage).toBeCloseTo(1, 12)
    expect(focus.proxies).toEqual([])
  })

  it('renormalises the weights over the available inputs', () => {
    const focus = pillarScores({ OSPAN: full.OSPAN, OTS_Planning: full.OTS_Planning }).focus
    expect(focus.coverage).toBeCloseTo(0.75, 12)
    expect(focus.score).toBeCloseTo((0.45 * 80 + 0.3 * 50) / 0.75, 10)
  })

  it('returns null below 0.3 coverage and a score at 0.3', () => {
    const s = pillarScores({ ErrorRecovery: { score: 90, trials: 10 }, OTS_Planning: { score: 40, trials: 10 } })
    expect(s.agility).toMatchObject({ score: null })
    expect(s.agility.coverage).toBeCloseTo(0.2, 12)
    expect(s.focus.coverage).toBeCloseTo(0.3, 12)
    expect(s.focus.score).toBeCloseTo(40, 10)
    expect(s.visual).toMatchObject({ score: null, coverage: 0 })
  })

  it('scores Deep Memory from LDI alone when Pair Finder was not played', () => {
    const memory = pillarScores({ MST_LDI: { score: 70, trials: 20 } }).memory
    expect(memory.score).toBeCloseTo(70, 10)
    expect(memory.coverage).toBeCloseTo(0.55, 12)
  })

  it('scores Deep Memory from LDI and Pair Finder together at full coverage (FE-09)', () => {
    const memory = pillarScores({ MST_LDI: { score: 70, trials: 64 }, PAL_FirstTrialMemory: { score: 50, trials: 20 } }).memory
    expect(memory.coverage).toBeCloseTo(1, 12)
    expect(memory.score).toBeCloseTo(0.55 * 70 + 0.45 * 50, 10)
  })

  it('lists the proxies it used', () => {
    const impulse = pillarScores({ SST_SSRT: { score: 70, trials: 20, proxy: true }, OTS_Execution: { score: 50, trials: 3 } }).impulse
    expect(impulse.proxies).toEqual(['SST_SSRT'])
    expect(impulse.score).toBeCloseTo((0.5 * 70 + 0.3 * 50) / 0.8, 10)
  })

  it('widens the uncertainty as coverage falls', () => {
    const all = pillarScores(full).focus.uncertainty
    const two = pillarScores({ OSPAN: full.OSPAN, OTS_Planning: full.OTS_Planning }).focus.uncertainty
    const one = pillarScores({ OTS_Planning: full.OTS_Planning }).focus.uncertainty
    expect(two).toBeGreaterThan(all)
    expect(one).toBeGreaterThan(two)
  })

  it('widens the Deep Memory band when Pair Finder, now sourceable, is missing', () => {
    // oMST: 44 lures + 20 foils. The LDI's own band is 1.96 * 50 / 8 = 12.25; PAL has a source now
    // (Pair Finder), so its absence divides the band by the coverage 0.55.
    const memory = pillarScores({ MST_LDI: { score: 70, trials: 64 } }).memory
    expect(memory.coverage).toBeCloseTo(0.55, 12)
    expect(memory.uncertainty).toBeCloseTo(12.25 / 0.55, 6)
  })

  it('keeps the band narrow for Impulse Control: the unsourced DDM_Caution does not widen it', () => {
    // sourceable = SST 0.5 + OTS 0.3 = 0.8 = coverage, so no widening. Weights renormalised over 0.8:
    // variance = (0.5/0.8)^2 * 2500/64 + (0.3/0.8)^2 * 2500/16 = 15.2588 + 21.9727 = 37.2314.
    const impulse = pillarScores({ SST_SSRT: { score: 60, trials: 64 }, OTS_Execution: { score: 60, trials: 16 } }).impulse
    expect(impulse.coverage).toBeCloseTo(0.8, 12)
    expect(impulse.uncertainty).toBeCloseTo(1.96 * Math.sqrt(37.2314453125), 6)
  })

  it('widens the uncertainty as trials drop, and caps it at 50', () => {
    const at = (trials: number) => pillarScores({ MST_LDI: { score: 70, trials } }).memory.uncertainty
    expect(at(10)).toBeGreaterThan(at(40))
    expect(at(40)).toBeGreaterThan(at(160))
    expect(at(1)).toBe(50)
    expect(at(0)).toBe(50)
    expect(pillarScores({}).memory.uncertainty).toBe(50)
  })
})

describe('unifiedScore', () => {
  it('is the mean of the pillars that have a score', () => {
    const s = pillarScores({ MST_LDI: { score: 70, trials: 20 }, UFOV_SOA: { score: 40, trials: 20 } })
    expect(unifiedScore(s)).toBeCloseTo(55, 10)
  })

  it('is null when no pillar has a score', () => {
    expect(unifiedScore(pillarScores({}))).toBeNull()
  })
})

