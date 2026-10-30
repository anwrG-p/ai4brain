import { expect, test } from 'vitest'
import { QuestPlus } from './quest'

const DURATIONS = [17, 25, 33, 50, 67, 83, 100, 133, 167, 200, 300, 500]

// mulberry32: tiny seeded PRNG so the simulation is deterministic.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pCorrect = (d: number, theta: number, beta: number) =>
  1 / 16 + (1 - 1 / 16 - 0.02) * (1 - Math.exp(-((d / theta) ** beta)))

test('next() is always a member of durationsMs', () => {
  const q = new QuestPlus(DURATIONS)
  const rand = mulberry32(1)
  for (let i = 0; i < 30; i++) {
    const d = q.next()
    expect(DURATIONS).toContain(d)
    q.update(d + 3, rand() < 0.5) // off-grid shownMs is accepted
  }
})

test('simulated observer with threshold 80 ms is recovered within [50, 130]', () => {
  for (const seed of [42, 7]) {
    const q = new QuestPlus(DURATIONS)
    const rand = mulberry32(seed)
    for (let i = 0; i < 80; i++) {
      const d = q.next()
      q.update(d, rand() < pCorrect(d, 80, 3))
    }
    const t = q.thresholdMs()
    expect(t).toBeGreaterThanOrEqual(50)
    expect(t).toBeLessThanOrEqual(130)
  }
})
