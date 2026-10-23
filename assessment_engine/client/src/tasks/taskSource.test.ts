import { afterEach, describe, expect, test, vi } from 'vitest'
import fixtures from './fixtures.json'
import { fetchNextTask, getUserId } from './taskSource'
import type {
  MatrixParams,
  MstParams,
  NBackParams,
  RelationalParams,
  RotationParams,
  StroopParams,
  TaskPayload,
  TowerParams,
  UfovParams,
} from '../telemetry/types'

const tasks = fixtures as TaskPayload[]
const byType = <P>(t: string) => tasks.find((f) => f.schema_type === t)!.params as P

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('fetchNextTask', () => {
  test('mock mode cycles fixtures and wraps around', async () => {
    const fetchFn = vi.fn()
    const seen: string[] = []
    for (let i = 0; i <= tasks.length; i++) seen.push((await fetchNextTask('u1', fetchFn, true)).task_id)
    expect(fetchFn).not.toHaveBeenCalled()
    // The cycle position is module state, so compare relative to wherever it started.
    expect(new Set(seen.slice(0, tasks.length))).toEqual(new Set(tasks.map((t) => t.task_id)))
    expect(seen[tasks.length]).toBe(seen[0])
  })

  test('VITE_MOCK_TASKS=1 selects mock mode by default', async () => {
    vi.stubEnv('VITE_MOCK_TASKS', '1')
    const fetchFn = vi.fn()
    await fetchNextTask('u1', fetchFn)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('real mode hits /v1/tasks/next with the user id', async () => {
    vi.stubEnv('VITE_MOCK_TASKS', '')
    const fetchFn = vi.fn(async (_url: string) => okResponse(tasks[0]))
    const task = await fetchNextTask('u1', fetchFn)
    expect(fetchFn).toHaveBeenCalledWith('/v1/tasks/next?user_id=u1')
    expect(task).toEqual(tasks[0])
  })

  test('user id is URL-encoded', async () => {
    const fetchFn = vi.fn(async (_url: string) => okResponse(tasks[0]))
    await fetchNextTask('a b&c', fetchFn, false)
    expect(fetchFn).toHaveBeenCalledWith('/v1/tasks/next?user_id=a%20b%26c')
  })

  test('a 500 rejects', async () => {
    const fetchFn = async () => new Response('boom', { status: 500 })
    await expect(fetchNextTask('u1', fetchFn, false)).rejects.toThrow('500')
  })

  afterEach(() => vi.unstubAllEnvs())
})

describe('getUserId', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  test('is stable across calls via localStorage', () => {
    const id = getUserId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('aura_uid')).toBe(id)
    expect(getUserId()).toBe(id)
  })

  test('returns a fresh id when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getUserId()).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('fixtures.json', () => {
  test('one entry per schema_type with the contract dimension', () => {
    const dims = Object.fromEntries(tasks.map((t) => [t.schema_type, t.dimension]))
    expect(tasks).toHaveLength(8)
    expect(dims).toEqual({
      n_back: 'working_memory',
      stroop: 'executive_function',
      matrix: 'pattern_induction',
      mental_rotation: 'spatial_orientation',
      relational: 'pattern_induction',
      tower: 'executive_function',
      ufov: 'processing_speed',
      mst: 'episodic_memory',
    })
    expect(new Set(tasks.map((t) => t.task_id)).size).toBe(8)
    for (const t of tasks) expect(typeof t.surface_seed).toBe('number')
  })

  test('n_back: n=2, dual stream, covers target / lure_minus / switch, every trial answered', () => {
    const p = byType<NBackParams>('n_back')
    expect(p.n).toBe(2)
    expect(p.streams).toEqual(['position', 'symbol'])
    expect(p.trials.length).toBeGreaterThanOrEqual(8)
    const types = new Set(p.trials.map((t) => t.trial_type))
    for (const k of ['target', 'lure_minus', 'switch']) expect(types).toContain(k)
    for (const t of p.trials) {
      expect(typeof t.answer.position).toBe('boolean')
      expect(typeof t.answer.symbol).toBe('boolean')
    }
  })

  test('n_back: answer equals the true n-back match per stream; labels hold on the active stream', () => {
    const { n, trials } = byType<NBackParams>('n_back')
    type T = (typeof trials)[number]
    const same = {
      position: (a: T, b: T) => String(a.pos) === String(b.pos),
      symbol: (a: T, b: T) => a.symbol === b.symbol,
    }
    trials.forEach((t, i) => {
      const back = (k: number) => trials[i - k]
      const pos = i >= n && same.position(t, back(n))
      // Parity rule: the symbol answer is "the symbol is an even digit", not a match.
      const sym = t.rule === 'parity' ? Number(t.symbol) % 2 === 0 : i >= n && same.symbol(t, back(n))
      expect(t.answer, `trial ${i}`).toEqual({ position: pos, symbol: sym })
      if (t.rule === 'parity') return
      // trial_type is relative to the active rule's stream.
      const active = same[t.rule]
      const hit = t.rule === 'position' ? pos : sym
      if (t.trial_type === 'target') expect(hit, `trial ${i} target`).toBe(true)
      if (t.trial_type === 'lure_minus') expect(!hit && i >= n - 1 && active(t, back(n - 1)), `trial ${i} lure_minus`).toBe(true)
      if (t.trial_type === 'lure_plus') expect(!hit && i >= n + 1 && active(t, back(n + 1)), `trial ${i} lure_plus`).toBe(true)
    })
  })

  test('stroop: 4 trials, each answered with a known color', () => {
    const p = byType<StroopParams>('stroop')
    expect(p.trials).toHaveLength(4)
    for (const t of p.trials) expect(p.colors).toContain(t.answer)
  })

  test('matrix: 9 cells with exactly one null and an answer index into options', () => {
    const p = byType<MatrixParams>('matrix')
    expect(p.cells).toHaveLength(9)
    expect(p.cells.filter((c) => c === null)).toHaveLength(1)
    expect(p.options[p.answer]).toBeDefined()
    // CSS color names, so GlyphView's aria-label reads e.g. "2 blue triangles".
    for (const g of [...p.cells, ...p.options]) if (g) expect(g.color).toMatch(/^[a-z]+$/)
  })

  test('mental_rotation: every trial answered', () => {
    for (const t of byType<RotationParams>('mental_rotation').trials)
      expect(['same', 'different']).toContain(t.answer)
  })

  test('relational: 3 levels x 2 trials, every trial answered', () => {
    const p = byType<RelationalParams>('relational')
    expect(p.levels).toHaveLength(3)
    for (const level of p.levels) {
      expect(level).toHaveLength(2)
      for (const t of level) expect(typeof t.answer).toBe('boolean')
    }
  })

  test('tower: optimal_moves respect capacities, reach the goal, and are minimal', () => {
    const p = byType<TowerParams>('tower')
    expect(p.optimal_moves.length).toBeGreaterThan(0)
    expect(p.l_min).toBe(p.optimal_moves.length)
    expect(p.l_min).toBeGreaterThanOrEqual(3)
    expect(p.l_min).toBeLessThanOrEqual(5)
    const pegs = p.start.map((s) => [...s])
    for (const [from, to] of p.optimal_moves) {
      expect(pegs[from].length).toBeGreaterThan(0)
      expect(pegs[to].length).toBeLessThan(p.capacities[to])
      pegs[to].push(pegs[from].pop()!)
    }
    expect(pegs).toEqual(p.goal)
    expect(bfsMinMoves(p)).toBe(p.l_min)
    for (const i of p.counter_intuitive) expect(p.optimal_moves[i]).toBeDefined()
  })

  test('ufov: 4 trials, peripheral_dir in 0..7, ~10 log-spaced durations in 17..500', () => {
    const p = byType<UfovParams>('ufov')
    expect(p.trials).toHaveLength(4)
    for (const t of p.trials) {
      expect(['A', 'B']).toContain(t.central)
      expect(Number.isInteger(t.peripheral_dir)).toBe(true)
      expect(t.peripheral_dir).toBeGreaterThanOrEqual(0)
      expect(t.peripheral_dir).toBeLessThanOrEqual(7)
    }
    const g = p.duration_grid_ms
    expect(g).toHaveLength(10)
    expect(g[0]).toBe(17)
    expect(g[g.length - 1]).toBe(500)
    const ratios = g.slice(1).map((v, i) => v / g[i])
    for (const r of ratios) expect(r).toBeGreaterThan(1.3)
    for (const r of ratios) expect(r).toBeLessThan(1.6)
  })

  test('mst: 3 encode, 5 test mixing old/lure/new; old items repeat an encoded item', () => {
    const p = byType<MstParams>('mst')
    expect(p.encode).toHaveLength(3)
    expect(p.test).toHaveLength(5)
    expect(new Set(p.test.map((t) => t.kind))).toEqual(new Set(['old', 'lure', 'new']))
    for (const t of p.test) {
      if (t.kind === 'old') expect(p.encode).toContainEqual(t.item)
      else expect(p.encode).not.toContainEqual(t.item)
      if (t.kind === 'lure') {
        expect(t.delta).toBeGreaterThanOrEqual(0.05)
        expect(t.delta).toBeLessThanOrEqual(0.4)
      }
    }
  })
})

function bfsMinMoves(p: TowerParams): number {
  const key = (s: string[][]) => JSON.stringify(s)
  const goal = key(p.goal)
  let frontier = [p.start]
  const seen = new Set([key(p.start)])
  for (let depth = 0; frontier.length; depth++) {
    const next: string[][][] = []
    for (const s of frontier) {
      if (key(s) === goal) return depth
      for (let f = 0; f < s.length; f++)
        for (let t = 0; t < s.length; t++) {
          if (f === t || !s[f].length || s[t].length >= p.capacities[t]) continue
          const n = s.map((x) => [...x])
          n[t].push(n[f].pop()!)
          if (seen.has(key(n))) continue
          seen.add(key(n))
          next.push(n)
        }
    }
    frontier = next
  }
  return -1
}
