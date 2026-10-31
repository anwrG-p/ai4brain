import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QuestPlus } from '../adaptive/quest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { TaskPayload, TelemetryEvent, UfovParams } from '../telemetry/types'
import fixtures from './fixtures.json'
import { framesFor, measureFrameMs } from './frames'
import { Ufov } from './Ufov'

const FRAME = 8.33 // 120 Hz
const fixture = (fixtures as TaskPayload[]).find((t) => t.schema_type === 'ufov')!.params as UfovParams
const params = (p: Partial<UfovParams> = {}): UfovParams => ({ ...fixture, ...p })
const trial = (central: 'A' | 'B', peripheral_dir: number) => ({ central, peripheral_dir, distractors: [{ dir: 2, ring: 1 }] })

let pushed: TelemetryEvent[]
let clock: number
let queue: FrameRequestCallback[]

// Fake rAF: callbacks queue up and run one frame at a time, each frame advancing the clock by 8.33 ms.
const raf = (cb: FrameRequestCallback) => queue.push(cb)
const frames = (n: number) =>
  act(() => {
    for (let k = 0; k < n; k++) {
      clock += FRAME
      const due = queue
      queue = []
      for (const cb of due) cb(clock)
    }
  })

beforeEach(() => {
  vi.useFakeTimers()
  pushed = []
  clock = 1000
  queue = []
  vi.spyOn(tracker, 'push').mockImplementation((e) => void pushed.push(e))
  // jsdom has no canvas; the component must cope with a null context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function setup(p: UfovParams) {
  const recorder = new TrialRecorder(
    { user_id: 'u', session_id: 's', task_id: 't', dimension: 'processing_speed', voice_opt_in: false },
    () => clock,
  )
  const onDone = vi.fn()
  render(<Ufov params={p} recorder={recorder} onDone={onDone} raf={raf} />)
  frames(31) // calibration
  await act(async () => {}) // let the calibration promise resolve
  return { onDone }
}

// Fixation, then stimulus frames until the mask is drawn.
const runStimulus = (n = 40) => {
  act(() => void vi.advanceTimersByTime(500))
  frames(n)
}
const key = (k: string, init: KeyboardEventInit = {}) => act(() => void fireEvent.keyDown(window, { key: k, ...init }))

test('framesFor rounds to whole frames, at least one', () => {
  expect(framesFor(50, 16.67)).toBe(3)
  expect(framesFor(5, 16.67)).toBe(1)
  expect(framesFor(50, 8.33)).toBe(6)
})

test('measureFrameMs returns the median rAF interval', async () => {
  const p = measureFrameMs(raf, 30)
  frames(31)
  expect(await p).toBeCloseTo(FRAME, 5)
})

test('at 120 Hz a 50 ms request shows 6 frames (shown_ms ~ 50) and QUEST+ gets shown_ms', async () => {
  vi.spyOn(QuestPlus.prototype, 'next').mockReturnValue(50)
  const update = vi.spyOn(QuestPlus.prototype, 'update')
  await setup(params({ trials: [trial('A', 0)] }))
  act(() => void vi.advanceTimersByTime(500))
  frames(6) // stimulus frames 0..5
  expect(screen.queryByRole('button', { name: 'A' })).toBeNull()
  frames(1) // mask
  expect(screen.getByRole('button', { name: 'A' })).toBeTruthy()
  key('a')
  key('1')
  expect(pushed).toHaveLength(1)
  const m = pushed[0]!.trial_meta!
  expect(m.requested_ms).toBe(50)
  expect(m.frames).toBe(6)
  expect(m.shown_ms).toBeCloseTo(50, 0)
  expect(update).toHaveBeenCalledOnce()
  expect(update.mock.calls[0]![0]).toBe(m.shown_ms)
  expect(update.mock.calls[0]![0]).not.toBe(50)
  expect(update.mock.calls[0]![1]).toBe(true)
})

test('central right and peripheral wrong scores 0 with central_ok true; meta and RT', async () => {
  vi.spyOn(QuestPlus.prototype, 'next').mockReturnValue(50)
  const { onDone } = await setup(params({ trials: [trial('B', 3)] }))
  runStimulus()
  clock += 400
  key('b')
  key('b') // only the first answer per part counts
  key('2')
  const e = pushed[0]!
  expect(e.score_norm).toBe(0)
  expect(e.trial_meta).toMatchObject({ central_ok: true, peripheral_ok: false, similarity: 0.5, mask_noise: 0.5, item_id: 't:0' })
  expect(e.response_time_ms).toBeCloseTo(40 * FRAME - FRAME + 400, 5) // stimulus onset is the first stimulus frame
  expect(e.trial_meta?.quest_threshold_ms).toBeTypeOf('number')
  expect(onDone).toHaveBeenCalledOnce()
})

test('meta logs the clamped similarity and mask_noise that were drawn', async () => {
  vi.spyOn(QuestPlus.prototype, 'next').mockReturnValue(50)
  await setup(params({ trials: [trial('A', 0)], similarity: 2, mask_noise: 'x' as unknown as number }))
  runStimulus()
  key('a')
  key('1')
  expect(pushed[0]!.trial_meta).toMatchObject({ similarity: 1, mask_noise: 0 })
})

test('keyboard-only: Enter/Space activation of the buttons answers both parts, in either order', async () => {
  await setup(params({ trials: [trial('A', 4)] }))
  runStimulus(80)
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'Direction 5' }), { detail: 0 }))
  expect(pushed).toHaveLength(0)
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'A' }), { detail: 0 }))
  expect(pushed[0]!.score_norm).toBe(1)
})

