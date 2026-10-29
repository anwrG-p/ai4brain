import { describe, expect, it } from 'vitest'
import { hesitationJitter, nextErrorBurst } from './metrics'

describe('hesitationJitter', () => {
  it('is 0 with fewer than 3 inputs', () => {
    expect(hesitationJitter([])).toBe(0)
    expect(hesitationJitter([0, 100])).toBe(0)
  })
  it('is 0 for evenly spaced inputs', () => {
    expect(hesitationJitter([0, 100, 200, 300])).toBe(0)
  })
  it('is the population std-dev of the intervals', () => {
    expect(hesitationJitter([0, 100, 400])).toBeCloseTo(100) // intervals 100,300
  })
})

describe('nextErrorBurst', () => {
  it('extends the run on an error and resets on a correct response', () => {
    expect(nextErrorBurst(2, false)).toBe(3)
    expect(nextErrorBurst(2, true)).toBe(0)
  })
})
