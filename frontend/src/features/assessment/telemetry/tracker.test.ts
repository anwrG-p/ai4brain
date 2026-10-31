import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Tracker, TrialRecorder } from './tracker'
import type { TelemetryEvent } from './types'

const ctx = {
  user_id: 'u1',
  session_id: 's1',
  task_id: 't1',
  dimension: 'working_memory' as const,
  voice_opt_in: false,
}

function clock() {
  let t = 0
  return { now: () => t, set: (v: number) => (t = v) }
}

describe('TrialRecorder', () => {
  test('finish computes rt, latency, jitter, burst', () => {
    const c = clock()
    const r = new TrialRecorder(ctx, c.now)
    r.start(0)
    for (const t of [100, 200, 400]) {
      c.set(t)
      r.input()
    }
    c.set(500)
    const e = r.finish({ correct: false })
    expect(e).toMatchObject({
      user_id: 'u1',
      session_id: 's1',
      task_id: 't1',
      trial_index: 0,
      dimension: 'working_memory',
      response_time_ms: 500,
      keystroke_latency_ms: 100,
      hesitation_jitter: 50,
      error_burst: 1,
      error_flag: true,
      score_norm: 0,
      trial_meta: { item_id: 't1:0' },
    })
    expect(Number.isNaN(Date.parse(e.client_ts))).toBe(false)
  })

  test('error burst accumulates and resets on correct', () => {
    const r = new TrialRecorder(ctx, clock().now)
    r.start(0)
    r.finish({ correct: false })
    r.start(1)
    expect(r.finish({ correct: false }).error_burst).toBe(2)
    r.start(2)
    const e = r.finish({ correct: true })
    expect(e).toMatchObject({ error_burst: 0, error_flag: false, score_norm: 1 })
  })

  test('timeout uses windowMs', () => {
    const c = clock()
    const r = new TrialRecorder(ctx, c.now)
    r.start(0)
    c.set(3100)
    const e = r.finish({ correct: false, windowMs: 3000 })
    expect(e.response_time_ms).toBe(3000)
    expect(e.keystroke_latency_ms).toBeNull()
  })

  test('response_time_ms is capped at 600000 and score_norm clamped into [0, 1]', () => {
    const c = clock()
    const r = new TrialRecorder(ctx, c.now)
    r.start(0)
    c.set(700_000)
    expect(r.finish({ correct: true, score: 1.4 })).toMatchObject({ response_time_ms: 600_000, score_norm: 1 })
    r.start(1)
    expect(r.finish({ correct: false, score: -0.2, windowMs: 900_000 })).toMatchObject({
      response_time_ms: 600_000,
      score_norm: 0,
    })
  })

  test('response_time_ms is clamped up to 0, and a non-finite one becomes 0', () => {
    const r = new TrialRecorder(ctx, clock().now)
    for (const [i, windowMs] of [-5, Number.NaN, Number.POSITIVE_INFINITY].entries()) {
      r.start(i)
      expect(r.finish({ correct: true, windowMs }).response_time_ms).toBe(0)
    }
  })

  test('score override and meta merge', () => {
    const r = new TrialRecorder(ctx, clock().now)
    r.start(0)
    const e = r.finish({ correct: false, score: 0.6, meta: { l_min: 5 } })
    expect(e.score_norm).toBe(0.6)
    expect(e.trial_meta).toEqual({ item_id: 't1:0', l_min: 5 })
  })

  test('abort emits nothing', () => {
    const r = new TrialRecorder(ctx, clock().now)
    r.start(0)
    r.abort()
    expect(() => r.finish({ correct: true })).toThrow()
  })

  test('pointer moves feed jitter but not first-press latency', () => {
    const c = clock()
    const r = new TrialRecorder(ctx, c.now)
    r.start(0)
    c.set(30)
    r.input('move')
    c.set(90)
    r.input('move')
    c.set(250)
    r.input('key')
    c.set(300)
    r.input('down')
    c.set(400)
    const e = r.finish({ correct: true })
    expect(e.keystroke_latency_ms).toBe(250)
    expect(e.hesitation_jitter).toBeGreaterThan(0)
  })

  test('moves only: latency stays null', () => {
    const c = clock()
    const r = new TrialRecorder(ctx, c.now)
    r.start(0)
    c.set(30)
    r.input('move')
    c.set(400)
    expect(r.finish({ correct: true }).keystroke_latency_ms).toBeNull()
  })

  test('input outside a trial is ignored', () => {
    const c = clock()
    const r = new TrialRecorder(ctx, c.now)
    r.input()
    c.set(50)
    r.start(0)
    c.set(80)
    expect(r.finish({ correct: true }).keystroke_latency_ms).toBeNull()
  })

  test('voice fields sent only with opt-in', () => {
    const voice = { voice_latency_ms: 420, vocal_pace_hz: 3.1 }
    const off = new TrialRecorder(ctx, clock().now)
    off.start(0)
    const e1 = off.finish({ correct: true, voice })
    expect(e1.voice_opt_in).toBe(false)
    expect(e1).not.toHaveProperty('voice_latency_ms')
    expect(e1).not.toHaveProperty('vocal_pace_hz')

    const on = new TrialRecorder({ ...ctx, voice_opt_in: true }, clock().now)
    on.start(0)
    expect(on.finish({ correct: true, voice })).toMatchObject({ voice_opt_in: true, ...voice })
  })
})

