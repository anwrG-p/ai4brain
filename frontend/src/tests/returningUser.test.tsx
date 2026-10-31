import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { tracker } from '../features/assessment/telemetry/tracker'
import { useSessionStore } from '../features/insights/sessionStore'
import { useAppStore } from '../state/useAppStore'

/* INT-1 item 14 (user: "if the user is an old user he doesn't need to redo the test"). A returning
   device (at least one saved session, R13: anonymous, so per device) skips Welcome and the baseline. */

const SESSION = { id: 's1', at: '2026-10-30T10:00:00Z', inputs: { MST_LDI: { score: 50, trials: 30 } } }

const go = (url: string) => {
  window.history.pushState({}, '', url)
  render(<App />)
}

beforeEach(() => {
  localStorage.clear()
  useSessionStore.getState().clearSessions()
  useAppStore.getState().resetDemoState()
  tracker.resetConsent()
  tracker.clear()
})
afterEach(() => {
  cleanup()
  tracker.resetConsent()
  tracker.clear()
})

describe('a returning device skips the first-visit flow', () => {
  it('a new device sees Welcome on /', async () => {
    go('/')
    expect(await screen.findByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('a device with one session goes from / to Home, replacing the entry, and Welcome never renders', async () => {
    useSessionStore.getState().addSession(SESSION)
    const length = window.history.length
    go('/')
    expect(screen.queryByRole('heading', { name: "Hi, I'm Loti." })).toBeNull()
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    expect(window.history.length).toBe(length + 1) // the pushState above; the redirect replaced it
    expect(screen.queryByRole('heading', { name: "Hi, I'm Loti." })).toBeNull()
  })

  it('a device with one session goes from /baseline to Home', async () => {
    useSessionStore.getState().addSession(SESSION)
    go('/baseline')
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    expect(screen.queryByRole('heading', { name: 'Your first check-in' })).toBeNull()
  })

  it('?again=1 is the explicit retake: the baseline runs', async () => {
    useSessionStore.getState().addSession(SESSION)
    go('/baseline?again=1')
    expect(await screen.findByRole('heading', { name: 'Your first check-in' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/baseline')
  })

  it('/results stays reachable with sessions', async () => {
    useSessionStore.getState().addSession(SESSION)
    go('/results')
    expect(await screen.findByRole('heading', { level: 1, name: 'Your results are ready' })).toBeInTheDocument()
  })

  it('after "Delete my data", / shows Welcome again', async () => {
    useSessionStore.getState().addSession(SESSION)
    go('/privacy')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete my data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    cleanup()
    go('/')
    expect(await screen.findByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeInTheDocument()
  })
})
