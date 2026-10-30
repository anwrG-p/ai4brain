import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { MstParams, Poly, TelemetryEvent } from '../telemetry/types'
import { Mst } from './Mst'

const tri: Poly = { points: [[0, 0], [1, 0], [0.5, 1]], edges: [[0, 1], [1, 2], [2, 0]] }
const params = (p: Partial<MstParams> = {}): MstParams => ({
  encode_ms: 1000,
  encode: [tri, tri],
  test: [
    { item: tri, kind: 'lure', delta: 0.3 },
    { item: tri, kind: 'old', delta: 0 },
    { item: tri, kind: 'new', delta: 0 },
  ],
  ...p,
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

function setup(p: MstParams) {
  const recorder = new TrialRecorder({
    user_id: 'u',
    session_id: 's',
    task_id: 't',
    dimension: 'episodic_memory',
    voice_opt_in: false,
  })
  const start = vi.spyOn(recorder, 'start')
  const onDone = vi.fn()
  render(<Mst params={p} recorder={recorder} onDone={onDone} />)
  return { onDone, start }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }))
const setHidden = (hidden: boolean) =>
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    document.dispatchEvent(new Event('visibilitychange'))
  })

test('encoding shows each item for encode_ms with no events, no responses and no recorder.start', () => {
  const { start } = setup(params())
  expect(screen.getByText('Study: item 1 of 2')).toBeTruthy()
  expect(screen.getByLabelText('Study shape')).toBeTruthy()
  key('1')
  advance(999)
  expect(screen.getByText('Study: item 1 of 2')).toBeTruthy()
  advance(1)
  expect(screen.getByText('Study: item 2 of 2')).toBeTruthy()
  key('2')
  expect(screen.queryByRole('button')).toBeNull()
  expect(pushed).toHaveLength(0)
  expect(start).not.toHaveBeenCalled()
  advance(1000)
  expect(screen.getByLabelText('Test shape')).toBeTruthy()
  expect(start).toHaveBeenCalledOnce()
})

test('a hidden page pauses the encoding timer; it resumes when visible, with no events', () => {
  setup(params())
  advance(600)
  setHidden(true)
  advance(5000)
  expect(screen.getByText('Study: item 1 of 2')).toBeTruthy()
  setHidden(false)
  advance(399)
  expect(screen.getByText('Study: item 1 of 2')).toBeTruthy()
  advance(1)
  expect(screen.getByText('Study: item 2 of 2')).toBeTruthy()
  expect(pushed).toHaveLength(0)
  setHidden(false)
})

test('a lure answered "similar" scores 1; answered "old" scores 0 with response "old"', () => {
  setup(params({ encode: [], test: [{ item: tri, kind: 'lure', delta: 0.3 }, { item: tri, kind: 'lure', delta: 0.15 }] }))
  key('2')
  key('1')
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 0])
  expect(pushed[0]!.trial_meta).toEqual({ item_id: 't:0', kind: 'lure', delta: 0.3, response: 'similar' })
  expect(pushed[1]!.trial_meta).toEqual({ item_id: 't:1', kind: 'lure', delta: 0.15, response: 'old' })
})

test('events carry delta; old -> Old and new -> New are correct; buttons answer', () => {
  const { onDone } = setup(params({ encode: [] }))
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'Similar (2)' })))
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'Old (1)' })))
  act(() => void fireEvent.pointerDown(screen.getByRole('button', { name: 'New (3)' })))
  expect(pushed.map((e) => e.trial_meta?.delta)).toEqual([0.3, 0, 0])
  expect(pushed.map((e) => e.trial_meta?.response)).toEqual(['similar', 'old', 'new'])
  expect(pushed.map((e) => e.score_norm)).toEqual([1, 1, 1])
  expect(onDone).toHaveBeenCalledOnce()
})

test('a timeout after 5000 ms scores 0 with response "none"; held keys and modifiers are ignored', () => {
  setup(params({ encode: [] }))
  act(() => {
    fireEvent.keyDown(window, { key: '2', repeat: true })
    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    fireEvent.keyDown(window, { key: '2', altKey: true })
  })
  expect(pushed).toHaveLength(0)
  advance(5000)
  expect(pushed[0]).toMatchObject({ score_norm: 0, response_time_ms: 5000 })
  expect(pushed[0]!.trial_meta).toMatchObject({ kind: 'lure', response: 'none' })
  key('1')
  expect(pushed[1]!.trial_meta?.response).toBe('old')
})

const HEX_OR_FN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/

test('no element carries a hex or rgb() colour in its style or paint attributes, in encoding and test', () => {
  setup(params())
  const check = () => {
    const painted = document.querySelectorAll('[style], [fill], [stroke]')
    expect(painted.length).toBeGreaterThan(0)
    for (const el of painted)
      for (const a of ['style', 'fill', 'stroke']) expect(el.getAttribute(a) ?? '').not.toMatch(HEX_OR_FN)
  }
  check()
  advance(1000) // each item re-arms its own timer after a render
  advance(1000)
  expect(screen.getByLabelText('Test shape')).toBeTruthy()
  check()
})

test('the encoding phase is a labelled region with a text-labelled study shape and no unlabelled controls', () => {
  setup(params())
  const region = screen.getByRole('region', { name: 'Shape memory' })
  expect(region).toContainElement(screen.getByRole('img', { name: 'Study shape' }))
  expect(region.querySelectorAll('button, input, a')).toHaveLength(0)
})
