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

// Ported schemas render their exercise (a labelled region); the rest fall back to the skip.
// ponytail: ticket 06 adds its four schemas to this map.
const PORTED: Record<string, string> = {
  n_back: 'Memory Sharpness',
  stroop: 'Color naming',
  matrix: 'Pattern puzzle',
  mental_rotation: 'Shape turning',
}

test.each((fixtures as TaskPayload[]).filter((t) => t.schema_type in PORTED).map((t) => [t.schema_type, t] as const))(
  '%s renders its exercise',
  (schemaType, task) => {
    render(<TaskRunner task={task} recorder={recorderFor(task)} onDone={vi.fn()} />)
    expect(screen.getByRole('region', { name: PORTED[schemaType] })).toBeInTheDocument()
    expect(screen.queryByText(/Unsupported task/)).toBeNull()
  },
)

test.each((fixtures as TaskPayload[]).filter((t) => !(t.schema_type in PORTED)).map((t) => [t.schema_type, t] as const))(
  '%s falls back to the skip until its component is ported',
  (schemaType, task) => {
    render(<TaskRunner task={task} recorder={recorderFor(task)} onDone={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(`Unsupported task (${schemaType})`)
  },
)
