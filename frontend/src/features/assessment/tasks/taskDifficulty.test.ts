import { describe, expect, it } from 'vitest'
import fixtures from './fixtures.json'
import type {
  FlankerParams,
  MstParams,
  NBackParams,
  Poly,
  RelationalParams,
  RotationParams,
  StopSignalParams,
  StroopParams,
  TaskPayload,
  TowerParams,
} from '../telemetry/types'
import { adaptTaskForDifficulty } from './taskDifficulty'

const tasks = fixtures as TaskPayload[]
const fixture = (s: string) => tasks.find((t) => t.schema_type === s)!

function createMock64MstTask(): TaskPayload {
  const encode: Poly[] = []
  // 64 distinct base figures
  for (let i = 0; i < 64; i++) {
    encode.push({
      points: [
        [0.1 + (i % 8) * 0.05, 0.1 + Math.floor(i / 8) * 0.05],
        [0.85, 0.2],
        [0.5, 0.85],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    })
  }

  const test: MstParams['test'] = []
  // 20 old items
  for (let i = 0; i < 20; i++) {
    const enc = encode[i]!
    test.push({
      item: {
        points: enc.points.map((p) => [...p]),
        edges: enc.edges.map((e) => [...e]),
      },
      kind: 'old',
      delta: 0,
    })
  }
  // 44 lure items (perturb 1 point of encode[20 + i])
  for (let i = 0; i < 44; i++) {
    const base = encode[20 + i]!
    test.push({
      item: {
        points: [
          [base.points[0]![0] + 0.02, base.points[0]![1] + 0.02],
          [base.points[1]![0], base.points[1]![1]],
          [base.points[2]![0], base.points[2]![1]],
        ],
        edges: base.edges.map((e) => [...e]),
      },
      kind: 'lure',
      delta: 0.028,
    })
  }
  // 20 new items (foils)
  for (let i = 0; i < 20; i++) {
    test.push({
      item: {
        points: [
          [0.01 + i * 0.02, 0.01],
          [0.4, 0.4],
          [0.9, 0.9],
        ],
        edges: [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
      },
      kind: 'new',
      delta: 0,
    })
  }

  return {
    task_id: 'mock-64-mst',
    dimension: 'episodic_memory',
    schema_type: 'mst',
    surface_seed: 42,
    params: {
      encode_ms: 2000,
      encode,
      test,
    },
  }
}

describe('adaptTaskForDifficulty', () => {
  it('balanced returns n_back task as is', () => {
    const orig = fixture('n_back')
    expect(adaptTaskForDifficulty(orig, 'balanced')).toBe(orig)
  })

  it('gentle adapts n_back to approachable 1-back with valid targets and relaxed timing', () => {
    const orig = fixture('n_back')
    const adapted = adaptTaskForDifficulty(orig, 'gentle')
    const p = adapted.params as NBackParams
    expect(p.n).toBe(1)
    expect(p.interval_ms).toBeGreaterThanOrEqual(2400)
    expect(p.trials.length).toBeLessThanOrEqual(10)
    // Has targets
    const targets = p.trials.filter((t) => t.trial_type === 'target')
    expect(targets.length).toBeGreaterThan(0)
    for (const t of targets) {
      expect(t.answer.position).toBe(true)
    }
  })

  it('gentle adapts Tower to a friendly 2-move problem without counter-intuitive traps', () => {
    const orig = fixture('tower')
    const adapted = adaptTaskForDifficulty(orig, 'gentle')
    const p = adapted.params as TowerParams
    expect(p.l_min).toBe(2)
    expect(p.counter_intuitive).toEqual([])
    expect(p.optimal_moves).toEqual([[1, 2], [0, 1]])
    expect(p.time_limit_ms).toBeGreaterThanOrEqual(60000)
  })

  it('gentle adapts Relational to 1-2 hops with relaxed timer', () => {
    const orig = fixture('relational')
    const adapted = adaptTaskForDifficulty(orig, 'gentle')
    const p = adapted.params as RelationalParams
    expect(p.n_trials).toBeLessThanOrEqual(4)
    expect(p.time_limit_ms).toBeGreaterThanOrEqual(25000)
    for (const level of p.levels) {
      for (const item of level) {
        expect(item.hops).toBeLessThanOrEqual(2)
      }
    }
  })

  it('gentle relaxes timers on speeded tasks (Stroop, StopSignal, Flanker, Rotation)', () => {
    const stroop = adaptTaskForDifficulty(fixture('stroop'), 'gentle')
    expect((stroop.params as StroopParams).time_limit_ms).toBeGreaterThanOrEqual(4000)

    const stop = adaptTaskForDifficulty(fixture('stop_signal'), 'gentle')
    const stopParams = stop.params as StopSignalParams
    expect(stopParams.time_limit_ms).toBeGreaterThanOrEqual(2000)
    expect(stopParams.trials.length).toBeLessThanOrEqual(16)

    const flanker = adaptTaskForDifficulty(fixture('flanker'), 'gentle')
    const flankerParams = flanker.params as FlankerParams
    expect(flankerParams.time_limit_ms).toBeGreaterThanOrEqual(2500)
    expect(flankerParams.trials.length).toBeLessThanOrEqual(16)

    const rot = adaptTaskForDifficulty(fixture('mental_rotation'), 'gentle')
    const rotParams = rot.params as RotationParams
    expect(rotParams.time_limit_ms).toBeGreaterThanOrEqual(12000)
  })

  it('caps long training blocks in balanced mode so users are not overwhelmed', () => {
    const stop = adaptTaskForDifficulty(fixture('stop_signal'), 'balanced')
    expect((stop.params as StopSignalParams).trials.length).toBeLessThanOrEqual(32)

    const flanker = adaptTaskForDifficulty(fixture('flanker'), 'balanced')
    expect((flanker.params as FlankerParams).trials.length).toBeLessThanOrEqual(32)
  })

  it('challenge tightens timers for advanced practice', () => {
    const stroop = adaptTaskForDifficulty(fixture('stroop'), 'challenge')
    expect((stroop.params as StroopParams).time_limit_ms).toBe(2000)

    const tower = adaptTaskForDifficulty(fixture('tower'), 'challenge')
    expect((tower.params as TowerParams).time_limit_ms).toBe(45000)
  })

  describe('Precision Archive (MST) difficulty adaptation', () => {
    it('adapts a 64-study-item MST into a gentle 4-item study block with matched test items', () => {
      const fullMst = createMock64MstTask()
      const adapted = adaptTaskForDifficulty(fullMst, 'gentle')
      const p = adapted.params as MstParams

      expect(p.encode.length).toBe(4)
      expect(p.test.length).toBe(6)
      expect(p.encode_ms).toBeGreaterThanOrEqual(2500)

      const olds = p.test.filter((t) => t.kind === 'old')
      const lures = p.test.filter((t) => t.kind === 'lure')
      const news = p.test.filter((t) => t.kind === 'new')

      expect(olds.length).toBe(2)
      expect(lures.length).toBe(2)
      expect(news.length).toBe(2)

      // Every old item is an exact match for one of the 4 encode items
      for (const old of olds) {
        const found = p.encode.some(
          (e) =>
            JSON.stringify(e.points) === JSON.stringify(old.item.points) &&
            JSON.stringify(e.edges) === JSON.stringify(old.item.edges),
        )
        expect(found).toBe(true)
      }

      // Every lure item has exactly 1 vertex changed compared to its base in encode
      for (const lure of lures) {
        const hasBase = p.encode.some((e) => {
          let diffs = 0
          for (let i = 0; i < lure.item.points.length; i++) {
            const [lx, ly] = lure.item.points[i]!
            const [ex, ey] = e.points[i]!
            if (Math.abs(lx - ex) > 1e-3 || Math.abs(ly - ey) > 1e-3) diffs++
          }
          return diffs === 1
        })
        expect(hasBase).toBe(true)
      }

      // News are not in encode
      for (const n of news) {
        const foundInEncode = p.encode.some(
          (e) =>
            JSON.stringify(e.points) === JSON.stringify(n.item.points) &&
            JSON.stringify(e.edges) === JSON.stringify(n.item.edges),
        )
        expect(foundInEncode).toBe(false)
      }
    })

    it('adapts a 64-study-item MST into 6 items for balanced and 8 items for challenge', () => {
      const fullMst = createMock64MstTask()

      const balanced = adaptTaskForDifficulty(fullMst, 'balanced')
      const balancedP = balanced.params as MstParams
      expect(balancedP.encode.length).toBe(6)
      expect(balancedP.test.length).toBe(9)

      const challenge = adaptTaskForDifficulty(fullMst, 'challenge')
      const challengeP = challenge.params as MstParams
      expect(challengeP.encode.length).toBe(8)
      expect(challengeP.test.length).toBe(12)
    })
  })
})
