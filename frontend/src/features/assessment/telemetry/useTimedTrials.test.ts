import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from './tracker'
import type { TelemetryEvent } from './types'
import { pressProps, useTimedTrials } from './useTimedTrials'

const ctx = {
  user_id: 'u1',
  session_id: 's1',
  task_id: 't1',
  dimension: 'executive_function' as const,
  voice_opt_in: false,
}

let pushed: TelemetryEvent[]

beforeEach(() => {
  vi.useFakeTimers()
  pushed = []
  vi.spyOn(tracker, 'push').mockImplementation((e) => void pushed.push(e))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test('a response and a timeout each emit one event carrying the onFinish meta', () => {
  const recorder = new TrialRecorder(ctx)
  const onDone = vi.fn()
  const onFinish = (i: number, correct: boolean) => ({ first: i === 0, correct })
  const { result } = renderHook(() => useTimedTrials(recorder, 2, 1000, onDone, onFinish))

  act(() => result.current.respond(true, { picked: 'red' }))
  expect(pushed[0]).toMatchObject({
    trial_index: 0,
    error_flag: false,
    voice_opt_in: false,
    trial_meta: { item_id: 't1:0', first: true, correct: true, picked: 'red' },
  })
  expect(pushed[0]).not.toHaveProperty('voice_latency_ms')

  act(() => void vi.advanceTimersByTime(1000))
  expect(pushed[1]).toMatchObject({
    trial_index: 1,
    error_flag: true,
    response_time_ms: 1000,
    trial_meta: { item_id: 't1:1', first: false, correct: false },
  })
  expect(onDone).toHaveBeenCalledTimes(1)
  expect(pushed).toHaveLength(2)
})

test('pressProps answers on pointerdown or keyboard click, never on a pointer click or a held Enter', () => {
  const respond = vi.fn()
  const p = pressProps(respond)
  p.onClick({ detail: 1 })
  expect(respond).not.toHaveBeenCalled()
  p.onPointerDown()
  expect(respond).toHaveBeenCalledTimes(1)
  p.onKeyDown({ repeat: false, key: 'Enter' })
  p.onClick({ detail: 0 })
  expect(respond).toHaveBeenCalledTimes(2)
  p.onKeyDown({ repeat: true, key: 'Enter' })
  p.onClick({ detail: 0 })
  expect(respond).toHaveBeenCalledTimes(2)
  p.onClick({ detail: 0 })
  expect(respond).toHaveBeenCalledTimes(3)
})
