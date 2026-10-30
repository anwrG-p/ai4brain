import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ExerciseHost } from './ExerciseHost'
import fixtures from './tasks/fixtures.json'
import { getUserId } from './tasks/taskSource'
import { tracker } from './telemetry/tracker'
import type { TaskPayload, TelemetryEvent } from './telemetry/types'

const stroop = (fixtures as TaskPayload[]).find((t) => t.schema_type === 'stroop')!

let pushed: TelemetryEvent[]

beforeEach(() => {
  pushed = []
  vi.spyOn(tracker, 'push').mockImplementation((e) => void pushed.push(e))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const host = (attempt: number, onError = vi.fn()) => (
  <ExerciseHost schemaType="stroop" attempt={attempt} onDone={vi.fn()} onError={onError} />
)

// Stroop answers on pointerdown (pressProps); any colour button ends the trial.
const answer = () => act(() => void fireEvent.pointerDown(screen.getAllByRole('button')[0]!))

test('mock mode with schemaType stroop renders the Stroop exercise inside a timed-trial container', async () => {
  render(host(0))
  const region = await screen.findByRole('region', { name: 'Color naming' })
  expect(region.closest('[data-timed-trial="true"]')).not.toBeNull()
})

test('an answer pushes an event whose dimension comes from the task payload (R1)', async () => {
  render(host(0))
  await screen.findByRole('region', { name: 'Color naming' })
  answer()
  expect(pushed).toHaveLength(1)
  expect(pushed[0]).toMatchObject({
    dimension: stroop.dimension,
    user_id: getUserId(),
    voice_opt_in: false,
    trial_index: 0,
  })
})

test('bumping attempt fetches a fresh task: new task_id and item_id, same session (R3)', async () => {
  const { rerender } = render(host(0))
  await screen.findByRole('region', { name: 'Color naming' })
  answer()
  rerender(host(1))
  await waitFor(() => expect(screen.getByRole('region', { name: 'Color naming' })).toBeInTheDocument())
  // The new task mounts from scratch, so its first trial is trial 0 again.
  await waitFor(() => expect(screen.getAllByRole('button')).not.toHaveLength(0))
  answer()
  expect(pushed).toHaveLength(2)
  const [a, b] = pushed as [TelemetryEvent, TelemetryEvent]
  expect(b.trial_index).toBe(0)
  expect(b.task_id).not.toBe(a.task_id)
  expect(b.trial_meta?.item_id).not.toBe(a.trial_meta?.item_id)
  expect(b.session_id).toBe(a.session_id)
})

test('real mode keeps the generator task_id and reports a failed fetch through onError', async () => {
  vi.stubEnv('VITE_USE_MOCKS', 'false')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ...stroop, task_id: 'gen-42' }), { status: 200 })),
  )
  render(host(0))
  await screen.findByRole('region', { name: 'Color naming' })
  answer()
  expect(pushed[0]?.task_id).toBe('gen-42')

  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
  const onError = vi.fn()
  render(host(1, onError))
  await waitFor(() => expect(onError).toHaveBeenCalledWith('GET /v1/tasks/next failed: HTTP 503'))
})
