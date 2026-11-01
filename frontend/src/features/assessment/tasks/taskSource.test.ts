import { afterEach, describe, expect, test, vi } from 'vitest'
import { useDevicePrefs } from '../../../state/devicePrefs'
import fixtures from './fixtures.json'
import { fetchNextTask, forgetUserId, getUserId, newId } from './taskSource'
import type {
  MatrixParams,
  MstParams,
  NBackParams,
  RelationalParams,
  RotationParams,
  SchemaType,
  StroopParams,
  TaskPayload,
  TowerParams,
  UfovParams,
} from '../telemetry/types'

const tasks = fixtures as TaskPayload[]
const first = tasks[0]!
const byType = <P>(t: string) => tasks.find((f) => f.schema_type === t)!.params as P

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('fetchNextTask', () => {
  afterEach(() => vi.unstubAllEnvs())

  test('mock mode (the default) picks fixtures[seq % length], so a repeated seq returns the same fixture', async () => {
    const fetchFn = vi.fn()
    const seen: string[] = []
    for (let i = 0; i <= tasks.length; i++) seen.push((await fetchNextTask('u1', i, { fetchFn })).task_id)
    expect(fetchFn).not.toHaveBeenCalled()
    expect(seen.slice(0, tasks.length)).toEqual(tasks.map((t) => t.task_id))
    expect(seen[tasks.length]).toBe(first.task_id)
    expect((await fetchNextTask('u1', 3, { fetchFn })).task_id).toBe(tasks[3]!.task_id)
    expect((await fetchNextTask('u1', 3, { fetchFn })).task_id).toBe(tasks[3]!.task_id)
  })

  test('mock mode with a schemaType returns that fixture whatever the seq', async () => {
    const fetchFn = vi.fn()
    const tower = await fetchNextTask('u', 0, { schemaType: 'tower', fetchFn })
    expect(tower.schema_type).toBe('tower')
    expect(tower).toEqual(tasks.find((t) => t.schema_type === 'tower'))
    for (const s of tasks.map((t) => t.schema_type))
      expect((await fetchNextTask('u', 5, { schemaType: s })).schema_type).toBe(s)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('VITE_USE_MOCKS is read at call time; only "false" turns mocks off', async () => {
    const fetchFn = vi.fn(async (_url: string) => okResponse(first))
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    await fetchNextTask('u1', 0, { fetchFn })
    vi.stubEnv('VITE_USE_MOCKS', '')
    await fetchNextTask('u1', 0, { fetchFn })
    expect(fetchFn).not.toHaveBeenCalled()
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    await fetchNextTask('u1', 0, { fetchFn })
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  describe('real mode', () => {
    const real = () => vi.stubEnv('VITE_USE_MOCKS', 'false')

    test('hits /v1/tasks/next with the user id', async () => {
      real()
      const fetchFn = vi.fn(async (_url: string) => okResponse(first))
      const task = await fetchNextTask('u1', 0, { fetchFn })
      expect(fetchFn).toHaveBeenCalledWith('/v1/tasks/next?user_id=u1')
      expect(task).toEqual(first)
    })

    test('ignores schemaType: the generator decides (R2)', async () => {
      real()
      const fetchFn = vi.fn(async (_url: string) => okResponse(first))
      const task = await fetchNextTask('u1', 0, { schemaType: 'tower', fetchFn })
      expect(fetchFn).toHaveBeenCalledWith('/v1/tasks/next?user_id=u1')
      expect(task.schema_type).toBe(first.schema_type)
    })

    test('user id is URL-encoded', async () => {
      real()
      const fetchFn = vi.fn(async (_url: string) => okResponse(first))
      await fetchNextTask('a b&c', 0, { fetchFn })
      expect(fetchFn).toHaveBeenCalledWith('/v1/tasks/next?user_id=a%20b%26c')
    })

    test.each(['stop_signal', 'pal', 'flanker'] as const)('a server payload of the newer exercise %s is accepted', async (schema) => {
      real()
      const payload = tasks.find((t) => t.schema_type === schema)!
      const fetchFn = vi.fn(async (_url: string) => okResponse(payload))
      expect((await fetchNextTask('u1', 0, { fetchFn })).schema_type).toBe(schema)
    })

    test('a 500 rejects', async () => {
      real()
      const fetchFn = async () => new Response('boom', { status: 500 })
      await expect(fetchNextTask('u1', 0, { fetchFn })).rejects.toThrow('500')
    })

    test.each([
      ['unknown schema_type', { schema_type: 'bogus' }],
      ['unknown dimension', { dimension: 'iq' }],
      ['task_id with a space', { task_id: 'a b' }],
      ['task_id over 48 chars', { task_id: 'x'.repeat(49) }],
      ['empty task_id', { task_id: '' }],
      ['null params', { params: null }],
      ['string params', { params: 'x' }],
    ])('a payload with %s rejects', async (_name, bad) => {
      real()
      const fetchFn = async () => okResponse({ ...first, ...bad })
      await expect(fetchNextTask('u1', 0, { fetchFn })).rejects.toThrow(/invalid task payload/)
    })

    test('a non-object body rejects', async () => {
      real()
      await expect(fetchNextTask('u1', 0, { fetchFn: async () => okResponse(null) })).rejects.toThrow(
        /invalid task payload/,
      )
    })

    test('a 48-char task_id with : . - is accepted', async () => {
      real()
      const task_id = 'm5:v1.2-' + 'a'.repeat(40)
      const fetchFn = async () => okResponse({ ...first, task_id })
      expect((await fetchNextTask('u1', 0, { fetchFn })).task_id).toBe(task_id)
    })
  })

  describe('colour-blind friendly Color Clash (cvd_safe)', () => {
    const stroop = tasks.find((t) => t.schema_type === 'stroop')!
    afterEach(() => useDevicePrefs.setState({ cvdSafe: false }))

    test('off by default: the classic fixture and no inks parameter', async () => {
      expect(useDevicePrefs.getState().cvdSafe).toBe(false)
      expect((await fetchNextTask('u1', 0, { schemaType: 'stroop' })).params).toEqual(stroop.params)
      vi.stubEnv('VITE_USE_MOCKS', 'false')
      const fetchFn = vi.fn(async (_url: string) => okResponse(stroop))
      await fetchNextTask('u1', 0, { fetchFn })
      expect(fetchFn).toHaveBeenCalledWith('/v1/tasks/next?user_id=u1')
    })

    test('mock mode with the setting on: the Stroop fixture uses the cvd_safe inks; other tasks are untouched', async () => {
      useDevicePrefs.setState({ cvdSafe: true })
      const task = await fetchNextTask('u1', 0, { schemaType: 'stroop' })
      expect((task.params as StroopParams).colors).toEqual(['blue', 'yellow', 'red', 'black'])
      expect(JSON.stringify(task.params)).not.toMatch(/green/i)
      expect(task.task_id).toBe(stroop.task_id)
      expect(stroop.params).toEqual(byType<StroopParams>('stroop')) // the fixture itself is not mutated
      expect((stroop.params as StroopParams).colors).toContain('green')
      const tower = await fetchNextTask('u1', 0, { schemaType: 'tower' })
      expect(tower).toBe(tasks.find((t) => t.schema_type === 'tower'))
    })

    test('real mode with the setting on asks for inks=cvd_safe, and converts a classic block that still comes back', async () => {
      useDevicePrefs.setState({ cvdSafe: true })
      vi.stubEnv('VITE_USE_MOCKS', 'false')
      const fetchFn = vi.fn(async (_url: string) => okResponse(stroop))
      const task = await fetchNextTask('a b', 0, { fetchFn })
      expect(fetchFn).toHaveBeenCalledWith('/v1/tasks/next?user_id=a%20b&inks=cvd_safe')
      expect((task.params as StroopParams).colors).toEqual(['blue', 'yellow', 'red', 'black'])
    })

    test('an explicit inks option wins over the setting', async () => {
      useDevicePrefs.setState({ cvdSafe: true })
      expect(((await fetchNextTask('u1', 0, { schemaType: 'stroop', inks: 'classic' })).params as StroopParams).colors).toContain('green')
    })
  })
})

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('uses crypto.randomUUID when available', () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('falls back to getRandomValues outside secure contexts (no randomUUID)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    const a = newId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(newId()).not.toBe(a)
  })

  test('falls back to Math.random without Web Crypto', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newId()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('getUserId', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    forgetUserId() // also drops the in-memory fallback id
    localStorage.clear()
  })

  const blockStorage = () =>
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })

  test('is stable across calls via localStorage', () => {
    const id = getUserId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('aura_uid')).toBe(id)
    expect(getUserId()).toBe(id)
  })

  test('an invalid stored id is replaced', () => {
    for (const bad of ['../etc', 'x'.repeat(65), '']) {
      localStorage.setItem('aura_uid', bad)
      const id = getUserId()
      expect(id).toMatch(/^[0-9a-f-]{36}$/)
      expect(localStorage.getItem('aura_uid')).toBe(id)
    }
  })

  test('works without crypto.randomUUID', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    try {
      expect(getUserId()).toMatch(/^[0-9a-f]{32}$/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('returns a fresh id when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getUserId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('without storage, the id stays the same for the page load', () => {
    blockStorage()
    const id = getUserId()
    expect(getUserId()).toBe(id)
  })

  test('forgetUserId removes the stored id, so the next one is new', () => {
    const id = getUserId()
    forgetUserId()
    expect(localStorage.getItem('aura_uid')).toBeNull()
    expect(getUserId()).not.toBe(id)
  })

  test('forgetUserId also drops the in-memory id used without storage', () => {
    blockStorage()
    const id = getUserId()
    forgetUserId()
    expect(getUserId()).not.toBe(id)
  })
})

describe('fixtures.json', () => {
  test('one entry per schema_type with the contract dimension', () => {
    const dims = Object.fromEntries(tasks.map((t) => [t.schema_type, t.dimension]))
    const expected = {
      n_back: 'working_memory',
      stroop: 'executive_function',
      matrix: 'pattern_induction',
      mental_rotation: 'spatial_orientation',
      relational: 'pattern_induction',
      tower: 'executive_function',
      ufov: 'processing_speed',
      mst: 'episodic_memory',
      stop_signal: 'executive_function',
      pal: 'episodic_memory',
      flanker: 'executive_function',
    } satisfies Record<SchemaType, string>
    const n = Object.keys(expected).length
    expect(tasks).toHaveLength(n)
    expect(dims).toEqual(expected)
    expect(new Set(tasks.map((t) => t.task_id)).size).toBe(n)
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
      const back = (k: number) => trials[i - k]!
      const pos = i >= n && same.position(t, back(n))
      // Parity rule: the symbol answer is "the symbol is an even digit", not a match.
      const sym = t.rule === 'parity' ? Number(t.symbol) % 2 === 0 : i >= n && same.symbol(t, back(n))
      expect(t.answer, `trial ${i}`).toEqual({ position: pos, symbol: sym })
      if (t.rule === 'parity') return
      // trial_type is relative to the active rule's stream.
      const active = same[t.rule]
      const hit = t.rule === 'position' ? pos : sym
      if (t.trial_type === 'target') expect(hit, `trial ${i} target`).toBe(true)
      if (t.trial_type === 'lure_minus')
        expect(!hit && i >= n - 1 && active(t, back(n - 1)), `trial ${i} lure_minus`).toBe(true)
      if (t.trial_type === 'lure_plus')
        expect(!hit && i >= n + 1 && active(t, back(n + 1)), `trial ${i} lure_plus`).toBe(true)
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
    // CSS color names (never hex), so GlyphView's aria-label reads e.g. "2 blue triangles".
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

  test('tower: optimal_moves respect capacities, reach the goal, and are minimal; 60 s limit', () => {
    const p = byType<TowerParams>('tower')
    expect(p.time_limit_ms).toBe(60000)
    expect(p.optimal_moves.length).toBeGreaterThan(0)
    expect(p.l_min).toBe(p.optimal_moves.length)
    expect(p.l_min).toBeGreaterThanOrEqual(3)
    expect(p.l_min).toBeLessThanOrEqual(5)
    const pegs = p.start.map((s) => [...s])
    for (const [from, to] of p.optimal_moves) {
      expect(pegs[from]!.length).toBeGreaterThan(0)
      expect(pegs[to]!.length).toBeLessThan(p.capacities[to]!)
      pegs[to]!.push(pegs[from]!.pop()!)
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
    const ratios = g.slice(1).map((v, i) => v / g[i]!)
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
          if (f === t || !s[f]!.length || s[t]!.length >= p.capacities[t]!) continue
          const n = s.map((x) => [...x])
          n[t]!.push(n[f]!.pop()!)
          if (seen.has(key(n))) continue
          seen.add(key(n))
          next.push(n)
        }
    }
    frontier = next
  }
  return -1
}
