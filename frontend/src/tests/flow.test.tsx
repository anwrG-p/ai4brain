import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
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

vi.mock('../features/assessment/ExerciseHost', () => ({
  ExerciseHost: ({ schemaType, onTask, onDone }: { schemaType: SchemaType; onTask?: (id: string) => void; onDone: () => void }) => {
    useEffect(() => {
      const id = `stub-${schemaType}`
      onTask?.(id)
      const r = new TrialRecorder({ user_id: getUserId(), session_id: 's', task_id: id, dimension: 'pattern_induction', voice_opt_in: false })
      r.start(0)
      tracker.push(r.finish({ correct: true, meta: META[schemaType] }))
    }, [])
    return (
      <button type="button" onClick={onDone}>
        Finish {schemaType}
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

async function runBaseline() {
  go('/baseline')
  for (const [k, s] of (['relational', 'n_back', 'tower', 'ufov', 'mst'] as const).entries()) {
    expect(await screen.findByText(`${k + 1} of 5`, { exact: false })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: `Finish ${s}` }))
  }
  await screen.findByRole('heading', { level: 1, name: 'Your results are ready' })
}

const radar = () => document.querySelector('figure[data-blurred]')!

describe('/baseline', () => {
  it('runs the five exercises in order, saves the session and goes to /results without sending anything', async () => {
    await runBaseline()
    expect(window.location.pathname).toBe('/results')
    const sessions = useSessionStore.getState().sessions
    expect(sessions).toHaveLength(1)
    // Only this page's events are scored: the relational stub event (hops 2) gives FluidMatrices.
    expect(sessions[0]!.inputs.FluidMatrices).toMatchObject({ score: 100 })
    expect(tracker.getStatus()).toMatchObject({ consent: 'pending', queuedCount: 5 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('has Exit and the step indicator, and nothing from the app shell', async () => {
    go('/baseline')
    expect(await screen.findByText('1 of 5', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exit' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  it('a hidden tab pauses; Resume starts the exercise again', async () => {
    go('/baseline')
    await screen.findByRole('button', { name: 'Finish relational' })
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    hidden.mockRestore()
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish relational' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(await screen.findByRole('button', { name: 'Finish relational' })).toBeInTheDocument()
  })
})

describe('/results', () => {
  it('starts blurred, with the Dolphin and no Google button when no client id is set', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    await runBaseline()
    expect(radar()).toHaveAttribute('data-blurred', 'true')
    expect(screen.queryByRole('table')).toBeNull() // the blurred scores are not read out either
    expect(screen.getByRole('img', { name: /Dolphin/ })).toBeInTheDocument()
    expect(screen.getByText('Good job! You finished all five.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Continue as guest' })).toBeInTheDocument()
    expect(screen.queryByTestId('google-signin')).toBeNull()
  })

  it('shows the Google sign-in box when VITE_GOOGLE_CLIENT_ID is set', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com')
    await runBaseline()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    expect(screen.getByTestId('google-signin')).toBeInTheDocument()
  })

  it('"Save my answers" sends the held events with this device\'s user_id and un-blurs the radar', async () => {
    await runBaseline()
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }))
    expect(screen.getByRole('heading', { name: 'Save your answers?' })).toHaveFocus()
    expect(screen.getByText('We record answer timing and accuracy only. No camera, no microphone.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How we handle your data' })).toHaveAttribute('href', '/privacy')
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Save my answers' })))

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/v1/telemetry/event')
    expect(init.method).toBe('POST')
    const sent = JSON.parse(String(init.body)) as TelemetryEvent[]
    expect(sent).toHaveLength(5)
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }))
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Keep them on this device only' })))
    expect(tracker.getStatus()).toMatchObject({ consent: 'denied', queuedCount: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(radar()).toHaveAttribute('data-blurred', 'false')
    // The real scores: measured pillars show a number, the others "Not measured yet", never a fake value.
    const table = screen.getByRole('table', { name: 'Your five skills, out of 100' })
    expect(within(table).getByRole('row', { name: /^Focus & Strategy 100 · likely \d+–100$/ })).toBeInTheDocument()
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
