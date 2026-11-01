import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import { eventProblem, type FlankerParams, type TaskPayload, type TelemetryEvent } from '../telemetry/types'
import fixtures from './fixtures.json'
import { Flanker, FLANKER_DESIGN, FlankerRow } from './Flanker'

const FIX = 500
const LIMIT = 1700
const params = (trials: FlankerParams['trials']): FlankerParams => ({ time_limit_ms: LIMIT, fixation_ms: FIX, trials })
const con = (dir: 'left' | 'right') => ({ dir, congruent: true })
const inc = (dir: 'left' | 'right') => ({ dir, congruent: false })

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

function setup(p: FlankerParams) {
  const recorder = new TrialRecorder({ user_id: 'u', session_id: 's', task_id: 't', dimension: 'executive_function', voice_opt_in: false })
  const onDone = vi.fn()
  const view = render(<Flanker params={p} recorder={recorder} onDone={onDone} />)
  return { onDone, ...view }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
// The cross, then `ms` into the arrows (two steps: the trial's timers start after the cross ends).
const show = (ms: number) => {
  advance(FIX)
  advance(ms)
}
const key = (k: string, opts: Partial<KeyboardEventInit> = {}) => act(() => void fireEvent.keyDown(window, { key: k, ...opts }))
const cross = () => screen.queryByRole('img', { name: 'Look at the cross' })
// Each arrow's direction, from its transform (a left arrow is mirrored).
const arrows = () =>
  [...document.querySelectorAll('[data-flanker-row] path')].map((p) => (p.getAttribute('transform')!.includes('scale(-1 1)') ? 'L' : 'R')).join('')

describe('Arrow Focus fixture (research-backed design)', () => {
  const task = (fixtures as TaskPayload[]).find((t) => t.schema_type === 'flanker')!
  const p = task.params as FlankerParams

  test('96 trials (one ANT block), 48 congruent and 48 incongruent, 24 per direction each; 1700 ms window', () => {
    expect(task.dimension).toBe('executive_function')
    expect(p.trials).toHaveLength(FLANKER_DESIGN.trials)
    expect(p.time_limit_ms).toBe(FLANKER_DESIGN.timeLimitMs)
    for (const congruent of [true, false]) {
      expect(p.trials.filter((t) => t.congruent === congruent)).toHaveLength(FLANKER_DESIGN.perCondition)
      for (const dir of ['left', 'right']) expect(p.trials.filter((t) => t.congruent === congruent && t.dir === dir)).toHaveLength(24)
    }
  })
})

describe('FlankerRow', () => {
  test('congruent: all five the same way; incongruent: the middle one against the four others', () => {
    const { unmount } = render(<FlankerRow dir="right" congruent />)
    expect(arrows()).toBe('RRRRR')
    unmount()
    render(<FlankerRow dir="right" congruent={false} />)
    expect(arrows()).toBe('LLRLL')
  })
})

describe('Arrow Focus', () => {
  test('a cross before each trial; presses during it are not answers', () => {
    setup(params([inc('left')]))
    expect(cross()).not.toBeNull()
    key('ArrowLeft')
    advance(FIX - 1)
    expect(pushed).toHaveLength(0)
    advance(1)
    expect(cross()).toBeNull()
    expect(arrows()).toBe('RRLRR')
  })

  test('the middle arrow decides; RT from onset; trial_meta { flanker, dir, response }', () => {
    setup(params([inc('left'), con('right')]))
    show(480)
    key('ArrowLeft')
    show(390)
    key('ArrowLeft') // wrong: the middle points right
    expect(pushed[0]).toMatchObject({ trial_index: 0, error_flag: false, response_time_ms: 480 })
    expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', flanker: 'incongruent', dir: 'left', response: 'left' })
    expect(pushed[1]).toMatchObject({ trial_index: 1, error_flag: true, response_time_ms: 390 })
    expect(pushed[1]!.trial_meta).toEqual({ item_id: 't:1', flanker: 'congruent', dir: 'right', response: 'left' })
    expect(pushed[1]!.trial_meta).not.toHaveProperty('congruent') // Stroop's key: schemaOf must not mistake it
  })

  test('no press within the window: wrong, response none, RT = the window', () => {
    const { onDone } = setup(params([con('left')]))
    show(LIMIT)
    expect(pushed[0]).toMatchObject({ error_flag: true, response_time_ms: LIMIT })
    expect(pushed[0]!.trial_meta).toMatchObject({ response: 'none' })
    expect(onDone).toHaveBeenCalledOnce()
  })

  test('large Left / Right buttons answer on pointerdown and on keyboard activation', () => {
    setup(params([con('right'), inc('left'), con('left')]))
    for (const b of screen.getAllByRole('button')) expect(b.className).toMatch(/min-h-14/)
    show(100)
    act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'Right' })))
    show(100)
    act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'Left' })))
    show(100)
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Left' }), { detail: 0 }))
    expect(pushed.map((e) => e.error_flag)).toEqual([false, false, false])
  })

  test('held or modified keys are not answers; only the first press counts', () => {
    setup(params([con('left'), con('left')]))
    show(100)
    key('ArrowLeft', { repeat: true })
    key('ArrowLeft', { metaKey: true })
    expect(pushed).toHaveLength(0)
    key('ArrowLeft')
    key('ArrowRight') // during the next cross
    expect(pushed).toHaveLength(1)
  })

  test('a hidden page aborts the running trial and resumes at the next', () => {
    setup(params([con('left'), inc('right'), con('right')]))
    show(100)
    key('ArrowLeft')
    show(50)
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    advance(10_000)
    expect(pushed).toHaveLength(1)
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    show(100)
    key('ArrowRight')
    expect(pushed.map((e) => e.trial_index)).toEqual([0, 2])
  })

  test('a page hidden during the cross skips nothing: that trial gets a fresh cross, then runs', () => {
    setup(params([con('left'), inc('right')]))
    show(100)
    key('ArrowLeft') // trial 0 done; trial 1's cross is up
    advance(200)
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    advance(10_000)
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(cross()).not.toBeNull()
    advance(FIX - 1)
    expect(cross()).not.toBeNull() // a full cross again
    advance(1)
    expect(arrows()).toBe('LLRLL') // trial 1, not skipped
    key('ArrowRight')
    expect(pushed.map((e) => [e.trial_index, e.error_flag])).toEqual([
      [0, false],
      [1, false],
    ])
  })

  test('pause/exit unmounts it: no event and no onDone afterwards', () => {
    const { onDone, unmount } = setup(params([con('left')]))
    show(100)
    unmount()
    advance(10_000)
    expect(pushed).toHaveLength(0)
    expect(onDone).not.toHaveBeenCalled()
  })

  test('events pass the server rules', () => {
    setup(params([con('left'), inc('right')]))
    show(100)
    key('ArrowLeft')
    show(LIMIT)
    expect(pushed).toHaveLength(2)
    for (const e of pushed) expect(eventProblem(e)).toBeNull()
  })
})
