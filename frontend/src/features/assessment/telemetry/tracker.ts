import { hesitationJitter, nextErrorBurst } from './metrics'
import { isTelemetryEvent, type Dimension, type TelemetryEvent, type TrialMeta } from './types'

type TrialCtx = {
  user_id: string
  session_id: string
  task_id: string
  dimension: Dimension
  voice_opt_in: boolean
}

const MAX_RT_MS = 600_000 // server response_time_ms upper bound

type TrialResult = {
  correct: boolean
  score?: number
  windowMs?: number
  meta?: TrialMeta
  voice?: { voice_latency_ms: number | null; vocal_pace_hz: number | null }
}

// Builds one TelemetryEvent per trial from onset, input timestamps, and the committed response.
export class TrialRecorder {
  private ctx: TrialCtx
  private now: () => number
  private trial: { index: number; start: number; inputs: number[]; firstPress: number | null } | null =
    null
  private burst = 0

  constructor(ctx: TrialCtx, now = () => performance.now()) {
    this.ctx = ctx
    this.now = now
  }

  start(trialIndex: number): void {
    this.trial = { index: trialIndex, start: this.now(), inputs: [], firstPress: null }
  }

  // Every kind feeds hesitation jitter; only a key or pointer press sets keystroke latency.
  input(kind: 'key' | 'down' | 'move' = 'down'): void {
    const t = this.trial
    if (!t) return
    const now = this.now()
    t.inputs.push(now)
    if (kind !== 'move' && t.firstPress === null) t.firstPress = now
  }

  finish(r: TrialResult): TelemetryEvent {
    const t = this.trial
    if (!t) throw new Error('finish() without an active trial')
    this.trial = null
    this.burst = nextErrorBurst(this.burst, r.correct)
    const { voice_opt_in } = this.ctx
    return {
      user_id: this.ctx.user_id,
      session_id: this.ctx.session_id,
      task_id: this.ctx.task_id,
      trial_index: t.index,
      dimension: this.ctx.dimension,
      // Clamped to the server's bounds so one out-of-range value cannot get a whole batch rejected.
      score_norm: Math.min(1, Math.max(0, r.score ?? (r.correct ? 1 : 0))),
      response_time_ms: Math.min(MAX_RT_MS, r.windowMs ?? this.now() - t.start),
      error_flag: !r.correct,
      error_burst: this.burst,
      hesitation_jitter: hesitationJitter(t.inputs),
      keystroke_latency_ms: t.firstPress === null ? null : t.firstPress - t.start,
      trial_meta: { item_id: `${this.ctx.task_id}:${t.index}`, ...r.meta },
      voice_opt_in,
      // The server rejects voice fields without opt-in, so they are only attached when opted in.
      ...(voice_opt_in && r.voice ? r.voice : {}),
      client_ts: new Date().toISOString(),
    }
  }

