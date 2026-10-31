import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../components/layout/AppShell'
import { tracker } from '../features/assessment/telemetry/tracker'
import { GOALS_KEY, useGoalsStore } from '../features/insights/goals'
import { SESSIONS_KEY, useSessionStore } from '../features/insights/sessionStore'
import PrivacyPage from '../pages/PrivacyPage'
import { useAppStore } from '../state/useAppStore'

// Same flags as App.tsx, so the router prints no v7 warnings.
const future = { v7_startTransition: true, v7_relativeSplatPath: true }

// The tracker singleton is only spied on, never filled, so no state leaks between tests.
// Unmount before resetting the store, or the reset re-renders a mounted AppShell outside act().
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAppStore.getState().setSimulateOffline(false)
})

describe('UI telemetry goes through the Tracker', () => {
  // Ticket 09a: one plain line, no counts, no queue words, no sync promise.
  it('when the tracker is offline the shell says so in one plain line', () => {
    vi.spyOn(tracker, 'getStatus').mockReturnValue({
      isOnline: false,
      queuedCount: 3,
      droppedCount: 0,
      maxCapacity: 500,
      consent: 'granted',
    })
    render(
      <MemoryRouter future={future} initialEntries={['/dashboard']}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent("You're offline. Your answers are saved on this device.")
  })

  const renderShell = () =>
    render(
      <MemoryRouter future={future} initialEntries={['/dashboard']}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>,
    )

  it('while consent is pending the offline banner promises no sync', () => {
    vi.spyOn(tracker, 'getStatus').mockReturnValue({
      isOnline: true,
      queuedCount: 2,
      droppedCount: 0,
      maxCapacity: 500,
      consent: 'pending',
    })
    useAppStore.getState().setSimulateOffline(true)
    renderShell()
    const banner = screen.getByRole('status')
    expect(banner).not.toHaveTextContent(/sync/i)
    expect(banner).not.toHaveTextContent(/Ready/i) // nothing is ready to go out yet
    expect(banner).toHaveTextContent('saved on this device')
  })

  it('after a decline there is no offline banner: nothing is kept to send', () => {
    vi.spyOn(tracker, 'getStatus').mockReturnValue({
      isOnline: false,
      queuedCount: 0,
      droppedCount: 0,
      maxCapacity: 500,
      consent: 'denied',
    })
    renderShell()
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
  })

  const renderPrivacy = () =>
    render(
      <MemoryRouter future={future}>
        <PrivacyPage />
      </MemoryRouter>,
    )
  const statusWith = (consent: 'pending' | 'granted' | 'denied') =>
    vi.spyOn(tracker, 'getStatus').mockReturnValue({
      isOnline: true,
      queuedCount: 0,
      droppedCount: 0,
      maxCapacity: 500,
      consent,
    })

  it.each([
    ['pending', /stay on this device until you choose/i],
    ['granted', /You chose to share your answers/i],
    ['denied', /You chose not to share/i],
  ] as const)('the privacy page states the %s consent in one plain line', (consent, line) => {
    statusWith(consent)
    renderPrivacy()
    expect(screen.getByText(line)).toBeInTheDocument()
    // Only the quiet link is visible; the two equal choices sit behind it.
    expect(screen.queryByRole('button', { name: /^Share my answers$/i })).not.toBeInTheDocument()
  })

  it('before any choice the link reads "Choose"', () => {
    statusWith('pending')
    renderPrivacy()
    expect(screen.getByRole('button', { name: /^Choose$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Change my choice/i })).not.toBeInTheDocument()
  })

  it('"Change my choice" reveals two equal choices that call the tracker', () => {
    statusWith('granted')
    const deny = vi.spyOn(tracker, 'denyConsent').mockImplementation(() => {})
    const grant = vi.spyOn(tracker, 'grantConsent').mockImplementation(() => {})
    renderPrivacy()
    const toggle = screen.getByRole('button', { name: /Change my choice/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: /^Don't share$/i }))
    expect(deny).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /^Don't share$/i })).not.toBeInTheDocument()
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: /^Share my answers$/i }))
    expect(grant).toHaveBeenCalledOnce()
  })

  it('the privacy purge resets consent, so nothing is sent until the user accepts again', () => {
    vi.spyOn(tracker, 'clear').mockReturnValue(0)
    const reset = vi.spyOn(tracker, 'resetConsent').mockImplementation(() => {})
    renderPrivacy()
    fireEvent.click(screen.getByRole('button', { name: /Purge All Data & Telemetry/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /cannot be undone/i }))
    fireEvent.click(screen.getByRole('button', { name: /Permanently Purge All Data/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('confirming the privacy purge clears the tracker and certifies the real count', () => {
    const clear = vi.spyOn(tracker, 'clear').mockReturnValue(3)
    render(
      <MemoryRouter future={future}>
        <PrivacyPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Purge All Data & Telemetry/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /cannot be undone/i }))
    fireEvent.click(screen.getByRole('button', { name: /Permanently Purge All Data/i }))
    expect(clear).toHaveBeenCalledOnce()
    expect(screen.getByText(/Purged 3 records/)).toBeInTheDocument()
  })

  it('the privacy purge forgets the anonymous id, so later telemetry is not linked to it', () => {
    vi.spyOn(tracker, 'clear').mockReturnValue(0)
    localStorage.setItem('aura_uid', 'old-anonymous-id')
    render(
      <MemoryRouter future={future}>
        <PrivacyPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Purge All Data & Telemetry/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /cannot be undone/i }))
    fireEvent.click(screen.getByRole('button', { name: /Permanently Purge All Data/i }))
    expect(localStorage.getItem('aura_uid')).toBeNull()
  })

  it('the privacy purge clears the local sessions and goals', () => {
    vi.spyOn(tracker, 'clear').mockReturnValue(0)
    useSessionStore.getState().addSession({ id: 's1', at: '2026-10-31T10:00:00Z', inputs: { MST_LDI: { score: 60, trials: 20 } } })
    useGoalsStore.getState().setGoal('memory', 10)
    render(
      <MemoryRouter future={future}>
        <PrivacyPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Purge All Data & Telemetry/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /cannot be undone/i }))
    fireEvent.click(screen.getByRole('button', { name: /Permanently Purge All Data/i }))
    expect(useSessionStore.getState().sessions).toEqual([])
    expect(useGoalsStore.getState().goals).toEqual({})
    expect(localStorage.getItem(SESSIONS_KEY)).toBeNull()
    expect(localStorage.getItem(GOALS_KEY)).toBeNull()
  })
})
