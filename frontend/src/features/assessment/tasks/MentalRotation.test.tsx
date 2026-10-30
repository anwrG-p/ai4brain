import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { RotationParams, TelemetryEvent } from '../telemetry/types'
import { MentalRotation } from './MentalRotation'

type Trial = RotationParams['trials'][number]
const L: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1]]
const same: Trial = { cells: L, angle_deg: 90, mirrored: false, answer: 'same' }
const different: Trial = { cells: L, angle_deg: 180, mirrored: true, answer: 'different' }
const params = (trials: Trial[]): RotationParams => ({ trials, time_limit_ms: 7000 })

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

function setup(p: RotationParams) {
  const recorder = new TrialRecorder({
    user_id: 'u',
    session_id: 's',
    task_id: 't',
    dimension: 'spatial_orientation',
    voice_opt_in: false,
  })
  const onDone = vi.fn()
  render(<MentalRotation params={p} recorder={recorder} onDone={onDone} />)
  return { onDone }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const key = (k: string, repeat = false) => act(() => void fireEvent.keyDown(window, { key: k, repeat }))

test('shows the original and the transformed shape side by side', () => {
  setup(params([different]))
  const [orig, moved] = screen.getAllByRole('img')
  expect(orig!.querySelector('g')?.getAttribute('transform')).toBe('rotate(0 1.75 0.75)')
  expect(moved!.querySelector('g')?.getAttribute('transform')).toMatch(/^rotate\(180 .*scale\(-1 1\)$/)
})

test('J on a different trial scores 1, F on a same trial scores 1, J on same scores 0', () => {
  const { onDone } = setup(params([different, same, same]))
  advance(800)
  key('j')
  key('F', true) // repeat: ignored
  advance(600)
  key('F')
  key('j') // second press on the next trial
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 1, 0])
  expect(pushed[0]).toMatchObject({ trial_index: 0, response_time_ms: 800 })
  expect(pushed[1]).toMatchObject({ trial_index: 1, response_time_ms: 600 })
  expect(onDone).toHaveBeenCalledOnce()
})

test('trial_meta carries the trial angle_deg and mirrored flag (also on timeout)', () => {
  setup(params([same, different]))
  key('f')
  advance(7000)
  expect(pushed.map((e) => e.trial_meta)).toEqual([
    { item_id: 't:0', angle_deg: 90, mirrored: false },
    { item_id: 't:1', angle_deg: 180, mirrored: true },
  ])
})

test('on-screen buttons answer too; a timeout scores 0 at time_limit_ms', () => {
  setup(params([same, different]))
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: /same/i })))
  advance(7000)
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 0])
  expect(pushed[1]!.response_time_ms).toBe(7000)
})

test('keyboard activation of a button answers once; Ctrl+F / Meta+J are not responses', () => {
  setup(params([different, same]))
  act(() => {
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'j', metaKey: true })
  })
  expect(pushed).toHaveLength(0)
  const btn = screen.getByRole('button', { name: /different/i })
  btn.focus()
  act(() => void fireEvent.click(btn, { detail: 0 }))
  expect(pushed).toHaveLength(1)
  expect(pushed[0]).toMatchObject({ trial_index: 0, score_norm: 1 })
})

const HEX_OR_FN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/

test('no element carries a hex or rgb() colour in its style or paint attributes', () => {
  setup(params([different]))
  const painted = document.querySelectorAll('[style], [fill], [stroke]')
  expect(painted.length).toBeGreaterThan(0)
  for (const el of painted)
    for (const a of ['style', 'fill', 'stroke']) expect(el.getAttribute(a) ?? '').not.toMatch(HEX_OR_FN)
})
