import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { getUserId } from '../features/assessment/tasks/taskSource'
import { TrialRecorder, tracker } from '../features/assessment/telemetry/tracker'
import type { SchemaType, TelemetryEvent } from '../features/assessment/telemetry/types'
import { useSessionStore } from '../features/insights/sessionStore'
import { useAppStore } from '../state/useAppStore'

/* Baseline and Results (ticket 07). The baseline's exercises are stubbed here (each pushes one real
   tracker event for its own task and finishes on a button); the real exercises run in e2e/flow.spec.ts. */

const META: Partial<Record<SchemaType, TelemetryEvent['trial_meta']>> = {
  relational: { hops: 2 },
  tower: { l_min: 5, l_user: 5, solved: true, planning_time_ms: 1000 },
  mst: { kind: 'lure', response: 'similar' },
}

// The stub opens on its "instruction" (Begin); Begin starts its block ([data-block-running], as the
// real frame marks it) and records one event. `stub` steers a test's run.
const stub = { failing: null as SchemaType | null, wrongOnFirstAttempt: false, tasks: [] as string[] }

vi.mock('../features/assessment/ExerciseHost', () => ({
  ExerciseHost: ({
    schemaType,
    attempt,
    onTask,
    onDone,
    onError,
  }: {
    schemaType: SchemaType
    attempt: number
    onTask?: (id: string) => void
    onDone: () => void
    onError: (msg: string) => void
  }) => {
    const [running, setRunning] = useState(false)
    const id = `stub-${schemaType}-${attempt}`
    useEffect(() => {
      if (stub.failing === schemaType) return onError('This exercise could not be shown.')
      stub.tasks.push(id)
      onTask?.(id)
    }, [])
    const begin = () => {
      setRunning(true)
      const r = new TrialRecorder({ user_id: getUserId(), session_id: 's', task_id: id, dimension: 'pattern_induction', voice_opt_in: false })
      r.start(0)
      tracker.push(r.finish({ correct: !(stub.wrongOnFirstAttempt && attempt === 0), meta: META[schemaType] }))
    }
    return running ? (
      <div data-block-running="true">
        <button type="button" onClick={onDone}>
          Finish {schemaType}
        </button>
      </div>
    ) : (
      <button type="button" onClick={begin}>
        Begin {schemaType}
      </button>
    )
  },
}))

let fetchFn: ReturnType<typeof vi.fn>