test('answers before the response phase and held keys are ignored', async () => {
  await setup(params({ trials: [trial('A', 0)] }))
  key('a')
  key('1')
  runStimulus(80)
  key('a', { repeat: true })
  key('1')
  expect(pushed).toHaveLength(0)
  key('a')
  expect(pushed).toHaveLength(1)
})

test('an invalid peripheral_dir or central produces no event; quest_threshold_ms lands on the last emitted event', async () => {
  const bad = [
    { central: 'A' as const, peripheral_dir: 8, distractors: [] },
    { central: 'C' as unknown as 'A', peripheral_dir: 1, distractors: [] },
  ]
  const { onDone } = await setup(params({ trials: [trial('A', 0), trial('B', 1), ...bad] }))
  runStimulus(80)
  key('a')
  key('1')
  runStimulus(80)
  key('b')
  key('2')
  expect(pushed.map((e) => e.trial_index)).toEqual([0, 1])
  expect(pushed[0]!.trial_meta).not.toHaveProperty('quest_threshold_ms')
  const th = pushed[1]!.trial_meta!.quest_threshold_ms as number
  expect(Math.round(th * 10) / 10).toBe(th)
  expect(onDone).toHaveBeenCalledOnce()
})

test('a hidden page aborts the trial without a QUEST update; the next trial runs when visible', async () => {
  const update = vi.spyOn(QuestPlus.prototype, 'update')
  const setHidden = (hidden: boolean) =>
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
      document.dispatchEvent(new Event('visibilitychange'))
    })
  await setup(params({ trials: [trial('A', 0), trial('B', 1)] }))
  runStimulus(80)
  key('a')
  setHidden(true)
  key('1')
  setHidden(false)
  expect(pushed).toHaveLength(0)
  expect(update).not.toHaveBeenCalled()
  runStimulus(80)
  key('b')
  key('2')
  expect(pushed.map((e) => e.trial_index)).toEqual([1])
  expect(update).toHaveBeenCalledOnce()
})

test('shown_ms that is not positive skips the QUEST update but still emits', async () => {
  const update = vi.spyOn(QuestPlus.prototype, 'update')
  await setup(params({ trials: [trial('A', 0)] }))
  act(() => void vi.advanceTimersByTime(500))
  // Two frames with the same timestamp: stimulus and mask on one clock reading.
  act(() => {
    for (let k = 0; k < 80; k++) {
      const due = queue
      queue = []
      for (const cb of due) cb(clock)
    }
  })
  key('a')
  key('1')
  expect(pushed).toHaveLength(1)
  expect(pushed[0]!.trial_meta?.shown_ms).toBe(0)
  expect(update).not.toHaveBeenCalled()
})

test('the canvas is described for assistive tech', async () => {
  await setup(params())
  expect(screen.getByRole('img', { name: 'Briefly flashed display' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Perceptual Radar' })).toBeTruthy()
})

test('canvas colours are read from CSS variables, once per trial, and are the only fill styles used', async () => {
  vi.spyOn(QuestPlus.prototype, 'next').mockReturnValue(50)
  // A stand-in 2-D context: every method is a no-op; fillStyle assignments are recorded.
  const fills: unknown[] = []
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => {
      if (k === 'fillStyle') fills.push(v)
      o[k] = v
      return true
    },
  })
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(ctx as unknown as RenderingContext)
  const real = window.getComputedStyle.bind(window)
  const asked: string[] = []
  const TOKENS: Record<string, string> = { '--color-surface': ' paper-token', '--color-ink': ' ink-token' }
  const gcs = vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
    if (!(el instanceof HTMLCanvasElement)) return real(el, pseudo)
    return {
      getPropertyValue: (name: string) => {
        asked.push(name)
        return TOKENS[name] ?? ''
      },
    } as CSSStyleDeclaration
  })
  const onCanvas = () => gcs.mock.calls.filter(([el]) => el instanceof HTMLCanvasElement).length

  await setup(params({ trials: [trial('A', 0), trial('B', 1)] }))
  runStimulus()
  expect(onCanvas()).toBe(1) // fixation, stimulus and mask of trial 0 share one read
  expect(new Set(asked)).toEqual(new Set(['--color-surface', '--color-ink']))
  expect(fills.length).toBeGreaterThan(0)
  expect(new Set(fills)).toEqual(new Set(['paper-token', 'ink-token']))
  key('a')
  key('1')
  runStimulus()
  expect(onCanvas()).toBe(2)
})

const HEX_OR_FN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/

test('no element carries a hex or rgb() colour in its style, response phase included', async () => {
  await setup(params({ trials: [trial('A', 0)] }))
  runStimulus()
  expect(screen.getByRole('group', { name: 'Your answer' })).toBeTruthy()
  const styled = document.querySelectorAll('[style]')
  expect(styled.length).toBeGreaterThan(0)
  for (const el of styled) expect(el.getAttribute('style')).not.toMatch(HEX_OR_FN)
})
