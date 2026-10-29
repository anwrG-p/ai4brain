/**
 * Minimal Real Telemetry Queue (SynapseTwin Robustness & Privacy)
 *
 * Requirements:
 * - In-memory array mirrored to one localStorage key inside try/catch.
 * - Capped at 500 events; oldest events are dropped with droppedCount tracked.
 * - Listens to browser 'online' and 'offline' events.
 * - Flushes in batches of 50 with exponential backoff (1s, 2s, 4s, 8s, max 30s) + jitter.
 * - Client-generated event_id on every event for idempotency.
 * - Cleared on purge / consent withdrawal.
 */

export interface QueuedTelemetryEvent {
  event_id: string
  session_id: string
  client_ts: number
  task_id: string
  dimension: string
  schema_type: string
  trial_index: number
  response_time_ms: number
  correct?: boolean
  trial_meta?: Record<string, unknown>
  retry_count: number
}

const STORAGE_KEY = 'synapsetwin_telemetry_queue'
const MAX_QUEUE_SIZE = 500
const BATCH_SIZE = 50

class TelemetryQueueManager {
  private queue: QueuedTelemetryEvent[] = []
  private droppedCount = 0
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private isFlushing = false
  private retryAttempt = 0
  private flushTimeout: ReturnType<typeof setTimeout> | null = null
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.loadFromStorage()
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          this.queue = parsed.slice(-MAX_QUEUE_SIZE)
        }
      }
    } catch {
      // LocalStorage access might be restricted in private browsing
      this.queue = []
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
    } catch {
      // Storage quota exceeded or disabled
    }
  }

  private handleOnline = () => {
    this.isOnline = true
    this.notify()
    this.scheduleFlush(500)
  }

  private handleOffline = () => {
    this.isOnline = false
    this.notify()
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener()
    }
  }

  public getStatus() {
    return {
      isOnline: this.isOnline,
      queuedCount: this.queue.length,
      droppedCount: this.droppedCount,
      maxCapacity: MAX_QUEUE_SIZE,
    }
  }

  public enqueue(
    event: Omit<QueuedTelemetryEvent, 'event_id' | 'retry_count'> & { event_id?: string },
  ) {
    const finalEvent: QueuedTelemetryEvent = {
      ...event,
      event_id: event.event_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`),
      retry_count: 0,
    }

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift()
      this.droppedCount += 1
    }

    this.queue.push(finalEvent)
    this.saveToStorage()
    this.notify()

    if (this.isOnline && !this.isFlushing) {
      this.scheduleFlush(100)
    }

    return { accepted: 0, queued: this.queue.length, dropped: this.droppedCount }
  }

  public scheduleFlush(delayMs = 1000) {
    if (this.flushTimeout) clearTimeout(this.flushTimeout)
    this.flushTimeout = setTimeout(() => {
      void this.flush()
    }, delayMs)
  }

  public async flush(): Promise<{ sent: number; remaining: number }> {
    if (this.isFlushing || this.queue.length === 0 || !this.isOnline) {
      return { sent: 0, remaining: this.queue.length }
    }

    this.isFlushing = true
    const batch = this.queue.slice(0, BATCH_SIZE)

    try {
      // Real telemetry endpoint call
      const response = await fetch('/v1/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
      })

      if (response.ok) {
        // Success: remove sent batch from queue
        this.queue.splice(0, batch.length)
        this.saveToStorage()
        this.retryAttempt = 0
        this.notify()

        if (this.queue.length > 0) {
          this.scheduleFlush(500)
        }
      } else {
        throw new Error(`Server returned ${response.status}`)
      }
    } catch {
      // Failure: exponential backoff with jitter
      this.retryAttempt += 1
      const backoffSec = Math.min(30, Math.pow(2, this.retryAttempt))
      const jitterMs = Math.random() * 1000
      const totalDelay = backoffSec * 1000 + jitterMs

      this.scheduleFlush(totalDelay)
    } finally {
      this.isFlushing = false
    }

    return { sent: BATCH_SIZE, remaining: this.queue.length }
  }

  public clear(): number {
    const cleared = this.queue.length
    this.queue = []
    this.droppedCount = 0
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignored
    }
    this.notify()
    return cleared
  }
}

export const telemetryQueue = new TelemetryQueueManager()
