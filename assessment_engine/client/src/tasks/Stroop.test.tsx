import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { StroopParams, TelemetryEvent } from '../telemetry/types'
import type { VoiceSource } from '../voice/voiceProbe'
import { Stroop } from './Stroop'

const COLORS = ['red', 'green', 'blue', 'yellow']
const conflict = { word: 'RED', ink: 'blue', answer: 'blue' }
const params = (trials: StroopParams['trials']): StroopParams => ({ colors: COLORS, trials, time_limit_ms: 3000 })

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
})

function setup(p: StroopParams) {
  const recorder = new TrialRecorder({
    user_id: 'u',
    session_id: 's',
    task_id: 't',
    dimension: 'executive_function',
    voice_opt_in: false,
  })
  const onDone = vi.fn()
  render(<Stroop params={p} recorder={recorder} onDone={onDone} />)
  return { onDone }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const press = (color: string) =>
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: new RegExp(color) })))
const key = (k: string, repeat = false) => act(() => void fireEvent.keyDown(window, { key: k, repeat }))

test('the word is drawn in its ink color; one labelled button per color', () => {
  setup(params([conflict]))
  expect(screen.getByText('RED').style.color).toBe('blue')
  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['red (1)', 'green (2)', 'blue (3)', 'yellow (4)'])
})

test('clicking the ink color scores 1, the word color scores 0; RT from onset', () => {
  setup(params([conflict, conflict]))
  advance(400)
  press('blue')
  advance(250)
  press('red')
  expect(pushed).toHaveLength(2)
  expect(pushed[0]).toMatchObject({ trial_index: 0, score_norm: 1, error_flag: false, response_time_ms: 400, keystroke_latency_ms: 400 })
  expect(pushed[1]).toMatchObject({ trial_index: 1, score_norm: 0, error_flag: true, response_time_ms: 250 })
  expect(pushed[0].trial_meta).toEqual({ item_id: 't:0', congruent: false })
})

test('trial_meta.congruent: word RED in blue ink is false, BLUE in blue ink is true (also on timeout)', () => {
  setup(params([conflict, { word: 'BLUE', ink: 'blue', answer: 'blue' }]))
  press('blue')
  advance(3000)
  expect(pushed.map((e) => e.trial_meta?.congruent)).toEqual([false, true])
})

test('a timeout scores 0 with response_time_ms === time_limit_ms', () => {
  setup(params([conflict]))
  advance(3000)
  expect(pushed).toHaveLength(1)
  expect(pushed[0]).toMatchObject({ score_norm: 0, response_time_ms: 3000, keystroke_latency_ms: null })
})

test('two errors in a row give error_burst 2; a correct answer resets it', () => {
  setup(params([conflict, conflict, conflict]))
  press('red')
  press('green')
  press('blue')
  expect(pushed.map((e) => e.error_burst)).toEqual([1, 2, 0])
})

test('keys 1..9 map to colors in order; only the first press counts, repeats ignored', () => {
  const { onDone } = setup(params([conflict, conflict]))
  advance(100)
  key('3') // blue
  advance(100)
  key('1', true) // repeat: ignored entirely
  key('9') // no 9th color: an input, not a response
  advance(100)
  key('1') // red
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 0])
  expect(pushed[1].response_time_ms).toBe(200)
  expect(onDone).toHaveBeenCalledOnce()
  advance(10000)
  expect(pushed).toHaveLength(2)
  expect(onDone).toHaveBeenCalledOnce()
})

test('hiding the page aborts the current trial; it resumes at the next trial', () => {
  const { onDone } = setup(params([conflict, conflict, conflict]))
  press('blue') // trial 0 done, trial 1 running
  const setHidden = (h: boolean) =>
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
      document.dispatchEvent(new Event('visibilitychange'))
    })
  setHidden(true)
  press('blue') // ignored while hidden
  advance(10000)
  expect(pushed).toHaveLength(1)
  setHidden(false)
  press('blue')
  expect(pushed.map((e) => e.trial_index)).toEqual([0, 2])
  expect(onDone).toHaveBeenCalledOnce()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

test('a focused button activated by keyboard (click, detail 0) answers once; a pointer press is not double-counted', () => {
  setup(params([conflict, conflict, conflict]))
  const blue = () => screen.getByRole('button', { name: /blue/ })
  blue().focus()
  act(() => void fireEvent.click(blue(), { detail: 0 }))
  expect(pushed).toHaveLength(1)
  act(() => {
    fireEvent.pointerDown(blue())
    fireEvent.click(blue(), { detail: 1 })
  })
  expect(pushed).toHaveLength(2)
  expect(pushed.map((e) => e.trial_index)).toEqual([0, 1])
})

