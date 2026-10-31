import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { NBackParams, TelemetryEvent } from '../telemetry/types'
import { dPrime, taskScores } from '../../insights/taskScores'
import { NBack } from './NBack'

type Trial = NBackParams['trials'][number]

const trial = (over: Partial<Trial> = {}): Trial => ({
  pos: [0, 0],
  symbol: '3',
  rule: 'position',
  trial_type: 'standard',
  answer: { position: false, symbol: false },
  ...over,
})

const params = (trials: Trial[], streams: NBackParams['streams'] = ['position', 'symbol']): NBackParams => ({
  n: 2,
  stimulus_ms: 500,
  interval_ms: 2000,
  streams,
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
})

function setup(p: NBackParams) {
  const recorder = new TrialRecorder({
    user_id: 'u',
    session_id: 's',
    task_id: 't',
    dimension: 'working_memory',
    voice_opt_in: false,
  })
  const onDone = vi.fn()
  render(<NBack params={p} recorder={recorder} onDone={onDone} />)
  return { onDone }
}

// Small act() steps so effects scheduling the next trial flush between timer firings.
const advance = (ms: number) => {
  for (let left = ms; left > 0; left -= 10) act(() => void vi.advanceTimersByTime(Math.min(10, left)))
}
const key = (k: string, repeat = false) => act(() => void fireEvent.keyDown(window, { key: k, repeat }))

test('3 dual-stream trials emit 6 events, one per stream, with trial_meta.stream', () => {
  setup(params([trial(), trial(), trial({ answer: { position: true, symbol: false } })]))
  advance(6000)
  expect(pushed).toHaveLength(6)
  expect(pushed.map((e) => e.trial_index)).toEqual([0, 0, 1, 1, 2, 2])
  expect(pushed.map((e) => e.trial_meta?.stream)).toEqual(['position', 'symbol', 'position', 'symbol', 'position', 'symbol'])
  // No press: window = interval_ms; correct iff the answer was "no match".
  for (const e of pushed) expect(e.response_time_ms).toBe(2000)
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 1, 1, 1, 0, 1])
  expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', trial_type: 'standard', rule: 'position', stream: 'position' })
})

test('A on a lure_minus with answer.position false scores 0; RT is from that trial onset', () => {
  setup(params([trial({ trial_type: 'lure_minus', answer: { position: false, symbol: false } })]))
  advance(300)
  key('a')
  advance(500)
  key('L')
  advance(1200)
  const [pos, sym] = pushed
  expect(pos).toMatchObject({ score_norm: 0, error_flag: true, response_time_ms: 300, keystroke_latency_ms: 300 })
  expect(pos!.trial_meta).toMatchObject({ trial_type: 'lure_minus', stream: 'position' })
  // L is the off-rule key under the position rule: its press is wrong on its own event. RT is per stream.
  expect(sym).toMatchObject({ score_norm: 0, error_flag: true, response_time_ms: 800, keystroke_latency_ms: 300 })
  expect(sym!.trial_meta).toMatchObject({ trial_type: 'standard', stream: 'symbol' })
})

// R16: only the rule's stream counts, as the hint says. A match on the other stream is a lure.
test('rule symbol, place matches 2 back: A is a false alarm, on the rule event and on its own', () => {
  setup(params([trial({ rule: 'symbol', answer: { position: true, symbol: false } })]))
  advance(300)
  key('a')
  advance(1700)
  const [pos, sym] = pushed
  expect(sym).toMatchObject({ score_norm: 0, error_flag: true, response_time_ms: 300 })
  expect(sym!.trial_meta).toMatchObject({ trial_type: 'standard', rule: 'symbol', stream: 'symbol' })
  expect(pos).toMatchObject({ score_norm: 0, error_flag: true, response_time_ms: 300 })
  expect(pos!.trial_meta).toMatchObject({ trial_type: 'lure_stream', rule: 'symbol', stream: 'position' })
})

test('rule symbol, place matches 2 back: no press is a correct rejection on both events', () => {
  setup(params([trial({ rule: 'symbol', answer: { position: true, symbol: false } })]))
  advance(2000)
  expect(pushed.map((e) => [e.trial_meta?.stream, e.error_flag, e.response_time_ms])).toEqual([
    ['position', false, 2000],
    ['symbol', false, 2000],
  ])
  expect(pushed[0]!.trial_meta?.trial_type).toBe('lure_stream')
})

