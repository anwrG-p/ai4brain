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

function ev(i: number): TelemetryEvent {
  return { trial_index: i } as TelemetryEvent
}

// A complete event, as the server accepts it; restore only keeps events of this shape.
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

function okFetch() {
  return vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 202 }))
}

function sent(fetchFn: ReturnType<typeof okFetch>, call = 0): number[] {
  const body = JSON.parse(String(fetchFn.mock.calls[call]?.[1]?.body)) as TelemetryEvent[]
  return body.map((e) => e.trial_index)
}

const KEY = 'synapsetwin_telemetry_queue_v2'

// In-memory stand-in for localStorage, so no test touches the real one.
function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
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
    for (let i = 0; i < 19; i++) t.push(ev(i))
    expect(fetchFn).not.toHaveBeenCalled()
    t.push(ev(19))
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
    t.push(ev(1))
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent(fetchFn)).toEqual([1])
  })

  test('failed flush keeps events for retry', async () => {
    const fetchFn = vi
      .fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 202 }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(ev(1))
    await t.flush()
    t.push(ev(2))
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
      .fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 422 }))
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(ev(1))
    t.push(ev(2))
    await t.flush()
    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(String(errSpy.mock.calls[0]?.[0])).toMatch(/2 events.*422/)
    t.push(ev(3))
    await t.flush()
    expect(sent(fetchFn, 1)).toEqual([3])
    errSpy.mockRestore()
  })

  test('408 and 429 are retried', async () => {
    const fetchFn = vi
      .fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 408 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
    const t = make({ fetchFn, beacon: vi.fn() })
    t.push(ev(1))
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
    for (let i = 1; i <= 5; i++) t.push(ev(i))
    await t.flush()
    expect(sent(fetchFn)).toEqual([3, 4, 5])
  })

  test('sends at most 100 events per request', async () => {
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon: vi.fn(), batchSize: 1000 })
    for (let i = 0; i < 150; i++) t.push(ev(i))
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
    t.push(ev(1))
    const p = t.flush()
    await t.flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    resolve(new Response(null, { status: 202 }))
    await p
    await t.flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('pagehide sends beacon', async () => {
    const beacon = vi.fn((_url: string, _data: Blob) => true)
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon })
    t.push(ev(1))
    t.push(ev(2))
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
    t.push(ev(1))
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
    t.push(ev(1))
    t.flushBeacon()
    await t.flush()
    expect(sent(fetchFn)).toEqual([1])
  })

  test('destroy stops the interval, pagehide and visibilitychange listeners', async () => {
    const beacon = vi.fn(() => true)
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon })
    t.destroy()
    t.push(ev(1))
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
      t.push(ev(1))
      await t.flush()
      t.push(ev(2))
      expect(t.clear()).toBe(1)
      expect(sent(fetchFn)).toEqual([1])
    })

    test('restore keeps only well-formed events', async () => {
      const valid = full(7)
      const fetchFn = okFetch()
      const t = make({
        fetchFn,
        beacon: vi.fn(),
        storage: memStorage(stored([valid, { foo: 1 }, 5, null, 'x', { ...full(8), extra: 1 }])),
      })
      expect(t.getStatus().queuedCount).toBe(1)
      await t.flush()
      expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body))).toEqual([valid])
    })

    test('restore drops events whose trial_meta values are not string, number or boolean', () => {
      const ok = { ...full(1), trial_meta: { item_id: 't1:1', n: 2, flag: true } }
      const bad = [{ nested: { a: 1 } }, { list: [1] }, { nothing: null }].map((trial_meta, i) => ({
        ...full(2 + i),
        trial_meta,
      }))
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage: memStorage(stored([ok, ...bad])) })
      expect(t.getStatus().queuedCount).toBe(1)
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
    test('listeners hear push and clear; clear empties buffer and storage', () => {
      const storage = memStorage()
      const t = make({ fetchFn: okFetch(), beacon: vi.fn(), storage })
      const listener = vi.fn()
      const unsubscribe = t.subscribe(listener)
      t.push(ev(1))
      t.push(ev(2))
      expect(listener).toHaveBeenCalledTimes(2)
      expect(storage.getItem(KEY)).not.toBeNull()
      expect(t.clear()).toBe(2)
      expect(listener).toHaveBeenCalledTimes(3)
      expect(t.getStatus()).toEqual({ isOnline: true, queuedCount: 0, droppedCount: 0, maxCapacity: 500 })
      expect(storage.getItem(KEY)).toBeNull()
      unsubscribe()
      t.push(ev(3))
      expect(listener).toHaveBeenCalledTimes(3)
    })

    test('listeners hear the flush result', async () => {
      const t = make({ fetchFn: okFetch(), beacon: vi.fn() })
      t.push(ev(1))
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
      for (let i = 1; i <= 5; i++) t.push(ev(i))
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
      t.push(ev(1))
      t.push(ev(2))
      const p = t.flush()
      expect(t.clear()).toBe(2)
      t.push(ev(3))
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
      expect(() => t.push(ev(1))).not.toThrow()
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
      t.push(ev(1))
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
      t.push(ev(1))
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

  test('onEvent receives each pushed event until unsubscribed', () => {
    const t = make({ fetchFn: okFetch(), beacon: vi.fn() })
    const seen: number[] = []
    const off = t.onEvent((e) => void seen.push(e.trial_index))
    t.push(ev(1))
    t.push(ev(2))
    off()
    t.push(ev(3))
    expect(seen).toEqual([1, 2])
  })
})
