import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { TrialRecorder } from '../telemetry/tracker'
import type { TaskPayload } from '../telemetry/types'
import fixtures from './fixtures.json'
import { TaskRunner } from './TaskRunner'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('a schema_type without a component shows "Unsupported task" and then calls onDone', () => {
  vi.useFakeTimers()
  const task = { task_id: 't', dimension: 'working_memory', schema_type: 'bogus', params: {}, surface_seed: 0 }
  const recorder = new TrialRecorder({ ...task, user_id: 'u', session_id: 's', voice_opt_in: false } as never)
  const onDone = vi.fn()
  render(<TaskRunner task={task as unknown as TaskPayload} recorder={recorder} onDone={onDone} />)
  expect(screen.getByText(/Unsupported task/)).toBeTruthy()
  expect(onDone).not.toHaveBeenCalled()
  act(() => void vi.runAllTimers())
  expect(onDone).toHaveBeenCalledOnce()
})

test.each([
  ['stroop', 'Color naming'],
  ['matrix', 'Pattern puzzle'],
  ['mental_rotation', 'Shape turning'],
])('%s renders its task component', (schemaType, name) => {
  const task = (fixtures as TaskPayload[]).find((t) => t.schema_type === schemaType)!
  const recorder = new TrialRecorder({ ...task, user_id: 'u', session_id: 's', voice_opt_in: false })
  render(<TaskRunner task={task} recorder={recorder} onDone={vi.fn()} />)
  expect(screen.getByRole('region', { name })).toBeTruthy()
})
