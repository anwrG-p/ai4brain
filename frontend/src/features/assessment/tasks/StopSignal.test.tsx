import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { StopSignalParams, TaskPayload, TelemetryEvent } from '../telemetry/types'
import fixtures from './fixtures.json'
import { nextSsd, SST_DESIGN, StopSignal } from './StopSignal'

const FIX = 500
const LIMIT = 1250
const go = (dir: 'left' | 'right' = 'left') => ({ dir, stop: false })
const stop = (dir: 'left' | 'right' = 'left') => ({ dir, stop: true })
const params = (trials: StopSignalParams['trials']): StopSignalParams => ({
  time_limit_ms: LIMIT,
  fixation_ms: FIX,
  ssd_start_ms: 250,
  ssd_step_ms: 50,
  trials,
})

let pushed: TelemetryEvent[]

beforeEach(() => {
  vi.useFakeTimers()
  pushed = []
  vi.spyOn(tracker, 'push').mockImplementation((e) => void pushed.push(e))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

function setup(p: StopSignalParams) {
  const recorder = new TrialRecorder({ user_id: 'u', session_id: 's', task_id: 't', dimension: 'executive_function', voice_opt_in: false })
  const onDone = vi.fn()
  const view = render(<StopSignal params={p} recorder={recorder} onDone={onDone} />)
  return { onDone, ...view }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
// The cross, then `ms` into the arrow. Two steps: the arrow's timers start in an effect after the
// cross ends, so one long advance would run past the onset.
const show = (ms: number) => {
  advance(FIX)
  advance(ms)
}
const key = (k: string, opts: Partial<KeyboardEventInit> = {}) => act(() => void fireEvent.keyDown(window, { key: k, ...opts }))
const tap = (name: 'Left' | 'Right') => act(() => void fireEvent.pointerDown(screen.getByRole('button', { name })))
const cross = () => screen.queryByRole('img', { name: 'Look at the cross' })
const sign = () => document.querySelector('[data-stop-sign]')
const setHidden = (h: boolean) =>
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
    document.dispatchEvent(new Event('visibilitychange'))
  })

describe('Stop Light fixture (research-backed design)', () => {
  const task = (fixtures as TaskPayload[]).find((t) => t.schema_type === 'stop_signal')!
  const p = task.params as StopSignalParams

  test('follows the consensus guide: 200 trials, 25% stops (>= 50), 50 ms SSD steps, 1250 ms go window', () => {
    expect(task.dimension).toBe('executive_function')
    expect(p.trials).toHaveLength(SST_DESIGN.trials)
    const stops = p.trials.filter((t) => t.stop).length
    expect(stops / p.trials.length).toBe(SST_DESIGN.stopShare)
    expect(stops).toBeGreaterThanOrEqual(SST_DESIGN.minStopTrials)
    expect(p.ssd_step_ms).toBe(SST_DESIGN.ssdStepMs)
    expect(p.time_limit_ms).toBe(SST_DESIGN.timeLimitMs)
    expect(p.ssd_start_ms).toBe(SST_DESIGN.ssdStartMs)
  })

  test('both arrows equally often, on go and on stop trials; it opens on go trials', () => {
    const count = (stopTrial: boolean, dir: string) => p.trials.filter((t) => t.stop === stopTrial && t.dir === dir).length
    expect(count(false, 'left')).toBe(count(false, 'right'))
    expect(count(true, 'left')).toBe(count(true, 'right'))
    expect(p.trials[0]!.stop).toBe(false)
    expect(p.trials[1]!.stop).toBe(false)
  })
})

describe('nextSsd (one-up/one-down staircase)', () => {
  test('a stop moves the sign one step later, a failed stop one step earlier', () => {
    expect(nextSsd(250, true, 50, 1200)).toBe(300)
    expect(nextSsd(250, false, 50, 1200)).toBe(200)
  })
  test('stays within [0, max]', () => {
    expect(nextSsd(20, false, 50, 1200)).toBe(0)
    expect(nextSsd(1180, true, 50, 1200)).toBe(1200)
  })
})

describe('Stop Light', () => {
  test('a cross for fixation_ms, then the arrow; a press during the cross is not an answer', () => {
    setup(params([go('left')]))
    expect(cross()).not.toBeNull()
    key('ArrowLeft')
    advance(FIX - 1)
    expect(cross()).not.toBeNull()
    expect(pushed).toHaveLength(0)
    advance(1)
    expect(cross()).toBeNull()
    expect(screen.getByRole('region', { name: 'Stop Light' })).toBeInTheDocument()
  })

  test('go trial: the arrow key that matches is right; RT from the arrow onset; trial_meta keys', () => {
    setup(params([go('left'), go('right')]))
    show(320)
    key('ArrowLeft')
    show(410)
    key('ArrowLeft') // wrong way
    expect(pushed).toHaveLength(2)
    expect(pushed[0]).toMatchObject({ trial_index: 0, error_flag: false, score_norm: 1, response_time_ms: 320 })
    expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', stop_trial: false, dir: 'left', response: 'left' })
    expect(pushed[1]).toMatchObject({ trial_index: 1, error_flag: true, response_time_ms: 410 })
    expect(pushed[1]!.trial_meta).toMatchObject({ dir: 'right', response: 'left' })
  })

  test('go trial with no press: an omission, response none, RT = the go window', () => {
    const { onDone } = setup(params([go('right')]))
    show(LIMIT)
    expect(pushed).toHaveLength(1)
    expect(pushed[0]).toMatchObject({ error_flag: true, response_time_ms: LIMIT, keystroke_latency_ms: null })
    expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', stop_trial: false, dir: 'right', response: 'none' })
    expect(onDone).toHaveBeenCalledOnce()
  })

  test('stop trial: the sign appears at the SSD (shape and word); no press is a stop and the next SSD is 50 ms later', () => {
    setup(params([stop('left'), stop('right')]))
    show(249)
    expect(sign()).toBeNull()
    expect(screen.getByText('Stop')).toHaveClass('invisible')
    advance(1)
    expect(sign()).not.toBeNull()
    expect(screen.getByText('Stop')).not.toHaveClass('invisible')
    advance(LIMIT - 250)
    expect(pushed[0]).toMatchObject({ error_flag: false, score_norm: 1, response_time_ms: LIMIT })
    expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', stop_trial: true, dir: 'left', response: 'none', ssd_ms: 250 })
    // Trial 2: the sign now comes at 300 ms.
    show(299)
    expect(sign()).toBeNull()
    advance(1)
    expect(sign()).not.toBeNull()
    advance(LIMIT - 300)
    expect(pushed[1]!.trial_meta).toMatchObject({ ssd_ms: 300, response: 'none' })
  })

  test('stop trial: a press (even the right way, even before the sign) is a failed stop; the next SSD is 50 ms earlier', () => {
    setup(params([stop('left'), stop('left'), go('left')]))
    show(400)
    key('ArrowLeft') // after the sign: signal-respond
    expect(pushed[0]).toMatchObject({ error_flag: true, response_time_ms: 400 })
    expect(pushed[0]!.trial_meta).toMatchObject({ stop_trial: true, response: 'left', ssd_ms: 250 })
    show(100)
    key('ArrowLeft') // before the sign (200 ms): still a failed stop
    expect(sign()).toBeNull()
    expect(pushed[1]).toMatchObject({ error_flag: true, response_time_ms: 100 })
    expect(pushed[1]!.trial_meta).toMatchObject({ ssd_ms: 200 })
    advance(5000)
    expect(sign()).toBeNull() // no sign on a go trial
  })

  test('tap targets answer like the keys (pointerdown); keyboard-activated buttons too', () => {
    setup(params([go('right'), go('left'), go('left')]))
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Left', 'Right'])
    for (const b of buttons) expect(b.className).toMatch(/min-h-14/) // >= 56 px tap targets
    show(200)
    tap('Right')
    show(200)
    tap('Left')
    show(200)
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Left' }), { detail: 0 }))
    expect(pushed.map((e) => [e.error_flag, e.trial_meta?.response])).toEqual([
      [false, 'right'],
      [false, 'left'],
      [false, 'left'],
    ])
  })

  test('held and modified keys are not answers; the arrows do not scroll the page', () => {
    setup(params([go('left')]))
    show(100)
    key('ArrowLeft', { repeat: true })
    key('ArrowLeft', { ctrlKey: true })
    key('ArrowLeft', { altKey: true })
    expect(pushed).toHaveLength(0)
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
    act(() => void window.dispatchEvent(e))
    expect(e.defaultPrevented).toBe(true)
    expect(pushed).toHaveLength(1)
  })

  test('only the first press of a trial counts; onDone once after the last trial', () => {
    const { onDone } = setup(params([go('left'), go('left')]))
    show(100)
    key('ArrowLeft')
    key('ArrowRight') // during the next cross: ignored
    show(100)
    key('ArrowLeft')
    expect(pushed).toHaveLength(2)
    expect(onDone).toHaveBeenCalledOnce()
    advance(10_000)
    expect(pushed).toHaveLength(2)
    expect(onDone).toHaveBeenCalledOnce()
  })

  test('a hidden page aborts the running trial and moves on to the next after the cross', () => {
    setup(params([go('left'), stop('left'), go('right')]))
    show(100)
    key('ArrowLeft')
    show(50) // trial 1 (a stop trial) running
    setHidden(true)
    key('ArrowLeft')
    advance(10_000)
    expect(pushed).toHaveLength(1)
    setHidden(false)
    expect(cross()).not.toBeNull()
    show(200)
    key('ArrowRight')
    expect(pushed.map((e) => e.trial_index)).toEqual([0, 2])
  })

  test('pause/exit unmounts it: no event and no onDone afterwards', () => {
    const { onDone, unmount } = setup(params([stop('left'), go('left')]))
    show(100)
    unmount()
    advance(20_000)
    expect(pushed).toHaveLength(0)
    expect(onDone).not.toHaveBeenCalled()
  })

  test('every event passes the server rules (at most 16 trial_meta keys)', async () => {
    const { eventProblem } = await import('../telemetry/types')
    setup(params([go('left'), stop('right'), go('right')]))
    show(100)
    key('ArrowLeft')
    show(LIMIT)
    show(100)
    key('ArrowRight')
    expect(pushed).toHaveLength(3)
    for (const e of pushed) expect(eventProblem(e)).toBeNull()
  })
})
