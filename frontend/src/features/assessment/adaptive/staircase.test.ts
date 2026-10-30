import { expect, test } from 'vitest'
import { WeightedStaircase } from './staircase'

test('17 correct + 3 errors from level 20 of 40 returns to 20 in any order', () => {
  const orders = [
    [...Array(3).fill(false), ...Array(17).fill(true)],
    [...Array(17).fill(true), ...Array(3).fill(false)],
    Array.from({ length: 20 }, (_, i) => i % 7 !== 3),
  ]
  for (const order of orders) {
    expect(order.filter((c) => !c)).toHaveLength(3)
    const s = new WeightedStaircase(40, 0.85, 1, 20)
    for (const c of order) s.update(c)
    expect(s.level).toBe(20)
  }
})

test('level stays within [0, nLevels-1]', () => {
  const s = new WeightedStaircase(10)
  expect(s.level).toBe(0)
  s.update(false)
  expect(s.level).toBe(0)
  for (let i = 0; i < 50; i++) s.update(true)
  expect(s.level).toBe(9)
  s.update(true)
  expect(s.level).toBe(9)
  s.update(false)
  expect(s.level).toBe(3) // 9 - 0.85/0.15 = 3.33
  for (let i = 0; i < 5; i++) s.update(false)
  expect(s.level).toBe(0)
})
