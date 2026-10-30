import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../components/layout/AppShell'
import { tracker } from '../features/assessment/telemetry/tracker'
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
  it('the offline banner shows the tracker queue count', () => {
    vi.spyOn(tracker, 'getStatus').mockReturnValue({
      isOnline: false,
      queuedCount: 3,
      droppedCount: 0,
      maxCapacity: 500,
    })
    render(
      <MemoryRouter future={future} initialEntries={['/dashboard']}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Connection dropped/i).closest('[role="status"]')).toHaveTextContent(
      '3 in buffer',
    )
  })

  it('the simulated-offline banner states the tracker capacity', () => {
    vi.spyOn(tracker, 'getStatus').mockReturnValue({
      isOnline: true,
      queuedCount: 0,
      droppedCount: 0,
      maxCapacity: 250,
    })
    useAppStore.getState().setSimulateOffline(true)
    render(
      <MemoryRouter future={future} initialEntries={['/dashboard']}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Offline Mode Active/i).closest('[role="status"]')).toHaveTextContent(
      'up to 250 events',
    )
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
})
