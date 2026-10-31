import { describe, expect, it } from 'vitest'
import { FALLBACK_ALPHA, fitAlpha, isRealImprovement, projection, rci } from './projection'

const DAY = 86_400_000
const t0 = Date.parse('2026-10-01T09:00:00Z')

describe('rci', () => {
  // Defaults rxx 0.8, sd 10: SEdiff = sqrt(2) * 10 * sqrt(0.2) ~ 6.3246, so 1.96 <-> 12.3961 points.
  const boundary = 1.96 * Math.SQRT2 * 10 * Math.sqrt(0.2)

  it('is the change over the standard error of the difference', () => {
    expect(rci(100, 100)).toBe(0)
    expect(rci(100 + boundary, 100)).toBeCloseTo(1.96, 10)
    expect(rci(90, 100)).toBeCloseTo(-10 / (Math.SQRT2 * 10 * Math.sqrt(0.2)), 10)
    expect(rci(60, 50, 0.9, 5)).toBeCloseTo(10 / (Math.SQRT2 * 5 * Math.sqrt(0.1)), 10)
  })

  it('counts as real improvement from 1.96, not below', () => {
    expect(isRealImprovement(50 + boundary, 50)).toBe(true)
    expect(isRealImprovement(50 + boundary + 0.01, 50)).toBe(true)
    expect(isRealImprovement(50 + boundary - 0.01, 50)).toBe(false)
    expect(isRealImprovement(50 - boundary, 50)).toBe(false)
  })
})

describe('fitAlpha', () => {
  it('falls back with fewer than 3 points', () => {
    expect(fitAlpha([], 90)).toBe(FALLBACK_ALPHA)
    expect(fitAlpha([40, 50], 90)).toBe(FALLBACK_ALPHA)
  })

  it('recovers alpha from an exact learning curve', () => {
    const scores = [0, 1, 2, 3, 4].map((n) => 90 - (90 - 40) * Math.exp(-0.2 * n))
    expect(fitAlpha(scores, 90)).toBeCloseTo(0.2, 10)
  })

  it('stays within bounds when the scores do not rise', () => {
    expect(fitAlpha([60, 50, 40], 90)).toBeGreaterThan(0)
    expect(fitAlpha([40, 89.999, 89.9999], 90)).toBeLessThanOrEqual(0.3)
  })
})

describe('projection', () => {
  const history = [40, 48, 54, 58].map((score, k) => ({ at: new Date(t0 + k * 2 * DAY).toISOString(), score }))
  const now = new Date(t0 + 6 * DAY) // the day of the last session

  it('is null without history', () => {
    expect(projection([], { now })).toBeNull()
  })

  it('has one point per day for 30 and 90 days', () => {
    expect(projection(history, { now })!.optimal).toHaveLength(31)
    const p = projection(history, { now, days: 90 })!
    expect(p.optimal).toHaveLength(91)
    expect(p.optimal[90]!.at).toBe(now.getTime() + 90 * DAY)
  })

  it('rises monotonically toward Tmax and never passes it', () => {
    const p = projection(history, { now, days: 90 })!
    expect(p.tmax).toBe(90)
    const s = p.optimal.map((x) => x.score)
    for (let k = 1; k < s.length; k++) expect(s[k]!).toBeGreaterThan(s[k - 1]!)
    expect(s[0]).toBeCloseTo(58, 10)
    expect(s.at(-1)!).toBeLessThan(90)
    expect(s.at(-1)!).toBeGreaterThan(80)
  })

  // User decision (2026-10-31): no idle-decay line and no idle penalty; no evidence, and it reads as guilt.
  it('starts at the latest score however long the gap, and has no decay series', () => {
    const late = new Date(t0 + 6 * DAY + 40 * DAY) // 40 idle days
    const p = projection(history, { now: late })!
    expect(p.optimal[0]!.score).toBeCloseTo(58, 10)
    expect(p).not.toHaveProperty('decay')
    expect(p).not.toHaveProperty('lambda')
  })

  it('uses the fallback alpha with fewer than 3 points and raises Tmax to the best score', () => {
    const p = projection([{ at: now.toISOString(), score: 95 }], { now })!
    expect(p.alpha).toBe(FALLBACK_ALPHA)
    expect(p.tmax).toBe(95)
    expect(p.optimal.every((x) => x.score === 95)).toBe(true)
  })
})
