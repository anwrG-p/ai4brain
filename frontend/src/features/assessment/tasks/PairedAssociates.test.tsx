import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import { eventProblem, type PalParams, type TaskPayload, type TelemetryEvent } from '../telemetry/types'
import fixtures from './fixtures.json'
import { boxForKey, PAL_DESIGN, PairedAssociates } from './PairedAssociates'

const STUDY = 1000
const LIMIT = 5000
// Stage 1: pattern 0 in box 2, pattern 1 in box 5; recalled pattern 1 first. Stage 2: three patterns.
const params = (max_attempts = 2): PalParams => ({
  boxes: 8,
  study_ms: STUDY,
  time_limit_ms: LIMIT,
  max_attempts,
  stages: [
    { items: [{ pattern: 0, box: 2 }, { pattern: 1, box: 5 }], recall: [1, 0] },
    { items: [{ pattern: 2, box: 0 }, { pattern: 3, box: 7 }, { pattern: 4, box: 4 }], recall: [2, 0, 1] },
  ],
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

function setup(p: PalParams = params()) {
  const recorder = new TrialRecorder({ user_id: 'u', session_id: 's', task_id: 't', dimension: 'episodic_memory', voice_opt_in: false })
  const onDone = vi.fn()
  const view = render(<PairedAssociates params={p} recorder={recorder} onDone={onDone} />)
  return { onDone, ...view }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
// Each box's timer starts in an effect after the previous one closes: one step per box.
const study = (n: number) => {
  for (let k = 0; k < n; k++) advance(STUDY)
}
const tap = (box: number) => act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: `Box ${box + 1}` })))
const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }))
const openBox = () => document.querySelector('[data-open]')?.getAttribute('data-box')
const setHidden = (h: boolean) =>
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
    document.dispatchEvent(new Event('visibilitychange'))
  })

describe('Pair Finder fixture (CANTAB PAL 2-8, simplified)', () => {
  const task = (fixtures as TaskPayload[]).find((t) => t.schema_type === 'pal')!
  const p = task.params as PalParams

  test('stages of 2, 4, 6 and 8 patterns (20 in all) in 8 boxes; 3 attempts; 2 s per box', () => {
    expect(task.dimension).toBe('episodic_memory')
    expect(p.stages.map((s) => s.items.length)).toEqual([...PAL_DESIGN.stages])
    expect(p.boxes).toBe(PAL_DESIGN.boxes)
    expect(p.max_attempts).toBe(PAL_DESIGN.maxAttempts)
    expect(p.study_ms).toBe(PAL_DESIGN.studyMs)
  })

  test('each stage: distinct boxes and patterns, and the recall order is a reshuffle of its items', () => {
    for (const s of p.stages) {
      expect(new Set(s.items.map((x) => x.box)).size).toBe(s.items.length)
      expect(new Set(s.items.map((x) => x.pattern)).size).toBe(s.items.length)
      for (const x of s.items) {
        expect(x.box).toBeGreaterThanOrEqual(0)
        expect(x.box).toBeLessThan(p.boxes)
      }
      expect([...s.recall].sort()).toEqual(s.items.map((_, k) => k))
      expect(s.recall).not.toEqual(s.items.map((_, k) => k))
    }
  })
})

describe('boxForKey', () => {
  test('digits 1..boxes pick box 0..boxes-1; anything else does not', () => {
    expect(boxForKey('1', 8)).toBe(0)
    expect(boxForKey('8', 8)).toBe(7)
    expect(boxForKey('9', 8)).toBeNull()
    expect(boxForKey('0', 8)).toBeNull()
    expect(boxForKey('a', 8)).toBeNull()
  })
})

