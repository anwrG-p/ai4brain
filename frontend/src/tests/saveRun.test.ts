import { afterEach, describe, expect, it } from 'vitest'
import type { TelemetryEvent } from '../features/assessment/telemetry/types'
import { saveRun, useSessionStore } from '../features/insights/sessionStore'

// Matrix events: pattern_induction without relational's `hops` (taskScores.schemaOf).
const matrix = (task_id: string, i: number): TelemetryEvent => ({
  user_id: 'u',
  session_id: 's',
  task_id,
  trial_index: i,
  dimension: 'pattern_induction',
  score_norm: 1,
  response_time_ms: 900,
  error_flag: false,
  error_burst: 0,
  hesitation_jitter: 10,
  keystroke_latency_ms: 900,
  client_ts: '2026-10-31T10:00:00.000Z',
})

afterEach(() => useSessionStore.getState().clearSessions())

describe('saveRun (shared by the baseline and the task runner)', () => {
  it('scores only the events of the given task ids and adds one session', () => {
    expect(saveRun([matrix('run', 0), matrix('run', 1), matrix('discarded', 0)], ['run'])).toBe(true)
    const [session] = useSessionStore.getState().sessions
    expect(session?.inputs.FluidMatrices?.trials).toBe(2)
  })

  it('saves nothing when no event belongs to the run', () => {
    expect(saveRun([matrix('other', 0)], ['run'])).toBe(false)
    expect(saveRun([])).toBe(false)
    expect(useSessionStore.getState().sessions).toHaveLength(0)
  })
})
