import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { useAppStore } from '../state/useAppStore'
import { tracker } from '../features/assessment/telemetry/tracker'
import { useGoalsStore } from '../features/insights/goals'
import { useSessionStore } from '../features/insights/sessionStore'
import YouPage from '../pages/YouPage'
import PrivacyPage from '../pages/PrivacyPage'
import SettingsPage from '../pages/SettingsPage'

// /you, /privacy and /settings are wired in App.tsx by ticket 09a, so these render the pages alone.
function renderPage(page: ReactElement) {
  const view = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{page}</MemoryRouter>)
  return view.container
}

// The pages here are short, so every word on them counts against the above-the-fold budget.
const words = (el: HTMLElement) => (el.textContent ?? '').split(/\s+/).filter(Boolean).length

const TECHNICAL = /v1\/|QUEST|JSON|SAT-JEPA|contract|receipt|hash|SHA|endpoint|telemetry|Layer [A-D]|GDPR|never collected|staircase|persona|±|σ/i

const SESSION = { id: 's1', at: '2026-10-31T10:00:00Z', inputs: {} }

beforeEach(() => {
  useSessionStore.getState().clearSessions()
  useGoalsStore.getState().clearGoals()
  useAppStore.getState().resetDemoState()
  tracker.resetConsent()
  tracker.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('You (/you)', () => {
  it('has one h1 with the guest name and exactly 4 rows', () => {
    const page = renderPage(<YouPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guest')
    const rows = within(screen.getByRole('navigation', { name: 'You' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent?.trim())).toEqual(['Privacy', 'Settings', 'How we calculate this', 'Sign in'])
    expect(page.querySelector('a[href="/privacy"]')).not.toBeNull()
    expect(page.querySelector('a[href="/settings"]')).not.toBeNull()
    expect(page.querySelector('a[href="/methodology"]')).not.toBeNull()
  })

  it('shows the signed-in name, and Sign out signs out', () => {
    useAppStore.getState().loginUser({ preferredName: 'Mazen', email: 'm@example.com', focusGoal: 'x' })
    renderPage(<YouPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mazen')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(useAppStore.getState().isAuthenticated).toBe(false)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guest')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('Sign in opens the login sheet for a guest', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    renderPage(<YouPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    const sheet = screen.getByRole('dialog')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Continue as guest' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    vi.unstubAllEnvs()
  })

  it('keeps to 60 words and no technical words', () => {
    const page = renderPage(<YouPage />)
    expect(words(page)).toBeLessThanOrEqual(60)
    expect(page.textContent).not.toMatch(TECHNICAL)
  })
})

describe('Privacy (/privacy)', () => {
  it('says the consent status in one line, from the tracker', () => {
    renderPage(<PrivacyPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByTestId('consent-line')).toHaveTextContent('Not chosen yet')
    act(() => tracker.grantConsent())
    expect(screen.getByTestId('consent-line')).toHaveTextContent('Your answers are saved.')
    act(() => tracker.denyConsent())
    expect(screen.getByTestId('consent-line')).toHaveTextContent('Your answers are kept on this device only.')
  })

  it('Change shows two equal choices that call the tracker and update the line', () => {
    const grant = vi.spyOn(tracker, 'grantConsent')
    const deny = vi.spyOn(tracker, 'denyConsent')
    renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }))
    const save = screen.getByRole('button', { name: 'Save my answers' })
    const keep = screen.getByRole('button', { name: 'Keep them on this device only' })
    expect(save.className).toBe(keep.className) // equal weight (R3)
    fireEvent.click(save)
    expect(grant).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('consent-line')).toHaveTextContent('Your answers are saved.')
    expect(screen.queryByRole('button', { name: 'Save my answers' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep them on this device only' }))
    expect(deny).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('consent-line')).toHaveTextContent('Your answers are kept on this device only.')
  })

  it('says what is recorded in one plain sentence', () => {
    renderPage(<PrivacyPage />)
    expect(screen.getByText('We record answer timing and accuracy only. No camera, no microphone.')).toBeInTheDocument()
  })

  it('Delete my data asks first; Cancel keeps everything', () => {
    useSessionStore.getState().addSession(SESSION)
    renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete your data?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useSessionStore.getState().sessions).toHaveLength(1)
  })

  it('confirming runs the purge: tracker queue, consent, sessions, goals, profile', () => {
    useAppStore.getState().loginUser({ preferredName: 'Mazen', email: 'm@example.com', focusGoal: 'x' })
    useSessionStore.getState().addSession(SESSION)
    useGoalsStore.getState().setGoal('focus', 10)
    act(() => tracker.grantConsent())
    const clearQueue = vi.spyOn(tracker, 'clear')
    const resetConsent = vi.spyOn(tracker, 'resetConsent')
    renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete your data?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(clearQueue).toHaveBeenCalled()
    expect(resetConsent).toHaveBeenCalled()
    expect(useGoalsStore.getState().goals).toEqual({})
    expect(useSessionStore.getState().sessions).toHaveLength(0)
    expect(useAppStore.getState().isAuthenticated).toBe(false)
    expect(tracker.getStatus().consent).toBe('pending')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Your data is deleted.')
    expect(screen.getByTestId('consent-line')).toHaveTextContent('Not chosen yet')
  })

  it('Escape closes the dialog', () => {
    renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps to 60 words, 2 quiet controls and no technical words', () => {
    const page = renderPage(<PrivacyPage />)
    expect(words(page)).toBeLessThanOrEqual(60)
    expect(page.textContent).not.toMatch(TECHNICAL)
    expect(Array.from(page.querySelectorAll('a, button')).map((b) => b.textContent?.trim())).toEqual([
      'Choose',
      'Delete my data',
    ])
  })
})

describe('Settings (/settings)', () => {
  it('has one h1, a theme choice with the kept names, and reduce motion', () => {
    renderPage(<SettingsPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const dark = screen.getByRole('radio', { name: 'Dark (Night Lab)' })
    const light = screen.getByRole('radio', { name: 'Light (Playful Lab)' })
    expect(light).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(dark)
    expect(useAppStore.getState().theme).toBe('dark')
    expect(dark).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    const motion = screen.getByRole('switch', { name: 'Reduce motion' })
    expect(motion).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(motion)
    expect(useAppStore.getState().reducedMotion).toBe(true)
    expect(motion).toHaveAttribute('aria-checked', 'true')
  })

  it('shows only real settings: no technical or unwired switches', () => {
    const page = renderPage(<SettingsPage />)
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getAllByRole('switch')).toHaveLength(1)
    expect(page.textContent).not.toMatch(TECHNICAL)
    expect(page.textContent).not.toMatch(/dimension|preset|zoom|glyph|rest day|shortcut|factory/i)
    expect(words(page)).toBeLessThanOrEqual(60)
  })
})
