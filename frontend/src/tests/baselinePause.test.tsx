import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { tracker } from '../features/assessment/telemetry/tracker'
import { useSessionStore } from '../features/insights/sessionStore'
import { useAppStore } from '../state/useAppStore'

/* The baseline's pause with the real ExerciseHost and ExerciseFrame (flow.test.tsx stubs them):
   a block has started from Begin, so a tab hidden during the 500 ms fixation pauses it too. */

beforeEach(() => {
  useAppStore.getState().resetDemoState()
  useSessionStore.getState().clearSessions()
  tracker.resetConsent()
  tracker.clear()
})
afterEach(() => {
  cleanup() // unmount first: the tracker reset would otherwise update the mounted shell outside act()
  tracker.resetConsent()
  tracker.clear()
})

it('a tab hidden during the fixation pauses the block', async () => {
  window.history.pushState({}, '', '/baseline')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Begin' }, { timeout: 5000 }))
  expect(screen.getByRole('img', { name: 'Look at the cross' })).toBeInTheDocument()
  const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => void document.dispatchEvent(new Event('visibilitychange')))
  hidden.mockRestore()
  expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Look at the cross' })).toBeNull()
})