test('modified keys (Ctrl+1, Alt+2, Meta+3) are not responses', () => {
  setup(params([conflict]))
  act(() => {
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    fireEvent.keyDown(window, { key: '2', altKey: true })
    fireEvent.keyDown(window, { key: '3', metaKey: true })
  })
  expect(pushed).toHaveLength(0)
  key('3')
  expect(pushed).toHaveLength(1)
})

test('a time limit that expires right after a hide (before cleanup) does not finish the aborted trial', () => {
  setup(params([conflict, conflict]))
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(3000) // same batch: the trial's timer is still scheduled
  })
  expect(pushed).toHaveLength(0)
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  act(() => void document.dispatchEvent(new Event('visibilitychange')))
  press('blue')
  expect(pushed.map((e) => e.trial_index)).toEqual([1])
})

test('holding Enter on a focused button answers once; auto-repeat clicks do not answer later trials', () => {
  setup(params([conflict, conflict, conflict]))
  const blue = () => screen.getByRole('button', { name: /blue/ })
  blue().focus()
  // Enter activates a button on keydown, so each (repeating) keydown is followed by a detail-0 click.
  const enter = (repeat: boolean) =>
    act(() => {
      fireEvent.keyDown(blue(), { key: 'Enter', repeat })
      fireEvent.click(blue(), { detail: 0 })
    })
  enter(false)
  enter(true)
  enter(true)
  expect(pushed.map((e) => e.trial_index)).toEqual([0])
  act(() => void fireEvent.keyUp(blue(), { key: 'Enter' }))
  enter(false) // a fresh press answers the next trial
  expect(pushed.map((e) => e.trial_index)).toEqual([0, 1])
})

test('a detail-0 click with no preceding keydown answers even after a repeating keydown that never got a keyup', () => {
  setup(params([conflict, conflict]))
  const blue = () => screen.getByRole('button', { name: /blue/ })
  // A repeating Enter (its click ignored) whose keyup lands elsewhere, then a held non-activating key.
  act(() => {
    fireEvent.keyDown(blue(), { key: 'Enter', repeat: true })
    fireEvent.click(blue(), { detail: 0 })
  })
  expect(pushed).toHaveLength(0)
  act(() => void fireEvent.click(blue(), { detail: 0 })) // e.g. a screen-reader activation
  expect(pushed).toHaveLength(1)
  act(() => void fireEvent.keyDown(blue(), { key: 'a', repeat: true }))
  act(() => void fireEvent.click(blue(), { detail: 0 }))
  expect(pushed).toHaveLength(2)
})

function setupVoice(optIn: boolean, voice?: VoiceSource) {
  const recorder = new TrialRecorder({
    user_id: 'u',
    session_id: 's',
    task_id: 't',
    dimension: 'executive_function',
    voice_opt_in: optIn,
  })
  render(<Stroop params={params([conflict, conflict])} recorder={recorder} onDone={vi.fn()} voice={voice} />)
}

const fakeVoice = () => ({
  markOnset: vi.fn(),
  measure: vi.fn(() => ({ voice_latency_ms: 420, vocal_pace_hz: 1.5 })),
})

test('with a voice probe and opt-in, each trial marks onset and its event carries the voice numbers', () => {
  const voice = fakeVoice()
  setupVoice(true, voice)
  expect(voice.markOnset).toHaveBeenCalledTimes(1) // trial 0 onset
  press('blue')
  expect(voice.markOnset).toHaveBeenCalledTimes(2) // trial 1 onset
  advance(3000) // timeout also measures
  expect(pushed).toHaveLength(2)
  for (const e of pushed) expect(e).toMatchObject({ voice_opt_in: true, voice_latency_ms: 420, vocal_pace_hz: 1.5 })
})

test('the instruction asks for a spoken answer only while a voice probe is active', () => {
  setupVoice(true, fakeVoice())
  expect(screen.getByText('Say the ink color aloud, then pick it.')).toBeTruthy()
  expect(screen.queryByText('Pick the color of the ink, not the word.')).toBeNull()
  cleanup()
  setupVoice(true)
  expect(screen.getByText('Pick the color of the ink, not the word.')).toBeTruthy()
  expect(screen.queryByText(/aloud/)).toBeNull()
})

test('without a voice probe there are no voice fields', () => {
  setupVoice(true)
  press('blue')
  expect(pushed[0].voice_opt_in).toBe(true)
  expect(pushed[0]).not.toHaveProperty('voice_latency_ms')
  expect(pushed[0]).not.toHaveProperty('vocal_pace_hz')
})

test('a probe without opt-in on the recorder sends no voice fields', () => {
  setupVoice(false, fakeVoice())
  press('blue')
  expect(pushed[0].voice_opt_in).toBe(false)
  expect(pushed[0]).not.toHaveProperty('voice_latency_ms')
})
