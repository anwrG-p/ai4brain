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

function ev(i: number): TelemetryEvent {
  return { trial_index: i } as TelemetryEvent
}

function okFetch() {
  return vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 202 }))
}

function sent(fetchFn: ReturnType<typeof okFetch>, call = 0): number[] {
  const body = JSON.parse(fetchFn.mock.calls[call][1]!.body as string) as TelemetryEvent[]
  return body.map((e) => e.trial_index)
}

describe('Tracker', () => {
  let trackers: Tracker[] = []
  const make = (opts: ConstructorParameters<typeof Tracker>[0]) => {
    const t = new Tracker(opts)
    trackers.push(t)
    return t
  }
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    trackers.forEach((t) => t.destroy())
    trackers = []
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
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/v1/telemetry/event')
    expect(init!.method).toBe('POST')
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
    expect(String(errSpy.mock.calls[0][0])).toMatch(/2 events.*422/)
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
    const [url, blob] = beacon.mock.calls[0]
    expect(url).toBe('/v1/telemetry/event')
    expect(blob.type).toBe('application/json')
    const body = JSON.parse(await blob.text()) as TelemetryEvent[]
    expect(body.map((e) => e.trial_index)).toEqual([1, 2])
    await t.flush()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('refused beacon keeps events', async () => {
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon: () => false })
    t.push(ev(1))
    t.flushBeacon()
    await t.flush()
    expect(sent(fetchFn)).toEqual([1])
  })

  test('destroy stops the interval and pagehide listener', async () => {
    const beacon = vi.fn(() => true)
    const fetchFn = okFetch()
    const t = make({ fetchFn, beacon })
    t.destroy()
    t.push(ev(1))
    await vi.advanceTimersByTimeAsync(5000)
    window.dispatchEvent(new Event('pagehide'))
    expect(fetchFn).not.toHaveBeenCalled()
    expect(beacon).not.toHaveBeenCalled()
  })
})
