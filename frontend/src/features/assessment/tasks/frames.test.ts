import { expect, test } from 'vitest'
import { framesFor, measureFrameMs } from './frames'

// Ported from the old client's Ufov.test.tsx, where these two helpers were tested.
const FRAME = 8.33 // 120 Hz

test('framesFor rounds to whole frames, at least one', () => {
  expect(framesFor(50, 16.67)).toBe(3)
  expect(framesFor(5, 16.67)).toBe(1)
  expect(framesFor(50, 8.33)).toBe(6)
  expect(framesFor(50, 0)).toBe(1)
})

test('measureFrameMs returns the median rAF interval', async () => {
  let clock = 0
  let queue: FrameRequestCallback[] = []
  const p = measureFrameMs((cb) => queue.push(cb), 30)
  for (let k = 0; k < 31; k++) {
    clock += FRAME
    const due = queue
    queue = []
    for (const cb of due) cb(clock)
  }
  expect(await p).toBeCloseTo(FRAME, 5)
})