test('rule position, both streams match: A alone is a hit; the symbol match expects no L', () => {
  setup(params([trial({ trial_type: 'target', answer: { position: true, symbol: true } })]))
  advance(400)
  key('a')
  advance(1600)
  const [pos, sym] = pushed
  expect(pos).toMatchObject({ score_norm: 1, error_flag: false, response_time_ms: 400 })
  expect(pos!.trial_meta).toMatchObject({ trial_type: 'target', stream: 'position' })
  expect(sym).toMatchObject({ score_norm: 1, error_flag: false, response_time_ms: 2000 })
  expect(sym!.trial_meta).toMatchObject({ trial_type: 'lure_stream', stream: 'symbol' })
})

test('rule symbol: L on a symbol match is a hit; adding A makes the trial wrong', () => {
  const target = trial({ rule: 'symbol', trial_type: 'target', answer: { position: false, symbol: true } })
  setup(params([target, target]))
  advance(500)
  key('l')
  advance(1500)
  advance(200)
  key('l')
  advance(100)
  key('a')
  advance(1700)
  expect(pushed.map((e) => [e.trial_index, e.trial_meta?.stream, e.error_flag])).toEqual([
    [0, 'position', false],
    [0, 'symbol', false],
    [1, 'position', true],
    [1, 'symbol', true],
  ])
  expect(pushed[1]!.response_time_ms).toBe(500)
  expect(pushed[3]!.response_time_ms).toBe(200) // the rule key's own press
})

test('parity: L is the rule key (even number); A is off-rule', () => {
  setup(params([trial({ rule: 'parity', symbol: '4', answer: { position: true, symbol: true } })]))
  advance(300)
  key('l')
  advance(1700)
  const [pos, sym] = pushed
  expect(sym).toMatchObject({ error_flag: false, response_time_ms: 300 })
  expect(pos).toMatchObject({ error_flag: false, response_time_ms: 2000 })
  expect(pos!.trial_meta).toMatchObject({ trial_type: 'lure_stream', rule: 'parity', stream: 'position' })
})

test('a held A (key repeat) and a second press count as one response, the first', () => {
  setup(params([trial({ answer: { position: true, symbol: false } })]))
  advance(400)
  key('A')
  advance(30)
  key('A', true)
  key('A', true)
  key('A', true)
  advance(600)
  key('A') // second non-repeat press: an input, but not a new response
  advance(970)
  expect(pushed).toHaveLength(2)
  expect(pushed[0]).toMatchObject({ score_norm: 1, response_time_ms: 400, keystroke_latency_ms: 400 })
  // Repeats are not inputs: two inputs → jitter 0 (fewer than 3).
  expect(pushed[0]!.hesitation_jitter).toBe(0)
  expect(pushed[1]).toMatchObject({ score_norm: 1, response_time_ms: 2000 })
})

test('a switch trial shows the rule banner for the whole trial; parity rule hints L = even', () => {
  setup(params([trial(), trial({ rule: 'parity', trial_type: 'switch' }), trial({ rule: 'parity' })]))
  expect(screen.queryByRole('status')).toBeNull()
  advance(2000)
  expect(screen.getByRole('status').textContent).toMatch(/new rule/i)
  expect(screen.getByRole('status').textContent).toMatch(/even/i)
  advance(1900) // past stimulus_ms, still within the trial
  expect(screen.getByRole('status')).toBeTruthy()
  advance(100)
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText(/L = even/)).toBeTruthy()
})

test('the stimulus is shown for stimulus_ms only', () => {
  setup(params([trial({ symbol: '7' })]))
  expect(screen.getByText('7')).toBeTruthy()
  advance(500)
  expect(screen.queryByText('7')).toBeNull()
})

test('onDone fires once after the last trial', () => {
  const { onDone } = setup(params([trial(), trial()]))
  advance(3999)
  expect(onDone).not.toHaveBeenCalled()
  advance(1)
  expect(onDone).toHaveBeenCalledOnce()
  advance(10000)
  expect(onDone).toHaveBeenCalledOnce()
})

