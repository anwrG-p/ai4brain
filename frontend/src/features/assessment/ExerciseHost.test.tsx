import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ExerciseHost } from './ExerciseHost'
import fixtures from './tasks/fixtures.json'
import { getUserId } from './tasks/taskSource'
import { tracker } from './telemetry/tracker'
import type { TaskPayload, TelemetryEvent } from './telemetry/types'
import { begin } from '../../tests/exerciseFrame'

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
  const region = await begin('Color Clash')
  expect(region.closest('[data-timed-trial="true"]')).not.toBeNull()
})

test('the task opens on its instruction screen: no exercise and no event until Begin', async () => {
  render(host(0))
  expect(await screen.findByRole('heading', { name: 'Color Clash' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Color Clash' })).toBeNull()
  expect(pushed).toHaveLength(0)
  await begin('Color Clash')
})

test('an answer pushes an event whose dimension comes from the task payload (R1)', async () => {
  render(host(0))
  await begin('Color Clash')
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
  await begin('Color Clash')
  answer()
  rerender(host(1))
  await begin('Color Clash') // a fresh task opens on its instruction screen again
  // The new task mounts from scratch, so its first trial is trial 0 again.
  await waitFor(() => expect(screen.getAllByRole('button')).not.toHaveLength(0))
  answer()
  expect(pushed).toHaveLength(2)
  const [a, b] = pushed as [TelemetryEvent, TelemetryEvent]
  expect(b.trial_index).toBe(0)
  expect(b.task_id).not.toBe(a.task_id)
  expect(b.trial_meta?.item_id).not.toBe(a.trial_meta?.item_id)
  expect(b.session_id).toBe(a.session_id)
  // The fixture id carries a session token too, so a reload (new session) never repeats it.
  expect(a.task_id.startsWith(`${stroop.task_id}.${a.session_id.slice(0, 8)}.`)).toBe(true)
  expect(a.task_id.length).toBeLessThanOrEqual(48) // server task_id limit
})

test('a remount with the same attempt still gets a new task_id (page remounts restart attempt at 0)', async () => {
  const first = render(host(0))
  await begin('Color Clash')
  answer()
  first.unmount()
  render(host(0))
  await begin('Color Clash')
  answer()
  const [a, b] = pushed as [TelemetryEvent, TelemetryEvent]
  expect(b.task_id).not.toBe(a.task_id)
  expect(b.trial_meta?.item_id).not.toBe(a.trial_meta?.item_id)
})

test('unmounting during an in-flight fetch never calls onError and never renders the task', async () => {
  vi.stubEnv('VITE_USE_MOCKS', 'false')
  const pending: ((r: Response) => void)[] = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => void pending.push(resolve))))
  const errSpy = vi.spyOn(console, 'error')
  const onError = vi.fn()

  const failing = render(host(0, onError))
  failing.unmount()
  await act(async () => pending[0]!(new Response('', { status: 503 })))
  expect(onError).not.toHaveBeenCalled()

  const loading = render(host(1, onError))
  loading.unmount()
  await act(async () => pending[1]!(new Response(JSON.stringify(stroop), { status: 200 })))
  expect(screen.queryByRole('region', { name: 'Color Clash' })).toBeNull()
  expect(onError).not.toHaveBeenCalled()
  expect(errSpy).not.toHaveBeenCalled()
})

test('real mode keeps the generator task_id and reports a failed fetch through onError', async () => {
  vi.stubEnv('VITE_USE_MOCKS', 'false')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ...stroop, task_id: 'gen-42' }), { status: 200 })),
  )
  render(host(0))
  await begin('Color Clash')
  answer()
  expect(pushed[0]?.task_id).toBe('gen-42')

  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
  const onError = vi.fn()
  render(host(1, onError))
  await waitFor(() => expect(onError).toHaveBeenCalledWith('GET /v1/tasks/next failed: HTTP 503'))
})

test('prepare reshapes the fetched task, and onTask hears the task that runs (its final task_id)', async () => {
  const onTask = vi.fn()
  const prepare = (t: TaskPayload): TaskPayload => {
    const p = t.params as { trials: unknown[] }
    return { ...t, params: { ...p, trials: p.trials.slice(0, 1) } }
  }
  render(<ExerciseHost schemaType="stroop" attempt={0} onDone={vi.fn()} onError={vi.fn()} prepare={prepare} onTask={onTask} />)
  await begin('Color Clash')
  expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute('aria-valuemax', '1')
  answer()
  expect(onTask).toHaveBeenCalledTimes(1)
  expect(onTask.mock.calls[0]![0]).toBe(pushed[0]!.task_id)
})
