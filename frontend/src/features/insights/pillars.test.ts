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

  it('scores Deep Memory from LDI alone, since PAL has no source', () => {
    const memory = pillarScores({ MST_LDI: { score: 70, trials: 20 } }).memory
    expect(memory.score).toBeCloseTo(70, 10)
    expect(memory.coverage).toBeCloseTo(0.55, 12)
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

  it('keeps the band narrow for Deep Memory on a full block: unsourced inputs do not widen it', () => {
    // oMST: 44 lures + 20 foils. PAL has no source by design, so coverage stays 0.55 but the band
    // is only the LDI's own: 1.96 * 50 / 8.
    const memory = pillarScores({ MST_LDI: { score: 70, trials: 64 } }).memory
    expect(memory.coverage).toBeCloseTo(0.55, 12)
    expect(memory.uncertainty).toBeCloseTo(12.25, 6)
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