describe('Pair Finder', () => {
  test('study: each pattern opens in its box for study_ms, in order; no answers, no events', () => {
    setup()
    expect(screen.getByRole('region', { name: 'Pair Finder' })).toBeInTheDocument()
    expect(screen.getByText('Watch the boxes')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(openBox()).toBe('2')
    advance(STUDY - 1)
    expect(openBox()).toBe('2')
    advance(1)
    expect(openBox()).toBe('5')
    key('6')
    expect(pushed).toHaveLength(0)
    advance(STUDY)
    expect(screen.getByText('Which box held this shape?')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(8)
  })

  test('recall: tap or a digit picks a box; one event per pattern with its trial_meta; RT from the prompt', () => {
    setup()
    study(2)
    advance(700)
    tap(5) // pattern 1 was in box 5
    advance(300)
    key('2') // box 1; pattern 0 was in box 2
    expect(pushed).toHaveLength(2)
    expect(pushed[0]).toMatchObject({ trial_index: 0, error_flag: false, response_time_ms: 700 })
    expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', pal_level: 2, attempt: 1, pattern: 1, box: 5, chosen: 5, pal_total: 5, boxes: 8 })
    expect(pushed[1]).toMatchObject({ trial_index: 1, error_flag: true, response_time_ms: 300 })
    expect(pushed[1]!.trial_meta).toMatchObject({ pattern: 0, box: 2, chosen: 1 })
    for (const e of pushed) expect(eventProblem(e)).toBeNull()
  })

  test('all right: the next, larger stage; trial_index keeps counting so item_ids stay unique', () => {
    const { onDone } = setup()
    study(2)
    tap(5)
    tap(2)
    expect(screen.getByText('Watch the boxes')).toBeInTheDocument()
    study(3)
    tap(4)
    tap(0)
    tap(7)
    expect(pushed.map((e) => [e.trial_index, e.trial_meta?.pal_level, e.trial_meta?.attempt, e.error_flag])).toEqual([
      [0, 2, 1, false],
      [1, 2, 1, false],
      [2, 3, 1, false],
      [3, 3, 1, false],
      [4, 3, 1, false],
    ])
    expect(new Set(pushed.map((e) => e.trial_meta?.item_id)).size).toBe(5)
    expect(onDone).toHaveBeenCalledOnce()
  })

  test('a wrong box: the same stage is studied again (attempt 2); failing the last attempt ends the task', () => {
    const { onDone } = setup(params(2))
    study(2)
    tap(5)
    tap(0) // wrong
    expect(screen.getByText('Once more: watch the boxes')).toBeInTheDocument()
    study(2)
    tap(1) // wrong again, on the last attempt
    tap(2)
    expect(pushed.map((e) => [e.trial_index, e.trial_meta?.attempt, e.error_flag])).toEqual([
      [0, 1, false],
      [1, 1, true],
      [2, 2, true],
      [3, 2, false],
    ])
    expect(onDone).toHaveBeenCalledOnce()
    expect(screen.queryByText('Watch the boxes')).toBeNull() // stage 2 is never reached
  })

  test('a retry that is all right moves on to the next stage', () => {
    setup(params(3))
    study(2)
    tap(0)
    tap(2)
    study(2)
    tap(5)
    tap(2)
    expect(screen.getByText('Watch the boxes')).toBeInTheDocument()
    expect(pushed.at(-1)!.trial_meta?.attempt).toBe(2)
  })

  test('no choice within the time limit: wrong, chosen -1, RT = the limit', () => {
    setup()
    study(2)
    advance(LIMIT)
    expect(pushed[0]).toMatchObject({ error_flag: true, response_time_ms: LIMIT })
    expect(pushed[0]!.trial_meta).toMatchObject({ chosen: -1 })
  })

  test('boxes are large tap targets (64 px) with their number shown', () => {
    setup()
    study(2)
    const boxes = screen.getAllByRole('button')
    for (const [k, b] of boxes.entries()) {
      expect(b.className).toMatch(/size-16/)
      expect(b).toHaveTextContent(String(k + 1))
    }
  })

  test('a hidden page pauses the study timer; it resumes with the time left', () => {
    setup()
    advance(400)
    setHidden(true)
    advance(10_000)
    expect(openBox()).toBeUndefined()
    setHidden(false)
    expect(openBox()).toBe('2')
    advance(STUDY - 401)
    expect(openBox()).toBe('2')
    advance(1)
    expect(openBox()).toBe('5')
  })

  test('a hidden page during recall drops that choice; the stage cannot pass with it untested', () => {
    setup()
    study(2)
    setHidden(true)
    tap(5)
    advance(LIMIT * 2)
    expect(pushed).toHaveLength(0)
    setHidden(false)
    tap(2) // now asking for pattern 0: right, but pattern 1 was never answered
    expect(pushed.map((e) => [e.trial_index, e.error_flag])).toEqual([[1, false]])
    expect(screen.getByText('Once more: watch the boxes')).toBeInTheDocument() // attempt 2, not stage 2
  })

  test('pause/exit unmounts it: no event and no onDone afterwards', () => {
    const { onDone, unmount } = setup()
    study(2)
    unmount()
    advance(60_000)
    expect(pushed).toHaveLength(0)
    expect(onDone).not.toHaveBeenCalled()
  })
})