beforeEach(() => {
  useAppStore.getState().resetDemoState()
  useSessionStore.getState().clearSessions()
  tracker.resetConsent()
  tracker.clear()
  Object.assign(stub, { failing: null, wrongOnFirstAttempt: false, tasks: [] })
  fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
    const n = (JSON.parse(String(init?.body)) as unknown[]).length
    return new Response(JSON.stringify({ accepted: n }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchFn)
})

afterEach(() => {
  cleanup() // unmount first: the tracker reset below would otherwise update mounted pages outside act()
  tracker.resetConsent()
  tracker.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const go = (path: string) => {
  window.history.pushState({}, '', path)
  render(<App />)
}

const ALL: readonly SchemaType[] = ['relational', 'n_back', 'stroop', 'tower', 'ufov', 'mst']

async function playThrough(schemas: readonly SchemaType[] = ALL) {
  for (const s of schemas) {
    expect(await screen.findByText(`${ALL.indexOf(s) + 1} of 6`, { exact: false })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: `Begin ${s}` }))
    fireEvent.click(await screen.findByRole('button', { name: `Finish ${s}` }))
  }
  await screen.findByRole('heading', { level: 1, name: 'Your results are ready' })
}

async function runBaseline(schemas: readonly SchemaType[] = ALL) {
  go('/baseline')
  await playThrough(schemas)
}

const radar = () => document.querySelector('figure[data-blurred]')!

describe('/baseline', () => {
  it('runs the six exercises in order, saves the session and goes to /results without sending anything', async () => {
    await runBaseline()
    expect(window.location.pathname).toBe('/results')
    const sessions = useSessionStore.getState().sessions
    expect(sessions).toHaveLength(1)
    // Only this page's events are scored: the relational stub event (hops 2) gives FluidMatrices.
    expect(sessions[0]!.inputs.FluidMatrices).toMatchObject({ score: 100 })
    expect(tracker.getStatus()).toMatchObject({ consent: 'pending', queuedCount: 6 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('has Exit and the step indicator, and nothing from the app shell', async () => {
    go('/baseline')
    expect(await screen.findByText('1 of 6', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exit' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  const hideTab = () => {
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    hidden.mockRestore()
  }
  // A real key lands on an element and bubbles to window (window listeners may read e.target).
  const escape = () => fireEvent.keyDown(document.body, { key: 'Escape' })

  it('a hidden tab pauses a running exercise; Resume starts it again', async () => {
    go('/baseline')
    fireEvent.click(await screen.findByRole('button', { name: 'Begin relational' }))
    hideTab()
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish relational' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(await screen.findByRole('button', { name: 'Begin relational' })).toBeInTheDocument()
  })

  it('Escape or a hidden tab on an instruction screen does nothing: no pause, no new task', async () => {
    go('/baseline')
    await screen.findByRole('button', { name: 'Begin relational' })
    escape()
    hideTab()
    expect(screen.queryByRole('heading', { name: 'Paused' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Begin relational' })).toBeInTheDocument()
    expect(stub.tasks).toEqual(['stub-relational-0'])
    // Once the trials run, Escape pauses.
    fireEvent.click(screen.getByRole('button', { name: 'Begin relational' }))
    escape()
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()
  })

  it('a paused attempt is dropped: its events are neither scored nor kept to send', async () => {
    stub.wrongOnFirstAttempt = true // attempt 0 answers wrong, the restart answers right
    go('/baseline')
    fireEvent.click(await screen.findByRole('button', { name: 'Begin relational' }))
    expect(tracker.getStatus().queuedCount).toBe(1)
    escape()
    expect(tracker.getStatus().queuedCount).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await playThrough()
    expect(useSessionStore.getState().sessions[0]!.inputs.FluidMatrices).toMatchObject({ score: 100 })
    expect(tracker.getStatus().queuedCount).toBe(6) // one per finished exercise, none from the pause
  })

  it('an exercise that cannot be shown is skipped, and Results counts only the finished ones', async () => {
    stub.failing = 'tower'
    await runBaseline(['relational', 'n_back', 'stroop', 'ufov', 'mst'])
    expect(screen.getByText('Good job! You finished 5 of 6.')).toBeInTheDocument()
    expect(screen.queryByText(/all six/)).toBeNull()
  })
})

describe('/results', () => {
  it('starts blurred, with the Dolphin; without a Google client id the sheet opens on the consent choice', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    await runBaseline()
    expect(radar()).toHaveAttribute('data-blurred', 'true')
    expect(screen.queryByRole('table')).toBeNull() // the blurred scores are not read out either
    expect(screen.getByRole('img', { name: /Dolphin/ })).toBeInTheDocument()
    expect(screen.getByText('Good job! You finished all six.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    const sheet = screen.getByRole('dialog', { name: 'Save your answers?' })
    expect(within(sheet).getByRole('heading', { name: 'Save your answers?' })).toHaveFocus()
    // No sign-in step: there is nothing to sign in with (rule 14).
    expect(within(sheet).queryByRole('button', { name: 'Continue as guest' })).toBeNull()
    expect(screen.queryByTestId('google-signin')).toBeNull()
  })

  it('with VITE_GOOGLE_CLIENT_ID set, the sheet offers Google or guest first, then the consent choice', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com')
    await runBaseline()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    expect(screen.getByTestId('google-signin')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }))
    expect(screen.getByRole('heading', { name: 'Save your answers?' })).toHaveFocus()
  })

  it('"Save my answers" sends the held events with this device\'s user_id and un-blurs the radar', async () => {
    await runBaseline()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    expect(screen.getByRole('heading', { name: 'Save your answers?' })).toHaveFocus()
    expect(screen.getByText('We record answer timing and accuracy only. No camera, no microphone.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How we handle your data' })).toHaveAttribute('href', '/privacy')
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Save my answers' })))

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/v1/telemetry/event')
    expect(init.method).toBe('POST')
    const sent = JSON.parse(String(init.body)) as TelemetryEvent[]
    expect(sent).toHaveLength(6)
    expect(new Set(sent.map((e) => e.user_id))).toEqual(new Set([getUserId()]))
    expect(tracker.getStatus()).toMatchObject({ consent: 'granted', queuedCount: 0 })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(radar()).toHaveAttribute('data-blurred', 'false')
    expect(screen.getByRole('heading', { level: 1, name: 'Your results' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Dolphin/ })).toBeNull()
    const go = screen.getByRole('button', { name: 'Go to my space' })
    expect(go).toHaveFocus()
    fireEvent.click(go)
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('"Keep them on this device only" sends nothing, clears the buffer, and still shows the results', async () => {
    await runBaseline()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Keep them on this device only' })))
    expect(tracker.getStatus()).toMatchObject({ consent: 'denied', queuedCount: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(radar()).toHaveAttribute('data-blurred', 'false')
    // The real scores: measured pillars show a number, the others "Not measured yet", never a fake value.
    const table = screen.getByRole('table', { name: 'Your five skills, out of 100' })
    expect(within(table).getByRole('row', { name: 'Focus & Strategy 100' })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: 'Mental Agility Not measured yet' })).toBeInTheDocument()
  })

  it('closing the sheet keeps the results blurred', async () => {
    await runBaseline()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(radar()).toHaveAttribute('data-blurred', 'true')
    expect(tracker.getStatus().consent).toBe('pending')
  })

  it('without a saved session, /results goes back to Welcome', async () => {
    go('/results')
    expect(await screen.findByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeInTheDocument()
  })
})
