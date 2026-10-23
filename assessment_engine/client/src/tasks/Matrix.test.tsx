import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrialRecorder, tracker } from '../telemetry/tracker'
import type { Glyph, MatrixParams, TelemetryEvent } from '../telemetry/types'
import { Matrix } from './Matrix'

const g = (shape: Glyph['shape'], count: Glyph['count'], color: string): Glyph => ({ shape, count, color, rotation_deg: 0 })

const params: MatrixParams = {
  time_limit_ms: 30000,
  cells: [
    g('circle', 1, 'blue'), g('circle', 2, 'blue'), g('circle', 3, 'blue'),
    g('square', 1, 'green'), g('square', 2, 'green'), g('square', 3, 'green'),
    g('triangle', 1, 'red'), g('triangle', 2, 'red'), null,
  ],
  options: [g('triangle', 2, 'red'), g('square', 3, 'red'), g('triangle', 3, 'red'), g('triangle', 3, 'green')],
  answer: 2,
}

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

function setup() {
  const recorder = new TrialRecorder({
    user_id: 'u',
    session_id: 's',
    task_id: 't',
    dimension: 'pattern_induction',
    voice_opt_in: false,
  })
  const onDone = vi.fn()
  render(<Matrix params={params} recorder={recorder} onDone={onDone} />)
  return { onDone }
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const pick = (k: number) => act(() => void fireEvent.pointerDown(screen.getAllByRole('button')[k]))

test('the grid shows 8 glyphs and a "?" in the empty cell; options sit below', () => {
  setup()
  const grid = screen.getByRole('group', { name: 'puzzle' })
  expect(within(grid).getAllByRole('img')).toHaveLength(8)
  expect(within(grid).getByText('?')).toBeTruthy()
  expect(screen.getAllByRole('button')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /3 red triangles/ })).toBeTruthy()
})

test('clicking options[answer] scores 1 as trial 0, then onDone', () => {
  const { onDone } = setup()
  const buttons = screen.getAllByRole('button')
  advance(1200)
  pick(params.answer)
  act(() => void fireEvent.pointerDown(buttons[0])) // a second click is ignored
  expect(pushed).toHaveLength(1)
  expect(pushed[0]).toMatchObject({ trial_index: 0, score_norm: 1, response_time_ms: 1200 })
  expect(onDone).toHaveBeenCalledOnce()
})

test('a wrong option scores 0; a timeout scores 0 at time_limit_ms', () => {
  setup()
  pick(0)
  expect(pushed[0]).toMatchObject({ score_norm: 0, error_flag: true })
  cleanup()
  pushed = []
  setup()
  advance(30000)
  expect(pushed).toHaveLength(1)
  expect(pushed[0]).toMatchObject({ score_norm: 0, response_time_ms: 30000 })
})
