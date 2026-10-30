import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { RelationalParams, TelemetryEvent } from '../telemetry/types'
import { Relational } from './Relational'

type Trial = RelationalParams['levels'][number][number]
const trial = (hops: number, inverted = false, answer = true): Trial => ({
  premises: [{ a: 'ZUP', rel: 'same', b: 'KEV' }],
  question: { a: 'KEV', rel: 'same', b: 'ZUP' },
  inverted,
  hops,
  answer,
})
// Level k holds trials with hops k+1, so `hops` identifies the level a shown trial came from.
const levels = [[trial(1)], [trial(2)], [trial(3)], [trial(4)], [trial(5)]]
const params = (p: Partial<RelationalParams> = {}): RelationalParams => ({ n_trials: 5, time_limit_ms: 10000, levels, ...p })

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

function setup(p: RelationalParams) {
  const recorder = new TrialRecorder({
    user_id: 'u',
    session_id: 's',
    task_id: 't',
    dimension: 'pattern_induction',
    voice_opt_in: false,
  })
  const onDone = vi.fn()
  render(<Relational params={p} recorder={recorder} onDone={onDone} />)
  return { onDone }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }))

test('three correct answers in a row move the shown trials up the staircase', () => {
  setup(params())
  key('t')
  key('t')
  key('t')
  key('t')
  expect(pushed.map((e) => e.trial_meta?.level)).toEqual([0, 1, 2, 3])
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 1, 1, 1])
})

test('an error drops the level; a timeout counts as an error', () => {
  setup(params({ levels: [[trial(1)], [trial(2)], [trial(3)], [trial(4)]] }))
  key('t')
  key('t')
  key('t') // level 3 now
  advance(10000) // timeout: incorrect, window as RT
  key('f') // answer is true: incorrect
  expect(pushed.map((e) => e.trial_meta?.level)).toEqual([0, 1, 2, 3, 0])
  expect(pushed[3]).toMatchObject({ score_norm: 0, response_time_ms: 10000 })
  expect(pushed[4]!.score_norm).toBe(0)
})

test('an exhausted level wraps around to its first trial', () => {
  const a = trial(1, false, true)
  const b = trial(2, false, false)
  setup(params({ n_trials: 3, levels: [[a, b]] }))
  key('t')
  key('t')
  key('t')
  expect(pushed.map((e) => e.trial_meta?.hops)).toEqual([1, 2, 1])
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 0, 1])
})

test('an inverted trial shows the "Rule inverted" label; a normal one does not', () => {
  setup(params({ n_trials: 2, levels: [[trial(1, true)], [trial(2, false)]] }))
  expect(screen.getByText('Rule inverted')).toBeTruthy()
  key('t')
  expect(screen.queryByText('Rule inverted')).toBeNull()
})

test('events carry hops, inverted and level from the trial', () => {
  setup(params({ n_trials: 1, levels: [[trial(3, true, false)]] }))
  key('f')
  expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', hops: 3, inverted: true, level: 0 })
  expect(pushed[0]!.score_norm).toBe(1)
})

test('premises render as sentences; more/less as arrows with a text alternative', () => {
  setup(
    params({
      n_trials: 1,
      levels: [
        [
          {
            premises: [
              { a: 'ZUP', rel: 'opposite', b: 'KEV' },
              { a: 'MIB', rel: 'more', b: 'ZUP' },
              { a: 'KEV', rel: 'contains', b: 'DAX' },
            ],
            question: { a: 'MIB', rel: 'less', b: 'DAX' },
            inverted: false,
            hops: 2,
            answer: false,
          },
        ],
      ],
    }),
  )
  expect(screen.getByText('ZUP is OPPOSITE to KEV')).toBeTruthy()
  expect(screen.getByText('MIB ▷ ZUP')).toBeTruthy()
  expect(screen.getByText('MIB ▷ ZUP').getAttribute('aria-hidden')).toBe('true')
  expect(screen.getByText('MIB is more than ZUP')).toBeTruthy() // visually hidden text alternative
  expect(screen.getByText('MIB is more than ZUP').className).toBe('sr-only')
  expect(screen.getByText('MIB is more than ZUP').getAttribute('style')).toBeNull()
  expect(screen.getByText('KEV CONTAINS DAX')).toBeTruthy()
  expect(screen.getByText('Is MIB ◁ DAX?')).toBeTruthy()
  expect(screen.getByText('Is MIB less than DAX?')).toBeTruthy()
})

test('True/False buttons answer; held keys and modifiers do not', () => {
  const { onDone } = setup(params({ n_trials: 2 }))
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'True (T)' })))
  act(() => {
    fireEvent.keyDown(window, { key: 't', repeat: true })
    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
  })
  expect(pushed).toHaveLength(1)
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'False (F)' })))
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 0])
  expect(onDone).toHaveBeenCalledOnce()
})

test('empty levels are skipped: the nearest non-empty level is used', () => {
  setup(params({ n_trials: 3, levels: [[trial(1)], [], [trial(3)]] }))
  key('t') // level 0 -> staircase 1 (empty) -> nearest non-empty
  key('t')
  key('t')
  expect(pushed.map((e) => e.trial_meta?.hops)).toEqual([1, 1, 3])
  expect(pushed.map((e) => e.trial_meta?.level)).toEqual([0, 0, 2])
})

test('no non-empty level: onDone right away, no events', () => {
  for (const lv of [[], [[], []]]) {
    const { onDone } = setup(params({ levels: lv }))
    advance(20000)
    expect(onDone).toHaveBeenCalledOnce()
    expect(pushed).toHaveLength(0)
    cleanup()
  }
})

const HEX_OR_FN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/

test('no element carries a hex or rgb() colour in its style or class (an inverted trial included)', () => {
  setup(params({ n_trials: 1, levels: [[trial(1, true)]] }))
  const all = document.querySelectorAll('section, section *')
  expect(all.length).toBeGreaterThan(0)
  for (const el of all) {
    expect(el.getAttribute('style') ?? '').not.toMatch(HEX_OR_FN)
    expect(el.getAttribute('class') ?? '').not.toMatch(HEX_OR_FN)
  }
})
