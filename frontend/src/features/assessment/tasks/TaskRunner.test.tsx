import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { TrialRecorder } from '../telemetry/tracker'
import type { TaskPayload } from '../telemetry/types'
import fixtures from './fixtures.json'
import { TaskRunner } from './TaskRunner'

afterEach(() => {
  vi.useRealTimers()
})

const recorderFor = (task: TaskPayload) =>
  new TrialRecorder({ ...task, user_id: 'u', session_id: 's', voice_opt_in: false })

test('a schema_type without a component shows "Unsupported task" and then calls onDone after 1.5 s', () => {
  vi.useFakeTimers()
  const task = { task_id: 't', dimension: 'working_memory', schema_type: 'bogus', params: {}, surface_seed: 0 }
  const onDone = vi.fn()
  render(<TaskRunner task={task as unknown as TaskPayload} recorder={recorderFor(task as unknown as TaskPayload)} onDone={onDone} />)
  expect(screen.getByRole('status')).toHaveTextContent(/Unsupported task \(bogus\)/)
  act(() => void vi.advanceTimersByTime(1499))
  expect(onDone).not.toHaveBeenCalled()
  act(() => void vi.advanceTimersByTime(1))
  expect(onDone).toHaveBeenCalledOnce()
})

test('unmounting before the skip fires never calls onDone', () => {
  vi.useFakeTimers()
  const task = (fixtures as TaskPayload[])[0]!
  const onDone = vi.fn()
  const { unmount } = render(<TaskRunner task={task} recorder={recorderFor(task)} onDone={onDone} />)
  unmount()
  act(() => void vi.runAllTimers())
  expect(onDone).not.toHaveBeenCalled()
})

// Every schema renders its exercise (a labelled region); unknown ones fall back to the skip (above).
const PORTED: Record<string, string> = {
  n_back: 'Memory Gauntlet',
  stroop: 'Color Clash',
  matrix: 'Pattern Puzzle',
  mental_rotation: 'Shape Turn',
  relational: 'Logic Web',
  tower: 'Strategic Blueprint',
  ufov: 'Perceptual Radar',
  mst: 'Precision Archive',
}

test('the fixture schemas and the ported components are the same set', () => {
  const fixtureSchemas = (fixtures as TaskPayload[]).map((t) => t.schema_type)
  expect(new Set(fixtureSchemas)).toEqual(new Set(Object.keys(PORTED)))
})

test.each((fixtures as TaskPayload[]).map((t) => [t.schema_type, t] as const))('%s renders its exercise', (schemaType, task) => {
  render(<TaskRunner task={task} recorder={recorderFor(task)} onDone={vi.fn()} />)
  expect(screen.getByRole('region', { name: PORTED[schemaType] })).toBeInTheDocument()
  expect(screen.queryByText(/Unsupported task/)).toBeNull()
})
