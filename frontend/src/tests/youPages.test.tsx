import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { useAppStore } from '../state/useAppStore'
import { CONSENT_KEY, QUEUE_KEY, tracker } from '../features/assessment/telemetry/tracker'
import { UID_KEY } from '../features/assessment/tasks/taskSource'
import { GOALS_KEY, useGoalsStore } from '../features/insights/goals'
import { SESSIONS_KEY, useSessionStore } from '../features/insights/sessionStore'
import { LOTI_SESSION_KEY, useLotiSession } from '../features/loti/lotiSession'
import type { LotiMessage } from '../features/loti/types'
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

const ASK: LotiMessage = { id: 'day', text: 'How was your day?', choices: [{ id: 'great', label: 'Great' }] }
/** A talk in Loti's store (and so in sessionStorage): Loti asked, the user answered, a question is open. */
function seedLotiTalk() {
  act(() => {
    useLotiSession.getState().record(ASK, ASK.choices[0]!, { id: 'train', text: 'Shall we train?', choices: [{ id: 'yes', label: 'Yes' }] })
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useSessionStore.getState().clearSessions()
  useGoalsStore.getState().clearGoals()
  useLotiSession.getState().clear()
  useAppStore.getState().resetDemoState()
  tracker.resetConsent()
  tracker.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('You (/you)', () => {
  it('has one h1 with the guest name and exactly 3 rows: no sign-in (R13, users stay anonymous)', () => {
    const page = renderPage(<YouPage />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guest')
    const rows = within(screen.getByRole('navigation', { name: 'You' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent?.trim())).toEqual(['Privacy', 'Settings', 'How we calculate this'])
    expect(page.querySelector('a[href="/privacy"]')).not.toBeNull()
    expect(page.querySelector('a[href="/settings"]')).not.toBeNull()
    expect(page.querySelector('a[href="/methodology"]')).not.toBeNull()
    expect(page.textContent).not.toMatch(/sign(ed)? (in|out)/i)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('a stored name still shows (no account behind it)', () => {
    useAppStore.getState().loginUser({ preferredName: 'Mazen', email: 'm@example.com', focusGoal: 'x' })
    const page = renderPage(<YouPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mazen')
    expect(page.textContent).not.toMatch(/sign(ed)? (in|out)|m@example\.com/i)
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
    expect(screen.getByRole('status')).toHaveTextContent('Deleted from this device.')
    expect(screen.getByTestId('consent-line')).toHaveTextContent('Not chosen yet')
  })

  it('delete keeps the theme and reduce motion (preferences, not data) and clears Loti talk', () => {
    act(() => {
      useAppStore.getState().setTheme('dark')
      useAppStore.getState().setReducedMotion(true)
    })
    seedLotiTalk()
    renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(useAppStore.getState().theme).toBe('dark')
    expect(useAppStore.getState().reducedMotion).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-reduced-motion', 'true')
    expect(sessionStorage.getItem(LOTI_SESSION_KEY)).toBeNull()
    // The in-memory talk is gone too: the next bubble does not save the old turns back.
    act(() => useLotiSession.getState().begin(ASK))
    expect(useLotiSession.getState().turns).toEqual([])
    expect(sessionStorage.getItem(LOTI_SESSION_KEY)).not.toMatch(/Shall we train/)
  })

  it('no fake certificate, hash or server claim after delete', () => {
    const page = renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(page.textContent).not.toMatch(/certificate|SHA|hash|server|purged|permanent/i)
  })

  it('Export my data downloads one JSON file holding every device key and the profile', async () => {
    useAppStore.getState().loginUser({ preferredName: 'Mazen', email: 'm@example.com', focusGoal: 'x' })
    useSessionStore.getState().addSession(SESSION)
    useGoalsStore.getState().setGoal('focus', 10)
    act(() => tracker.denyConsent()) // the tracker itself writes the consent key
    localStorage.setItem(QUEUE_KEY, '[{"event":"held"}]')
    localStorage.setItem(UID_KEY, 'anon-1')
    seedLotiTalk()
    sessionStorage.removeItem(LOTI_SESSION_KEY) // the export reads the store, not the raw key
    let blob: Blob | undefined
    // jsdom has no createObjectURL: stub it so it can be spied on; afterEach restores the spies.
    URL.createObjectURL ??= () => ''
    URL.revokeObjectURL ??= () => {}
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b as Blob
      return 'blob:x'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Export my data' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(blob?.type).toBe('application/json')
    // jsdom's Blob: read it with jsdom's FileReader.
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.readAsText(blob as Blob)
    })
    const data = JSON.parse(text)
    expect(Object.keys(data.localStorage).sort()).toEqual([CONSENT_KEY, GOALS_KEY, QUEUE_KEY, SESSIONS_KEY, UID_KEY].sort())
    expect(data.localStorage[SESSIONS_KEY].sessions[0].id).toBe('s1')
    expect(data.localStorage[GOALS_KEY].goals).toEqual({ focus: 10 })
    expect(data.localStorage[CONSENT_KEY]).toBe('denied')
    expect(data.localStorage[QUEUE_KEY]).toEqual([{ event: 'held' }])
    expect(data.localStorage[UID_KEY]).toBe('anon-1')
    expect(data.lotiTalk.turns.map((t: { text: string }) => t.text)).toEqual(['How was your day?', 'Great'])
    expect(data.lotiTalk.current.text).toBe('Shall we train?')
    expect(data).not.toHaveProperty('sessionStorage')
    expect(data.consent).toBe('denied')
    // Only the user's own fields: no demo/judge state, no legacy consent defaults (fake receipt id).
    expect(data.app).toEqual({
      userProfile: { preferredName: 'Mazen', email: 'm@example.com', focusGoal: 'x' },
      isAuthenticated: true,
      theme: 'light',
      reducedMotion: false,
    })
    expect(text).not.toContain('consentReceiptId')
    expect(text).not.toContain('CONSENT-ST-2026')
  })

  it('Escape closes the dialog', () => {
    renderPage(<PrivacyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps to 60 words, 3 quiet controls and no technical words', () => {
    const page = renderPage(<PrivacyPage />)
    expect(words(page)).toBeLessThanOrEqual(60)
    expect(page.textContent).not.toMatch(TECHNICAL)
    expect(Array.from(page.querySelectorAll('a, button')).map((b) => b.textContent?.trim())).toEqual([
      'Choose',
      'Export my data',
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

  it('theme radios are one Tab stop; arrow keys move and choose', () => {
    renderPage(<SettingsPage />)
    const light = screen.getByRole('radio', { name: 'Light (Playful Lab)' })
    const dark = screen.getByRole('radio', { name: 'Dark (Night Lab)' })
    expect(light).toHaveAttribute('tabindex', '0')
    expect(dark).toHaveAttribute('tabindex', '-1')
    light.focus()
    fireEvent.keyDown(light, { key: 'ArrowRight' })
    expect(useAppStore.getState().theme).toBe('dark')
    expect(dark).toHaveFocus()
    expect(dark).toHaveAttribute('tabindex', '0')
    expect(light).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(dark, { key: 'ArrowDown' }) // wraps
    expect(useAppStore.getState().theme).toBe('light')
    expect(light).toHaveFocus()
    fireEvent.keyDown(light, { key: 'ArrowUp' })
    expect(useAppStore.getState().theme).toBe('dark')
    fireEvent.keyDown(dark, { key: 'ArrowLeft' })
    expect(useAppStore.getState().theme).toBe('light')
  })

  it('the whole Reduce motion row is the switch (a tap target of the full row)', () => {
    renderPage(<SettingsPage />)
    const motion = screen.getByRole('switch', { name: 'Reduce motion' })
    expect(motion.closest('li')?.firstElementChild).toBe(motion)
    expect(motion.className).toMatch(/\bw-full\b/)
    expect(motion.className).toMatch(/\bmin-h-14\b/)
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
