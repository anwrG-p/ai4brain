import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrialRecorder, Tracker } from '../features/assessment/telemetry/tracker'
import type { TelemetryEvent } from '../features/assessment/telemetry/types'
import { coachContext, createCoachBrain, keywordCrisisGate } from '../features/loti/coachAdapter'
import type { LotiContext } from '../features/loti/types'
import { useEmilyStore } from '../state/useEmilyStore'

/* ADR 0002: Momo's mood guess never leaves the device. Telemetry events and the coach request
   carry no mood, whatever the mood store holds. */

const MOOD_WORDS = /mood|emotion|frustrat|fatigu|tired|hesitan|energized|calm_flow|focused|happy/i

afterEach(() => {
  useEmilyStore.getState().reset()
  vi.restoreAllMocks()
})

describe('the mood never leaves the device (ADR 0002)', () => {
  it('a telemetry event and the body sent to the server hold no mood, even with a strained guess', async () => {
    useEmilyStore.getState().setManualEmotion('frustrated')
    const rec = new TrialRecorder({ user_id: 'u', session_id: 's', task_id: 't', dimension: 'executive_function', voice_opt_in: false })
    rec.start(0)
    rec.input('down')
    const event = rec.finish({ correct: false })
    expect(Object.keys(event).sort()).toEqual(
      [
        'client_ts',
        'dimension',
        'error_burst',
        'error_flag',
        'hesitation_jitter',
        'keystroke_latency_ms',
        'response_time_ms',
        'score_norm',
        'session_id',
        'task_id',
        'trial_index',
        'trial_meta',
        'user_id',
        'voice_opt_in',
      ].sort(),
    )

    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const n = (JSON.parse(String(init?.body)) as unknown[]).length
      return new Response(JSON.stringify({ accepted: n }), { status: 200 })
    })
    const storage = new Map<string, string>([['synapsetwin_consent_v1', 'granted']])
    const tracker = new Tracker({
      fetchFn,
      beacon: vi.fn(),
      storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) },
    })
    tracker.push(event as TelemetryEvent)
    await tracker.flush()
    tracker.destroy()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(String(fetchFn.mock.calls[0]![1]!.body)).not.toMatch(MOOD_WORDS)
  })

  it('the coach transport never receives the mood', () => {
    const ctx: LotiContext = { now: new Date('2026-10-28T15:00:00'), hasGoalsThisYear: false, sessionsThisWeek: 1, mood: 'frustrated' }
    const transport = vi.fn(() => null)
    createCoachBrain({ enabled: true, crisisGate: keywordCrisisGate, transport, consented: () => true }).ask('hi', ctx)
    expect(transport).toHaveBeenCalledTimes(1)
    const sent = (transport.mock.calls[0] as unknown[])[1] as Record<string, unknown>
    expect(sent).not.toHaveProperty('mood')
    expect(JSON.stringify(sent)).not.toMatch(MOOD_WORDS)
    expect(coachContext(ctx)).toEqual({ now: ctx.now, hasGoalsThisYear: false, sessionsThisWeek: 1 })
    expect(ctx.mood).toBe('frustrated') // the caller's context is not changed
  })

  it('without the "Let Loti use AI to reply" choice, nothing reaches the coach', () => {
    const transport = vi.fn(() => null)
    const ctx: LotiContext = { now: new Date(), hasGoalsThisYear: false, sessionsThisWeek: 0 }
    createCoachBrain({ enabled: true, crisisGate: keywordCrisisGate, transport }).ask('hi', ctx)
    createCoachBrain({ enabled: true, crisisGate: keywordCrisisGate, transport, consented: () => false }).ask('hi', ctx)
    expect(transport).not.toHaveBeenCalled()
  })
})