test('on-screen buttons respond by pointer, only for the listed streams', () => {
  setup(params([trial({ rule: 'symbol', answer: { symbol: true } })], ['symbol']))
  expect(screen.queryByRole('button', { name: 'Position match (A)' })).toBeNull()
  advance(250)
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'Symbol match (L)' })))
  key('a') // position is not a stream here: no event, no response
  advance(1750)
  expect(pushed).toHaveLength(1)
  expect(pushed[0]).toMatchObject({ score_norm: 1, response_time_ms: 250, keystroke_latency_ms: 250 })
  expect(pushed[0]!.trial_meta?.stream).toBe('symbol')
})

test('hiding the page aborts the current trial; it resumes at the next trial', () => {
  const { onDone } = setup(params([trial(), trial(), trial()]))
  advance(2500) // trial 0 done, trial 1 running
  expect(pushed).toHaveLength(2)
  const setHidden = (h: boolean) =>
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
      document.dispatchEvent(new Event('visibilitychange'))
    })
  setHidden(true)
  advance(10000)
  expect(pushed).toHaveLength(2) // trial 1 aborted, nothing scheduled while hidden
  setHidden(false)
  advance(2000)
  expect(pushed.map((e) => e.trial_index)).toEqual([0, 0, 2, 2])
  expect(onDone).toHaveBeenCalledOnce()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

test('a keyboard-activated stream button (click, detail 0) responds; Ctrl+A does not', () => {
  setup(params([trial({ rule: 'symbol', answer: { position: true, symbol: true } })]))
  advance(200)
  act(() => void fireEvent.keyDown(window, { key: 'a', ctrlKey: true }))
  const btn = screen.getByRole('button', { name: 'Symbol match (L)' })
  btn.focus()
  act(() => void fireEvent.click(btn, { detail: 0 }))
  advance(1800)
  expect(pushed).toHaveLength(2)
  expect(pushed[0]).toMatchObject({ score_norm: 1, response_time_ms: 2000 }) // position (off-rule): Ctrl+A ignored
  expect(pushed[1]).toMatchObject({ score_norm: 1, response_time_ms: 200 })
})

// The contract between the two sides: the events NBack logs, read as they are by taskScores.
test('contract: played trials score in taskScores as R16 says (off-rule press = FA on noise, miss on a target)', () => {
  const tgt = (symbol = false) => trial({ trial_type: 'target', answer: { position: true, symbol } })
  const noise = (symbol = false) => trial({ answer: { position: false, symbol } })
  const play: [Trial, string[]][] = [
    [tgt(), ['a']], // hit
    [tgt(), ['a']], // hit
    [tgt(), []], // miss
    [tgt(true), ['a', 'l']], // A plus an off-rule L on a symbol lure: a miss, not a hit plus a FA
    [noise(), []], // correct rejection
    [noise(true), ['l']], // L on a symbol lure: false alarm
    [noise(), ['a']], // false alarm
    [noise(true), []], // withheld on a symbol lure: correct rejection
    [noise(), []],
    [noise(), []],
  ]
  setup(params(play.map(([t]) => t)))
  for (const [, keys] of play) {
    advance(300)
    for (const k of keys) key(k)
    advance(1700)
  }
  expect(pushed).toHaveLength(20)
  const s = taskScores(pushed)
  expect(s.OSPAN).toEqual({ score: expect.closeTo(25 * dPrime(2, 4, 2, 6), 6), trials: 10 })
  // Rule-event errors at trials 2, 3, 5, 6: after them 3 wrong, 4 right, 6 wrong, 7 right -> 2 / 4.
  expect(s.ErrorRecovery).toEqual({ score: 50, trials: 4 })
})

const HEX_OR_FN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/

test('no element carries a hex or rgb() colour in its style or paint attributes', () => {
  setup(params([trial({ pos: [1, 1] })]))
  const painted = document.querySelectorAll('[style], [fill], [stroke]')
  expect(painted.length).toBeGreaterThan(0)
  for (const el of painted)
    for (const a of ['style', 'fill', 'stroke']) expect(el.getAttribute(a) ?? '').not.toMatch(HEX_OR_FN)
})

test('the lit grid cell uses a theme token', () => {
  setup(params([trial({ pos: [0, 2] })]))
  const fills = [...document.querySelectorAll('rect')].map((r) => r.getAttribute('fill'))
  expect(fills.filter((f) => f === 'var(--dim-1)')).toHaveLength(1)
})