function setVisibility(v: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

// A complete event, as the server accepts it; push and restore only keep events of this shape.
function full(i: number): TelemetryEvent {
  return {
    user_id: 'u1',
    session_id: 's1',
    task_id: 't1',
    trial_index: i,
    dimension: 'working_memory',
    score_norm: 1,
    response_time_ms: 500,
    error_flag: false,
    error_burst: 0,
    hesitation_jitter: 0,
    keystroke_latency_ms: null,
    trial_meta: { item_id: `t1:${i}` },
    voice_opt_in: false,
    client_ts: '2026-10-30T00:00:00.000Z',
  }
}

const stored = (events: unknown) => ({ [KEY]: JSON.stringify(events) })

// jsdom's Blob has no text(); FileReader reads it, and needs real timers to fire onload.
function readBlob(b: Blob): Promise<string> {
  vi.useRealTimers()
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.readAsText(b)
  })
}

// The server's reply to a batch it stored: 202 with {"accepted": <batch length>}.
function accept(init?: RequestInit): Response {
  const n = (JSON.parse(String(init?.body)) as unknown[]).length
  return new Response(JSON.stringify({ accepted: n }), { status: 202 })
}

function okFetch() {
  return vi.fn(async (_url: string, init?: RequestInit) => accept(init))
}

function sent(fetchFn: ReturnType<typeof okFetch>, call = 0): number[] {
  const body = JSON.parse(String(fetchFn.mock.calls[call]?.[1]?.body)) as TelemetryEvent[]
  return body.map((e) => e.trial_index)
}

const KEY = 'synapsetwin_telemetry_queue_v2'
const CONSENT_KEY = 'synapsetwin_consent_v1'

// In-memory stand-in for localStorage, so no test touches the real one. It starts as a returning
// user who already accepted, so the sending tests keep their meaning; pass consent null for a new user.
function memStorage(init: Record<string, string> = {}, consent: string | null = 'granted') {
  const m = new Map(Object.entries(consent === null ? init : { [CONSENT_KEY]: consent, ...init }))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

function offlineFetch() {
  return vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => {
    throw new Error('offline')
  })
}

