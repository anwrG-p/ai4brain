import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EXERCISE_NAME } from './exercises'
import { ExerciseFrame, FIXATION_MS } from './ExerciseFrame'
import fixtures from './tasks/fixtures.json'
import { TaskRunner } from './tasks/TaskRunner'
import { tracker, TrialRecorder } from './telemetry/tracker'
import type { SchemaType, TaskPayload } from './telemetry/types'

const byType = (s: SchemaType) => (fixtures as TaskPayload[]).find((t) => t.schema_type === s)!

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  tracker.clear()
})

// The real exercise inside the frame, as ExerciseHost mounts it.
function setup(schema: SchemaType = 'stroop') {
  const task = byType(schema)
  const recorder = new TrialRecorder({ ...task, user_id: 'u', session_id: 's', voice_opt_in: false })
  const start = vi.spyOn(recorder, 'start')
  const push = vi.spyOn(tracker, 'push') // calls through, so tracker.onEvent listeners still hear it
  const onDone = vi.fn()
  const view = render(
    <ExerciseFrame task={task} onDone={onDone}>
      {(end) => <TaskRunner task={task} recorder={recorder} onDone={end} />}
    </ExerciseFrame>,
  )
  return { ...view, task, start, push, onDone }
}

const space = () => act(() => void fireEvent.keyDown(window, { key: ' ' }))
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const region = () => screen.queryByRole('region', { name: 'Color Clash' })

test('the instruction screen shows the consumer name, one line and the keys as keycaps', () => {
  const { container } = setup('stroop')
  expect(screen.getByRole('heading', { name: 'Color Clash' })).toBeInTheDocument()
  expect(screen.getByText('Pick the color of the ink, not the word.')).toBeInTheDocument()
  const keys = [...container.querySelectorAll('kbd')].map((k) => k.textContent)
  expect(keys).toEqual(expect.arrayContaining(['1', '2', '3', '4', 'Space']))
  expect(screen.getAllByRole('button')).toHaveLength(1) // Begin only (anti-slop rule 14)
  expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument()
  expect(region()).toBeNull() // the exercise is not mounted yet
})

test('Space starts the exercise after a 500 ms fixation cross', () => {
  setup('stroop')
  space()
  expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull()
  expect(screen.getByRole('img', { name: 'Look at the cross' })).toHaveTextContent('+')
  advance(FIXATION_MS - 1)
  expect(region()).toBeNull()
  advance(1)
  expect(screen.queryByRole('img', { name: 'Look at the cross' })).toBeNull()
  expect(region()).toBeInTheDocument()
  expect(FIXATION_MS).toBe(500)
})

test('Enter and the Begin button start it too; a held key does not', () => {
  setup('stroop')
  act(() => void fireEvent.keyDown(window, { key: ' ', repeat: true }))
  expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument()
  act(() => void fireEvent.keyDown(window, { key: 'Enter' }))
  expect(screen.getByRole('img', { name: 'Look at the cross' })).toBeInTheDocument()

  const other = setup('matrix')
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'Begin' })))
  advance(FIXATION_MS)
  expect(screen.getByRole('region', { name: 'Pattern Puzzle' })).toBeInTheDocument()
  other.unmount()
})

test('Space on a focused control stays with that control', () => {
  const task = byType('stroop')
  render(
    <>
      <button type="button">Pause</button>
      <ExerciseFrame task={task} onDone={vi.fn()}>
        {() => null}
      </ExerciseFrame>
    </>,
  )
  act(() => void fireEvent.keyDown(screen.getByRole('button', { name: 'Pause' }), { key: ' ' }))
  expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument()
})

test('no trial starts and no telemetry event is sent during the instruction or the fixation', () => {
  const { start, push } = setup('stroop')
  advance(10_000) // idle on the instruction screen: Stroop's 2.5 s limit would have fired
  space()
  advance(FIXATION_MS - 1)
  expect(start).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
  advance(1)
  expect(start).toHaveBeenCalledWith(0)
})

test('the progress dots advance as trials finish (n of N)', () => {
  const { task } = setup('stroop')
  space()
  advance(FIXATION_MS)
  const bar = screen.getByRole('progressbar', { name: 'Progress' })
  const n = (task.params as { trials: unknown[] }).trials.length
  expect(bar).toHaveAttribute('aria-valuemax', String(n))
  expect(bar).toHaveAttribute('aria-valuenow', '0')
  expect(bar.querySelectorAll('[data-dot]')).toHaveLength(n)
  expect(bar.querySelectorAll('[data-dot="done"]')).toHaveLength(0)

  act(() => void fireEvent.pointerDown(screen.getAllByRole('button')[0]!))
  expect(bar).toHaveAttribute('aria-valuenow', '1')
  expect(bar).toHaveAttribute('aria-valuetext', `1 of ${n} done`)
  expect(bar.querySelectorAll('[data-dot="done"]')).toHaveLength(1)
})

test('UFOV skips the frame fixation: it draws its own', () => {
  setup('ufov')
  space()
  expect(screen.queryByRole('img', { name: 'Look at the cross' })).toBeNull()
  expect(screen.getByRole('region', { name: 'Perceptual Radar' })).toBeInTheDocument()
})

test('MST: the instruction comes before its study phase', () => {
  setup('mst')
  expect(screen.queryByText(/Study: item/)).toBeNull()
  space()
  advance(FIXATION_MS)
  expect(screen.getByText('Study: item 1 of 3')).toBeInTheDocument()
})

test('the end card shows one line and a small Loti; Continue (or Space) hands over', () => {
  const task = byType('matrix')
  const onDone = vi.fn()
  render(
    <ExerciseFrame task={task} onDone={onDone}>
      {(end) => (
        <button type="button" onClick={end}>
          finish
        </button>
      )}
    </ExerciseFrame>,
  )
  space()
  advance(FIXATION_MS)
  // No character and no decoration while trials run.
  expect(screen.queryByRole('img', { name: /Loti/ })).toBeNull()
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'finish' })))
  expect(screen.queryByRole('button', { name: 'finish' })).toBeNull()
  expect(screen.getByText('Nice work')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Loti/ })).toHaveAttribute('width', '48') // size sm
  expect(onDone).not.toHaveBeenCalled()
  act(() => void fireEvent.keyDown(window, { key: ' ' }))
  expect(onDone).toHaveBeenCalledOnce()
  act(() => void fireEvent.click(screen.getByRole('button', { name: 'Continue' })))
  expect(onDone).toHaveBeenCalledOnce() // once only
})

test.each(Object.entries(EXERCISE_NAME))('%s is introduced as %s', (schema, name) => {
  setup(schema as SchemaType)
  expect(screen.getByRole('heading', { name })).toBeInTheDocument()
})

test('the consumer names are the spec table', () => {
  expect(EXERCISE_NAME).toEqual({
    relational: 'Logic Web',
    n_back: 'Memory Gauntlet',
    tower: 'Strategic Blueprint',
    ufov: 'Perceptual Radar',
    mst: 'Precision Archive',
    stroop: 'Color Clash',
    matrix: 'Pattern Puzzle',
    mental_rotation: 'Shape Turn',
  })
})

test('an unknown exercise skips the frame and runs as before', () => {
  const task = { ...byType('stroop'), schema_type: 'bogus' } as unknown as TaskPayload
  render(<ExerciseFrame task={task} onDone={vi.fn()}>{() => <p>raw task</p>}</ExerciseFrame>)
  expect(screen.getByText('raw task')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull()
})