  abort(): void {
    this.trial = null
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type TrackerOpts = {
  endpoint?: string
  flushMs?: number
  batchSize?: number
  maxBuffer?: number
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>
  beacon?: (url: string, data: Blob) => boolean
  storage?: StorageLike | null
}

export type TrackerStatus = {
  isOnline: boolean
  queuedCount: number
  droppedCount: number
  maxCapacity: number
}

const MAX_PER_REQUEST = 100 // server Batch max_length
// New key: events from the old UI queue have another shape and must never be resent.
const STORAGE_KEY = 'synapsetwin_telemetry_queue_v2'
const OLD_STORAGE_KEY = 'synapsetwin_telemetry_queue'

// Reading window.localStorage itself throws when site data is blocked.
function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// A throwing listener must not break push() (and so the trial loop) or a flush.
function safely(fn: () => void): void {
  try {
    fn()
  } catch (err) {
    console.error('telemetry: listener failed', err)
  }
}

// Buffers events and sends them in the background; push() never awaits the network.
// The buffer is mirrored to storage so pending events survive a reload.
export class Tracker {
  private endpoint: string
  private batchSize: number
  private maxBuffer: number
  private fetchFn: (url: string, init?: RequestInit) => Promise<Response>
  private beacon?: (url: string, data: Blob) => boolean
  private storage: StorageLike | null
  private buffer: TelemetryEvent[] = []
  private inFlight = false
  private isOnline = typeof navigator === 'undefined' ? true : navigator.onLine
  private droppedCount = 0
  private clears = 0 // bumped by clear(), so an in-flight flush knows its batch was purged
  private status: TrackerStatus | null = null
  private listeners = new Set<() => void>()
  private eventListeners = new Set<(e: TelemetryEvent) => void>()
  private timer: ReturnType<typeof setInterval>
  private onPageHide = () => this.flushBeacon()
  // Mobile browsers often discard a backgrounded tab without firing pagehide; hidden is the last reliable signal.
  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flushBeacon()
  }
  private onOnline = () => {
    this.isOnline = true
    this.notify()
    void this.flush()
  }
  private onOffline = () => {
    this.isOnline = false
    this.notify()
  }

  constructor(opts: TrackerOpts = {}) {
    this.endpoint = opts.endpoint ?? '/v1/telemetry/event'
    this.batchSize = opts.batchSize ?? 20
    this.maxBuffer = opts.maxBuffer ?? 500
    this.fetchFn = opts.fetchFn ?? ((url, init) => fetch(url, init))
    this.beacon =
      opts.beacon ??
      (typeof navigator !== 'undefined' && navigator.sendBeacon
        ? navigator.sendBeacon.bind(navigator)
        : undefined)
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage
    this.store((s) => s.removeItem(OLD_STORAGE_KEY))
    this.add(this.restore())
    this.timer = setInterval(() => void this.flush(), opts.flushMs ?? 2000)
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHide)
      window.addEventListener('online', this.onOnline)
      window.addEventListener('offline', this.onOffline)
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility)
  }

  push(e: TelemetryEvent): void {
    this.add([e])
    for (const l of this.eventListeners) safely(() => l(e))
  }

  // Every event, new or restored, enters here: cap, persist, notify, flush at batchSize.
  private add(events: TelemetryEvent[]): void {
    if (!events.length) return
    this.buffer.push(...events)
    const over = this.buffer.length - this.maxBuffer
    if (over > 0) {
      this.buffer.splice(0, over)
      this.droppedCount += over
    }
    this.changed()
    if (this.buffer.length >= this.batchSize) void this.flush()
  }

  async flush(): Promise<void> {
    if (this.inFlight || !this.buffer.length) return
    this.inFlight = true
    // Events stay in the buffer until acknowledged, so failures retry and overflow still drops the oldest.
    const batch = this.buffer.slice(0, MAX_PER_REQUEST)
    const clears = this.clears
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
      // A 4xx (other than 408/429) will never succeed: the server rejects the whole batch, so drop it
      // rather than block the queue head. 5xx, 408, 429 and network errors retry.
      const rejected =
        res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429
      // clear() ran meanwhile: the batch is already gone and must not count as dropped.
      if (clears !== this.clears) return
      if (rejected) {
        console.error(`telemetry: dropped ${batch.length} events (HTTP ${res.status})`)
        this.droppedCount += batch.length
      }
      if (res.ok || rejected) {
        const done = new Set(batch)
        this.buffer = this.buffer.filter((e) => !done.has(e))
        this.changed()
      }
    } catch {
      // offline: keep events for the next flush
    } finally {
      this.inFlight = false
    }
  }

  flushBeacon(): void {
    // ponytail: without sendBeacon we fall back to a normal flush, which may not survive page unload.
    if (!this.beacon) return void this.flush()
    const kept: TelemetryEvent[] = []
    for (let i = 0; i < this.buffer.length; i += MAX_PER_REQUEST) {
      const chunk = this.buffer.slice(i, i + MAX_PER_REQUEST)
      const blob = new Blob([JSON.stringify(chunk)], { type: 'application/json' })
      if (!this.beacon(this.endpoint, blob)) kept.push(...chunk)
    }
    this.buffer = kept
    this.changed()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  onEvent(listener: (e: TelemetryEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => void this.eventListeners.delete(listener)
  }

  // Same shape as the old UI queue's getStatus(). The object is reused until something changes,
  // so it is safe as a useSyncExternalStore snapshot.
  getStatus(): TrackerStatus {
    this.status ??= {
      isOnline: this.isOnline,
      queuedCount: this.buffer.length,
      droppedCount: this.droppedCount,
      maxCapacity: this.maxBuffer,
    }
    return this.status
  }

  // Privacy purge: drops every pending event here and in storage. Returns how many were dropped.
  clear(): number {
    const cleared = this.buffer.length
    this.buffer = []
    this.droppedCount = 0
    this.clears++
    this.changed()
    return cleared
  }

  destroy(): void {
    clearInterval(this.timer)
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide)
      window.removeEventListener('online', this.onOnline)
      window.removeEventListener('offline', this.onOffline)
    }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility)
  }

  // The buffer or counters changed: persist, then tell subscribers.
  private changed(): void {
    this.store((s) => {
      if (!this.buffer.length) return s.removeItem(STORAGE_KEY)
      try {
        s.setItem(STORAGE_KEY, JSON.stringify(this.buffer))
      } catch {
        // Quota full: drop the stale copy rather than resend already-sent events after a reload.
        s.removeItem(STORAGE_KEY)
      }
    })
    this.notify()
  }

  private notify(): void {
    this.status = null
    for (const l of this.listeners) safely(l)
  }

  private restore(): TelemetryEvent[] {
    const raw = this.store((s) => s.getItem(STORAGE_KEY))
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      // The server rejects a whole batch over one bad event, so anything malformed stays behind.
      return Array.isArray(parsed) ? parsed.filter(isTelemetryEvent) : []
    } catch {
      return []
    }
  }

  // Storage can be missing, full or blocked; telemetry must never crash the page over it.
  private store<T>(fn: (s: StorageLike) => T): T | undefined {
    if (!this.storage) return undefined
    try {
      return fn(this.storage)
    } catch {
      return undefined // the in-memory buffer still works
    }
  }
}

export const tracker = new Tracker()