describe('Tracker', () => {
  let trackers: Tracker[] = []
  const make = (opts: ConstructorParameters<typeof Tracker>[0]) => {
    const t = new Tracker({ storage: memStorage(), ...opts })
    trackers.push(t)
    return t
  }
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    trackers.forEach((t) => t.destroy())
    trackers = []
    Reflect.deleteProperty(document, 'visibilityState') // back to jsdom's own getter
    vi.useRealTimers()
  })

  test('push flushes at batchSize', async () => {
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon: vi.fn() })
    for (let i = 0; i < 19; i++) t.push(full(i))
    expect(fetchFn).not.toHaveBeenCalled()
    t.push(full(19))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe('/v1/telemetry/event')
    expect(init?.method).toBe('POST')
    expect(sent(fetchFn)).toHaveLength(20)
  })

  test('flushes on the interval', async () => {
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(full(1))
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent(fetchFn)).toEqual([1])
  })

  describe('push-time validation (mirrors telemetry.py, so one bad event cannot 422 a batch)', () => {
    const bad: [string, Partial<Record<keyof TelemetryEvent, unknown>>][] = [
      ['negative response time', { response_time_ms: -1 }],
      ['response time over 600000', { response_time_ms: 600_001 }],
      ['NaN response time', { response_time_ms: Number.NaN }],
      ['score above 1', { score_norm: 1.01 }],
      ['score below 0', { score_norm: -0.01 }],
      ['infinite jitter', { hesitation_jitter: Number.POSITIVE_INFINITY }],
      ['negative jitter', { hesitation_jitter: -1 }],
      ['negative keystroke latency', { keystroke_latency_ms: -1 }],
      ['fractional trial index', { trial_index: 1.5 }],
      ['negative trial index', { trial_index: -1 }],
      ['negative error burst', { error_burst: -1 }],
      ['task_id over 48 chars', { task_id: 't'.repeat(49) }],
      ['empty task_id', { task_id: '' }],
      ['user_id with a space', { user_id: 'a b' }],
      ['session_id over 64 chars', { session_id: 's'.repeat(65) }],
      ['meta key with capitals', { trial_meta: { Item: 1 } }],
      ['meta key over 32 chars', { trial_meta: { ['k'.repeat(33)]: 1 } }],
      ['meta string over 64 chars', { trial_meta: { item_id: 'x'.repeat(65) } }],
      ['17 meta keys', { trial_meta: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, i])) }],
      ['voice field without opt-in', { voice_latency_ms: 300 }],
      ['negative voice latency', { voice_opt_in: true, voice_latency_ms: -1 }],
      ['unparseable client_ts', { client_ts: 'yesterday' }],
    ]

    test.each(bad)('drops only the bad event (%s), logs and counts it', async (_name, over) => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn() })
      const listener = vi.fn()
      t.onEvent(listener)
      t.push(full(1))
      t.push({ ...full(2), ...over } as TelemetryEvent)
      t.push(full(3))
      expect(errSpy).toHaveBeenCalledTimes(1)
      expect(String(errSpy.mock.calls[0]?.[0])).toMatch(/telemetry: dropped an invalid event/)
      expect(t.getStatus()).toMatchObject({ queuedCount: 2, droppedCount: 1 })
      expect(listener).toHaveBeenCalledTimes(2)
      await t.flush()
      expect(sent(fetchFn)).toEqual([1, 3])
      errSpy.mockRestore()
    })

    test('accepts the bounds themselves and voice fields with opt-in', () => {
      const t = make({ fetchFn: okFetch(), beacon: vi.fn() })
      t.push({ ...full(1), response_time_ms: 0, score_norm: 0 })
      t.push({ ...full(2), response_time_ms: 600_000, score_norm: 1, task_id: 't'.repeat(48) })
      t.push({ ...full(3), voice_opt_in: true, voice_latency_ms: 300, vocal_pace_hz: 2.5 })
      t.push({
        ...full(4),
        trial_meta: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`k${i}`, 'x'.repeat(64)])),
      })
      expect(t.getStatus()).toMatchObject({ queuedCount: 4, droppedCount: 0 })
    })

    test('restore drops, logs and counts a stored event that breaks a server rule', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const storage = memStorage(stored([full(1), { ...full(2), score_norm: 2 }]))
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
      expect(t.getStatus()).toMatchObject({ queuedCount: 1, droppedCount: 1 })
      expect(errSpy).toHaveBeenCalledTimes(1)
      errSpy.mockRestore()
    })
  })

  describe('retry backoff', () => {
    afterEach(() => vi.restoreAllMocks())

    test('failed flushes back off from 2 s, doubling to a 60 s cap; a success resets it', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0) // no jitter
      const fetchFn = offlineFetch()
      const t = make({ fetchFn, beacon: vi.fn() })
      t.push(full(1))
      // Each delay is waited out exactly: one ms less sends nothing new.
      let calls = 0
      for (const delay of [2000, 4000, 8000, 16000, 32000, 60000, 60000]) {
        await vi.advanceTimersByTimeAsync(delay - 1)
        expect(fetchFn).toHaveBeenCalledTimes(calls)
        await vi.advanceTimersByTimeAsync(1)
        expect(fetchFn).toHaveBeenCalledTimes(++calls)
      }
      fetchFn.mockImplementation(okFetch())
      await vi.advanceTimersByTimeAsync(60000)
      expect(fetchFn).toHaveBeenCalledTimes(++calls)
      expect(t.getStatus().queuedCount).toBe(0)
      t.push(full(2))
      await vi.advanceTimersByTimeAsync(2000)
      expect(fetchFn).toHaveBeenCalledTimes(++calls)
    })

    test('jitter shortens a retry delay by up to a fifth', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const fetchFn = offlineFetch()
      const t = make({ fetchFn, beacon: vi.fn() })
      t.push(full(1))
      await vi.advanceTimersByTimeAsync(2000)
      expect(fetchFn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(3599) // 4000 × (1 − 0.2 × 0.5) = 3600
      expect(fetchFn).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    test('going online flushes at once and resets the backoff', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const fetchFn = offlineFetch()
      const t = make({ fetchFn, beacon: vi.fn() })
      t.push(full(1))
      await vi.advanceTimersByTimeAsync(2000 + 4000 + 8000 + 16000 + 32000)
      expect(fetchFn).toHaveBeenCalledTimes(5) // next try would be in 60 s
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchFn).toHaveBeenCalledTimes(6)
      await vi.advanceTimersByTimeAsync(4000) // one failure since the reset
      expect(fetchFn).toHaveBeenCalledTimes(7)
    })

    test('while backing off, reaching batchSize sends no extra request', async () => {
      const fetchFn = offlineFetch()
      const t = make({ fetchFn, beacon: vi.fn() })
      for (let i = 0; i < 20; i++) t.push(full(i))
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchFn).toHaveBeenCalledTimes(1)
      for (let i = 20; i < 30; i++) t.push(full(i))
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })
  })

  test('failed flush keeps events for retry', async () => {
    const fetchFn = vi
      .fn(async (_url: string, init?: RequestInit) => accept(init))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(full(1))
    await t.flush()
    t.push(full(2))
    await t.flush()
    await t.flush()
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(sent(fetchFn, 2)).toEqual([1, 2])
    await t.flush()
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  test('rejected batch (422) is dropped and logged, later events still sent', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi
      .fn(async (_url: string, init?: RequestInit) => accept(init))
      .mockResolvedValueOnce(new Response(null, { status: 422 }))
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(full(1))
    t.push(full(2))
    await t.flush()
    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(String(errSpy.mock.calls[0]?.[0])).toMatch(/2 events.*422/)
    t.push(full(3))
    await t.flush()
    expect(sent(fetchFn, 1)).toEqual([3])
    errSpy.mockRestore()
  })

  // A static host or SPA fallback answers 200 with index.html: that is no acknowledgement.
  test('a 2xx without the matching accepted count keeps the batch for retry', async () => {
    const replies = [
      new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
      new Response('{"accepted":1}', { status: 202 }),
      new Response('{}', { status: 200 }),
    ]
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => replies.shift() ?? accept(init))
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(full(1))
    t.push(full(2))
    for (let i = 0; i < 3; i++) {
      await t.flush()
      expect(t.getStatus()).toMatchObject({ queuedCount: 2, droppedCount: 0 })
    }
    await t.flush()
    expect(sent(fetchFn, 3)).toEqual([1, 2])
    expect(t.getStatus().queuedCount).toBe(0)
  })

  test('408 and 429 are retried', async () => {
    const fetchFn = vi
      .fn(async (_url: string, init?: RequestInit) => accept(init))
      .mockResolvedValueOnce(new Response(null, { status: 408 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(full(1))
    await t.flush()
    await t.flush()
    await t.flush()
    expect(sent(fetchFn, 2)).toEqual([1])
  })

  test('buffer caps at maxBuffer dropping oldest', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => {
      throw new Error('offline')
    })
    const t = make({ fetchFn, beacon: vi.fn(), maxBuffer: 3, batchSize: 100 })
    for (let i = 1; i <= 5; i++) t.push(full(i))
    await t.flush()
    expect(sent(fetchFn)).toEqual([3, 4, 5])
  })

  test('sends at most 100 events per request', async () => {
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon: vi.fn(), batchSize: 1000 })
    for (let i = 0; i < 150; i++) t.push(full(i))
    await t.flush()
    expect(sent(fetchFn)).toHaveLength(100)
    await t.flush()
    expect(sent(fetchFn, 1)).toEqual(Array.from({ length: 50 }, (_, i) => 100 + i))
  })

  test('no second POST while one is in flight', async () => {
    let resolve!: (r: Response) => void
    const fetchFn = vi.fn(
      (_url: string, _init?: RequestInit) => new Promise<Response>((r) => (resolve = r)),
    )
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(full(1))
    const p = t.flush()
    await t.flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    resolve(new Response('{"accepted":1}', { status: 202 }))
    await p
    await t.flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('pagehide sends beacon', async () => {
    const beacon = vi.fn((_url: string, _data: Blob) => true)
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon })
    t.push(full(1))
    t.push(full(2))
    window.dispatchEvent(new Event('pagehide'))
    expect(beacon).toHaveBeenCalledTimes(1)
    const [url, blob] = beacon.mock.calls[0] ?? []
    expect(url).toBe('/v1/telemetry/event')
    expect(blob?.type).toBe('application/json')
    const body = JSON.parse(blob ? await readBlob(blob) : '[]') as TelemetryEvent[]
    expect(body.map((e) => e.trial_index)).toEqual([1, 2])
    await t.flush()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('page becoming hidden sends a beacon; becoming visible does not', () => {
    const beacon = vi.fn((_url: string, _data: Blob) => true)
    const t = make({ fetchFn: okFetch(), beacon })
    t.push(full(1))
    setVisibility('visible')
    expect(beacon).not.toHaveBeenCalled()
    setVisibility('hidden')
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  // sendBeacon returns true when it queues, not when it delivers, and browsers do not check
  // connectivity: offline, a beacon would wipe the buffer and its storage copy for nothing.
  test('offline, hidden and pagehide send no beacon and keep buffer and storage', async () => {
    const beacon = vi.fn((_url: string, _data: Blob) => true)
    const storage = memStorage()
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon, storage })
    t.push(full(1))
    window.dispatchEvent(new Event('offline'))
    setVisibility('hidden')
    window.dispatchEvent(new Event('pagehide'))
    expect(beacon).not.toHaveBeenCalled()
    expect(t.getStatus().queuedCount).toBe(1)
    expect(JSON.parse(storage.getItem(KEY) ?? '[]')).toHaveLength(1)
  })

  test('refused beacon keeps events', async () => {
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon: () => false })
    t.push(full(1))
    t.flushBeacon()
    await t.flush()
    expect(sent(fetchFn)).toEqual([1])
  })

  test('destroy stops the interval, pagehide and visibilitychange listeners', async () => {
    const beacon = vi.fn(() => true)
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon })
    t.destroy()
    t.push(full(1))
    await vi.advanceTimersByTimeAsync(5000)
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('hidden')
    expect(fetchFn).not.toHaveBeenCalled()
    expect(beacon).not.toHaveBeenCalled()
  })

  describe('persistence', () => {
    test('pending events survive into a new tracker and are sent from there', async () => {
      const storage = memStorage()
      const a = make({ fetchFn: offlineFetch(), beacon: vi.fn(), storage })
      a.push(full(1))
      a.push(full(2))
      await a.flush()
      a.destroy()
      const fetchFn = okFetch()
      const b = make({ fetchFn, beacon: vi.fn(), storage })
      expect(b.getStatus().queuedCount).toBe(2)
      await b.flush()
      expect(sent(fetchFn)).toEqual([1, 2])
      expect(b.getStatus().queuedCount).toBe(0)
      expect(storage.getItem(KEY)).toBeNull()
    })

    test('a throwing storage never crashes the tracker', async () => {
      const boom = () => {
        throw new Error('blocked')
      }
      const storage = { getItem: boom, setItem: boom, removeItem: boom }
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn(), storage })
      expect(t.getStatus().consent).toBe('pending') // unreadable storage: nobody has accepted yet
      t.grantConsent() // the choice still holds in memory for this page's life
      t.push(full(1))
      await t.flush()
      t.push(full(2))
      expect(t.clear()).toBe(1)
      expect(sent(fetchFn)).toEqual([1])
    })

    test('restore keeps only well-formed events', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const valid = full(7)
      const fetchFn = okFetch()
      const t = make({
        fetchFn,
        beacon: vi.fn(),
        storage: memStorage(stored([valid, { foo: 1 }, 5, null, 'x', { ...full(8), extra: 1 }])),
      })
      expect(t.getStatus()).toMatchObject({ queuedCount: 1, droppedCount: 5 })
      expect(errSpy).toHaveBeenCalledTimes(5)
      await t.flush()
      expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body))).toEqual([valid])
      errSpy.mockRestore()
    })

    test('restore drops events whose trial_meta values are not string, number or boolean', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const ok = { ...full(1), trial_meta: { item_id: 't1:1', n: 2, flag: true } }
      const bad = [{ nested: { a: 1 } }, { list: [1] }, { nothing: null }].map((trial_meta, i) => ({
        ...full(2 + i),
        trial_meta,
      }))
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage: memStorage(stored([ok, ...bad])) })
      expect(t.getStatus()).toMatchObject({ queuedCount: 1, droppedCount: 3 })
      errSpy.mockRestore()
    })

    test('events built by TrialRecorder survive the restore check', () => {
      const r = new TrialRecorder(ctx, clock().now)
      r.start(0)
      r.input('key')
      const e = r.finish({ correct: true, meta: { congruent: false } })
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage: memStorage(stored([e])) })
      expect(t.getStatus().queuedCount).toBe(1)
    })

    test('a non-JSON or non-array stored value restores nothing', () => {
      for (const raw of ['{not json', '{"a":1}', '42', 'null']) {
        const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage: memStorage({ [KEY]: raw }) })
        expect(t.getStatus().queuedCount).toBe(0)
      }
    })

    test('restore past maxBuffer keeps the newest 500, counts the rest, and sends at most 100', async () => {
      const fetchFn = okFetch()
      const events = Array.from({ length: 520 }, (_, i) => full(i))
      const t = make({ fetchFn, beacon: vi.fn(), storage: memStorage(stored(events)) })
      expect(t.getStatus()).toMatchObject({ queuedCount: 500, droppedCount: 20 })
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchFn).toHaveBeenCalledTimes(1)
      expect(sent(fetchFn)).toEqual(Array.from({ length: 100 }, (_, i) => 20 + i))
    })

    test('restoring batchSize events flushes on construction', async () => {
      const fetchFn = okFetch()
      const events = Array.from({ length: 20 }, (_, i) => full(i))
      make({ fetchFn, beacon: vi.fn(), storage: memStorage(stored(events)) })
      await vi.advanceTimersByTimeAsync(0)
      expect(sent(fetchFn)).toHaveLength(20)
    })

    test('when storage is full, the stale copy is removed instead of kept', () => {
      const storage = memStorage()
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
      t.push(full(1))
      expect(storage.getItem(KEY)).not.toBeNull()
      storage.setItem = () => {
        throw new Error('QuotaExceededError')
      }
      t.push(full(2))
      expect(storage.getItem(KEY)).toBeNull()
      expect(t.getStatus().queuedCount).toBe(2)
    })

    test('the old queue key is removed on init and never resent', () => {
      const storage = memStorage({ synapsetwin_telemetry_queue: JSON.stringify([{ event_id: 'old' }]) })
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
      expect(storage.getItem('synapsetwin_telemetry_queue')).toBeNull()
      expect(t.getStatus().queuedCount).toBe(0)
    })
  })

  describe('subscribe, getStatus and clear', () => {
    test('dropTask removes only that task\'s unsent events, here and in storage, and is never sent', async () => {
      const storage = memStorage({}, null) // pending: everything is held
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn(), storage })
      const listener = vi.fn()
      t.subscribe(listener)
      t.push({ ...full(1), task_id: 'paused' })
      t.push(full(2))
      t.push({ ...full(3), task_id: 'paused' })
      expect(t.dropTask('paused')).toBe(2)
      expect(listener).toHaveBeenCalledTimes(4)
      expect(t.getStatus().queuedCount).toBe(1)
      expect((JSON.parse(storage.getItem(KEY)!) as TelemetryEvent[]).map((e) => e.task_id)).toEqual(['t1'])
      expect(t.dropTask('unknown')).toBe(0)
      expect(listener).toHaveBeenCalledTimes(4) // nothing changed, nobody told
      t.grantConsent()
      await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
      expect(sent(fetchFn)).toEqual([2])
    })

    test('listeners hear push and clear; clear empties buffer and storage', () => {
      const storage = memStorage()
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
      const listener = vi.fn()
      const unsubscribe = t.subscribe(listener)
      t.push(full(1))
      t.push(full(2))
      expect(listener).toHaveBeenCalledTimes(2)
      expect(storage.getItem(KEY)).not.toBeNull()
      expect(t.clear()).toBe(2)
      expect(listener).toHaveBeenCalledTimes(3)
      expect(t.getStatus()).toEqual({
        isOnline: true,
        queuedCount: 0,
        droppedCount: 0,
        maxCapacity: 500,
        consent: 'granted',
      })
      expect(storage.getItem(KEY)).toBeNull()
      unsubscribe()
      t.push(full(3))
      expect(listener).toHaveBeenCalledTimes(3)
    })

    test('listeners hear the flush result', async () => {
      const t = make({ fetchFn: okFetch(), beacon: vi.fn() })
      t.push(full(1))
      const listener = vi.fn()
      t.subscribe(listener)
      await t.flush()
      expect(listener).toHaveBeenCalledTimes(1)
      expect(t.getStatus().queuedCount).toBe(0)
    })

    test('droppedCount counts overflow and rejected batches; clear resets it', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 422 }))
      const t = make({ fetchFn, beacon: vi.fn(), maxBuffer: 3, batchSize: 100 })
      for (let i = 1; i <= 5; i++) t.push(full(i))
      expect(t.getStatus()).toMatchObject({ queuedCount: 3, droppedCount: 2, maxCapacity: 3 })
      await t.flush()
      expect(t.getStatus()).toMatchObject({ queuedCount: 0, droppedCount: 5 })
      t.clear()
      expect(t.getStatus().droppedCount).toBe(0)
      vi.mocked(console.error).mockRestore()
    })

    test('clear during an in-flight rejected flush leaves droppedCount at 0', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      let resolve!: (r: Response) => void
      const fetchFn = vi.fn(
        (_url: string, _init?: RequestInit) => new Promise<Response>((r) => (resolve = r)),
      )
      const t = make({ fetchFn, beacon: vi.fn() })
      t.push(full(1))
      t.push(full(2))
      const p = t.flush()
      expect(t.clear()).toBe(2)
      t.push(full(3))
      resolve(new Response(null, { status: 422 }))
      await p
      expect(t.getStatus()).toMatchObject({ queuedCount: 1, droppedCount: 0 })
      vi.mocked(console.error).mockRestore()
    })

    test('a throwing listener is logged and breaks neither push nor flush', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn() })
      const boom = () => {
        throw new Error('listener')
      }
      t.subscribe(boom)
      t.onEvent(boom)
      const after = vi.fn()
      t.subscribe(after)
      expect(() => t.push(full(1))).not.toThrow()
      expect(after).toHaveBeenCalledTimes(1)
      expect(t.getStatus().queuedCount).toBe(1)
      await t.flush()
      expect(t.getStatus().queuedCount).toBe(0)
      expect(after).toHaveBeenCalledTimes(2)
      expect(errSpy).toHaveBeenCalledTimes(3) // subscriber + onEvent on push, subscriber on flush
      errSpy.mockRestore()
    })

    test('getStatus returns the same object until something changes', () => {
      const t = make({ fetchFn: okFetch(), beacon: vi.fn() })
      const s = t.getStatus()
      expect(t.getStatus()).toBe(s)
      t.push(full(1))
      expect(t.getStatus()).not.toBe(s)
    })
  })

  describe('online and offline', () => {
    test('offline clears isOnline; online sets it and flushes', async () => {
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn() })
      const listener = vi.fn()
      t.subscribe(listener)
      window.dispatchEvent(new Event('offline'))
      expect(t.getStatus().isOnline).toBe(false)
      expect(listener).toHaveBeenCalledTimes(1)
      t.push(full(1))
      window.dispatchEvent(new Event('online'))
      expect(t.getStatus().isOnline).toBe(true)
      await vi.advanceTimersByTimeAsync(0)
      expect(sent(fetchFn)).toEqual([1])
    })

    test('destroy removes the online and offline listeners', () => {
      const t = make({ fetchFn: okFetch(), beacon: vi.fn() })
      t.destroy()
      window.dispatchEvent(new Event('offline'))
      expect(t.getStatus().isOnline).toBe(true)
    })
  })

  describe('consent gate (R3: nothing leaves the device until the user accepts)', () => {
    // Every send path: batch size, interval, online, pagehide, hidden, and the public flush calls.
    async function trySendEverything(t: Tracker) {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      window.dispatchEvent(new Event('online'))
      window.dispatchEvent(new Event('pagehide'))
      setVisibility('hidden')
      t.flushBeacon()
      await t.flush()
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    }

    test('a new user starts pending: events are kept and persisted, nothing is sent', async () => {
      const storage = memStorage({}, null)
      const fetchFn = okFetch()
      const beacon = vi.fn((_url: string, _data: Blob) => true)
      const t = make({ fetchFn, beacon, storage })
      expect(t.getStatus().consent).toBe('pending')
      for (let i = 0; i < 25; i++) t.push(full(i)) // past batchSize
      await trySendEverything(t)
      expect(fetchFn).not.toHaveBeenCalled()
      expect(beacon).not.toHaveBeenCalled()
      expect(t.getStatus().queuedCount).toBe(25)
      t.destroy()
      const reloaded = make({ fetchFn, beacon, storage })
      expect(reloaded.getStatus()).toMatchObject({ consent: 'pending', queuedCount: 25 })
      await trySendEverything(reloaded)
      expect(fetchFn).not.toHaveBeenCalled()
    })

    test('an unknown stored consent value counts as pending', async () => {
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn(), storage: memStorage({}, 'yes') })
      expect(t.getStatus().consent).toBe('pending')
      t.push(full(1))
      await vi.advanceTimersByTimeAsync(5000)
      expect(fetchFn).not.toHaveBeenCalled()
    })

    test('grantConsent persists, notifies and sends the held events in batches of at most 100', async () => {
      const storage = memStorage(stored(Array.from({ length: 250 }, (_, i) => full(i))), null)
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn(), storage })
      const listener = vi.fn()
      t.subscribe(listener)
      t.grantConsent()
      expect(t.getStatus().consent).toBe('granted')
      expect(storage.getItem(CONSENT_KEY)).toBe('granted')
      expect(listener).toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchFn).toHaveBeenCalledTimes(1) // immediately, not on the next tick of the timer
      await vi.advanceTimersByTimeAsync(10_000)
      const batches = fetchFn.mock.calls.map((_, i) => sent(fetchFn, i))
      expect(batches.every((b) => b.length <= 100)).toBe(true)
      expect(batches.flat()).toEqual(Array.from({ length: 250 }, (_, i) => i))
      expect(t.getStatus().queuedCount).toBe(0)
      expect(storage.getItem(KEY)).toBeNull()
    })

    test('denyConsent clears buffer and storage; later pushes are dropped, counted, and still shown', async () => {
      const storage = memStorage({}, null)
      const fetchFn = okFetch()
      const beacon = vi.fn((_url: string, _data: Blob) => true)
      const t = make({ fetchFn, beacon, storage })
      t.push(full(1))
      t.push(full(2))
      t.denyConsent()
      expect(t.getStatus()).toMatchObject({ consent: 'denied', queuedCount: 0, droppedCount: 0 })
      expect(storage.getItem(KEY)).toBeNull()
      expect(storage.getItem(CONSENT_KEY)).toBe('denied')
      const seen = vi.fn() // results stay on the device: on-screen listeners still get the event
      t.onEvent(seen)
      t.push(full(3))
      expect(seen).toHaveBeenCalledOnce()
      expect(t.getStatus()).toMatchObject({ queuedCount: 0, droppedCount: 1 })
      expect(storage.getItem(KEY)).toBeNull()
      await trySendEverything(t)
      expect(fetchFn).not.toHaveBeenCalled()
      expect(beacon).not.toHaveBeenCalled()
      t.destroy()
      expect(make({ fetchFn, beacon, storage }).getStatus().consent).toBe('denied')
    })

    test('denied ignores a stale stored queue instead of restoring it', () => {
      const storage = memStorage(stored([full(1)]), 'denied')
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
      expect(t.getStatus().queuedCount).toBe(0)
      expect(storage.getItem(KEY)).toBeNull()
    })

    test('a returning user who granted sends restored and new events, by fetch and by beacon', async () => {
      const storage = memStorage(stored([full(1)]))
      const fetchFn = okFetch()
      const beacon = vi.fn((_url: string, _data: Blob) => true)
      const t = make({ fetchFn, beacon, storage })
      expect(t.getStatus().consent).toBe('granted')
      await vi.advanceTimersByTimeAsync(2000)
      expect(sent(fetchFn)).toEqual([1])
      t.push(full(2))
      window.dispatchEvent(new Event('pagehide'))
      expect(beacon).toHaveBeenCalledOnce()
    })

    // Declined or purged in tab B: tab A, already running exercises while granted, must stop too.
    describe('another tab changes the choice', () => {
      const otherTab = (storage: ReturnType<typeof memStorage>, value: string | null) => {
        if (value === null) storage.removeItem(CONSENT_KEY)
        else storage.setItem(CONSENT_KEY, value)
        window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY, newValue: value }))
      }

      test('granted → denied: the buffer is cleared and nothing more is sent by any path', async () => {
        const storage = memStorage()
        const fetchFn = okFetch()
        const beacon = vi.fn((_url: string, _data: Blob) => true)
        const t = make({ fetchFn, beacon, storage })
        t.push(full(1))
        otherTab(storage, 'denied')
        expect(t.getStatus()).toMatchObject({ consent: 'denied', queuedCount: 0 })
        expect(storage.getItem(KEY)).toBeNull()
        for (let i = 2; i < 30; i++) t.push(full(i))
        await trySendEverything(t)
        expect(fetchFn).not.toHaveBeenCalled()
        expect(beacon).not.toHaveBeenCalled()
        expect(storage.getItem(KEY)).toBeNull()
      })

      test('granted → removed (a purge): pending, the buffer is cleared, nothing is sent', async () => {
        const storage = memStorage()
        const fetchFn = okFetch()
        const beacon = vi.fn((_url: string, _data: Blob) => true)
        const t = make({ fetchFn, beacon, storage })
        t.push(full(1))
        otherTab(storage, null)
        expect(t.getStatus()).toMatchObject({ consent: 'pending', queuedCount: 0 })
        t.push(full(2))
        await trySendEverything(t)
        expect(fetchFn).not.toHaveBeenCalled()
        expect(beacon).not.toHaveBeenCalled()
        expect(t.getStatus().queuedCount).toBe(1) // held again, as for any pending user
      })

      // key null: the other tab cleared all of storage.
      test.each([KEY, null])('a purge in another tab (key %s) while this one is pending drops what this tab held', (key) => {
        const storage = memStorage({}, null)
        const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
        t.push(full(1))
        storage.removeItem(KEY) // the other tab's clear(); the consent key was already absent
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }))
        expect(t.getStatus()).toMatchObject({ consent: 'pending', queuedCount: 0 })
        expect(storage.getItem(KEY)).toBeNull()
      })

      test('pending → granted: the held events are sent', async () => {
        const storage = memStorage({}, null)
        const fetchFn = okFetch()
        const t = make({ fetchFn, beacon: vi.fn(), storage })
        t.push(full(1))
        otherTab(storage, 'granted')
        await vi.advanceTimersByTimeAsync(0)
        expect(sent(fetchFn)).toEqual([1])
      })

      test('pending → granted: subscribers hear it and getStatus() is not stale', () => {
        const storage = memStorage({}, null)
        const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
        expect(t.getStatus().consent).toBe('pending') // caches the snapshot
        const heard = vi.fn()
        t.subscribe(heard)
        otherTab(storage, 'granted')
        expect(heard).toHaveBeenCalled()
        expect(t.getStatus().consent).toBe('granted')
      })

      test('other keys are ignored, and destroy removes the listener', () => {
        const storage = memStorage()
        const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
        t.push(full(1))
        window.dispatchEvent(new StorageEvent('storage', { key: 'something_else', newValue: 'x' }))
        expect(t.getStatus()).toMatchObject({ consent: 'granted', queuedCount: 1 })
        t.destroy()
        otherTab(storage, 'denied')
        expect(t.getStatus()).toMatchObject({ consent: 'granted', queuedCount: 1 })
      })
    })

    test.each(['denyConsent', 'resetConsent'] as const)(
      '%s during an in-flight flush: no later fetch or beacon',
      async (method) => {
        let resolve!: (r: Response) => void
        let body: string | undefined
        const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
          body = String(init?.body)
          return new Promise<Response>((r) => (resolve = r))
        })
        const beacon = vi.fn((_url: string, _data: Blob) => true)
        const t = make({ fetchFn, beacon })
        t.push(full(1))
        const p = t.flush()
        t[method]()
        t.push(full(2))
        resolve(new Response(JSON.stringify({ accepted: (JSON.parse(String(body)) as unknown[]).length }), { status: 202 }))
        await p
        await trySendEverything(t)
        expect(fetchFn).toHaveBeenCalledTimes(1)
        expect(beacon).not.toHaveBeenCalled()
      },
    )

    test('resetConsent goes back to pending, forgets the stored choice, and holds new events', async () => {
      const storage = memStorage()
      const fetchFn = okFetch()
      const t = make({ fetchFn, beacon: vi.fn(), storage })
      t.resetConsent()
      expect(t.getStatus().consent).toBe('pending')
      expect(storage.getItem(CONSENT_KEY)).toBeNull()
      t.push(full(1))
      await trySendEverything(t)
      expect(fetchFn).not.toHaveBeenCalled()
      expect(t.getStatus().queuedCount).toBe(1)
    })
  })

  test('onEvent receives each pushed event until unsubscribed', () => {
    const t = make({ fetchFn: okFetch(), beacon: vi.fn() })
    const seen: number[] = []
    const off = t.onEvent((e) => void seen.push(e.trial_index))
    t.push(full(1))
    t.push(full(2))
    off()
    t.push(full(3))
    expect(seen).toEqual([1, 2])
  })
})
