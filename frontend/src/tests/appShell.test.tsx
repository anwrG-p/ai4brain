import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { AppShell } from '../components/layout/AppShell'
import { JUDGE_KEY, readJudgeMode } from '../components/layout/judgeMode'
import { tracker } from '../features/assessment/telemetry/tracker'
import { useSessionStore } from '../features/insights/sessionStore'
import TaskRunnerPage from '../pages/TaskRunnerPage'
import { useAppStore } from '../state/useAppStore'
import { useEmilyStore } from '../state/useEmilyStore'
import { begin } from './exerciseFrame'

// Same flags as App.tsx, so the router prints no v7 warnings.
const future = { v7_startTransition: true, v7_relativeSplatPath: true }

function Where() {
  const { pathname } = useLocation()
  return <span data-testid="where">{pathname}</span>
}

const shellAt = (url: string) =>
  render(
    <MemoryRouter future={future} initialEntries={[url]}>
      <AppShell>
        <Where />
      </AppShell>
    </MemoryRouter>,
  )

const runnerAt = (url: string) =>
  render(
    <MemoryRouter future={future} initialEntries={[url]}>
      <Routes>
        <Route path="/task/:dimId" element={<TaskRunnerPage />} />
      </Routes>
    </MemoryRouter>,
  )

// The U1 clutter list (spec): none of it may show to a consumer.
const CLUTTER = /v1\/|QUEST|JSON|SAT-JEPA|receipt|±|σ/

beforeEach(() => {
  sessionStorage.clear()
  useAppStore.getState().resetDemoState()
})

afterEach(() => {
  cleanup()
  tracker.clear()
  useSessionStore.getState().clearSessions()
  sessionStorage.clear()
})

describe('App shell (ticket 09a)', () => {
  it('the primary nav has exactly 4 items: Home, Train, Loti, You', () => {
    shellAt('/dashboard')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Train', 'Loti', 'You'])
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/dashboard', '/train', '/coach', '/you'])
    expect(links[0]).toHaveAttribute('aria-current', 'page')
  })

  it('the mobile tabs carry the same 4 items, each with an icon and a label', () => {
    shellAt('/train')
    const tabs = screen.getByRole('navigation', { name: 'Tabs' })
    const links = within(tabs).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Train', 'Loti', 'You'])
    for (const l of links) expect(l.querySelector('svg')).not.toBeNull()
    expect(links[1]).toHaveAttribute('aria-current', 'page')
  })

  it('the header holds the logo, the nav and the theme toggle only', () => {
    shellAt('/dashboard')
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('button', { name: 'Switch to Dark (Night Lab)' })).toBeInTheDocument()
    expect(within(header).queryByRole('link', { name: /privacy|settings|sign in|profile/i })).toBeNull()
    expect(within(header).queryByRole('button', { name: /mood/i })).toBeNull()
    expect(screen.queryByTestId('page-progress-badge')).toBeNull()

    fireEvent.click(within(header).getByRole('button', { name: 'Switch to Dark (Night Lab)' }))
    expect(within(header).getByRole('button', { name: 'Switch to Light (Playful Lab)' })).toBeInTheDocument()
  })

  it('the footer is one muted line', () => {
    shellAt('/dashboard')
    const footer = screen.getByRole('contentinfo')
    expect(footer.querySelectorAll('p')).toHaveLength(1)
    expect(within(footer).queryByRole('button')).toBeNull()
  })

  it.each(['/', '/results'])('the flow route %s keeps its minimal chrome: logo and theme toggle, no nav', (url) => {
    shellAt(url)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('contentinfo')).toBeNull()
    expect(screen.getByRole('button', { name: /Switch to Dark/ })).toBeInTheDocument()
  })

  it('the offline line promises no sync: answers stay on this device', () => {
    useAppStore.getState().setSimulateOffline(true)
    shellAt('/dashboard')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent("You're offline. Your answers are saved on this device.")
    expect(status).not.toHaveTextContent(/sync|queue|telemetry|buffer/i)
    act(() => useAppStore.getState().setSimulateOffline(false))
  })

  it.each(['/baseline', '/task/working_memory'])('no offline line on %s: nothing appears above a stimulus', (url) => {
    useAppStore.getState().setSimulateOffline(true)
    shellAt(url)
    expect(screen.queryByText(/You're offline/)).toBeNull()
    act(() => useAppStore.getState().setSimulateOffline(false))
  })
})

describe('Emotion engine without the mood pill (gap FE-03)', () => {
  it('the shell keeps the mood store updating from interaction, with no pill rendered', () => {
    vi.useFakeTimers()
    try {
      useEmilyStore.getState().reset()
      const before = useEmilyStore.getState().metrics
      shellAt('/dashboard')
      expect(screen.queryByRole('button', { name: /EMILY|mood/i })).toBeNull()
      for (let i = 0; i < 6; i++) fireEvent.click(document.body, { clientX: 10 * i, clientY: 5 * i })
      act(() => void vi.advanceTimersByTime(3100))
      expect(useEmilyStore.getState().metrics).not.toBe(before)
      expect(document.documentElement.getAttribute('data-emotion')).toBe(useEmilyStore.getState().currentEmotion)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['/', '/results', '/baseline', '/task/working_memory'])(
    'the engine does not run on %s (welcome flow before consent, timed trials)',
    (url) => {
      vi.useFakeTimers()
      try {
        useEmilyStore.getState().reset()
        const before = useEmilyStore.getState().metrics
        shellAt(url)
        for (let i = 0; i < 6; i++) fireEvent.click(document.body, { clientX: 10 * i, clientY: 5 * i })
        act(() => void vi.advanceTimersByTime(3100))
        expect(useEmilyStore.getState().metrics).toBe(before)
      } finally {
        vi.useRealTimers()
      }
    },
  )
})

describe('Judge mode (R6)', () => {
  it('?judge=1 turns it on and is remembered for the session; ?judge=0 turns it off', () => {
    expect(readJudgeMode('')).toBe(false)
    expect(readJudgeMode('?judge=1')).toBe(true)
    expect(sessionStorage.getItem(JUDGE_KEY)).toBe('1')
    expect(readJudgeMode('?other=x')).toBe(true)
    expect(readJudgeMode('?judge=0')).toBe(false)
    expect(readJudgeMode('')).toBe(false)
  })

  it('the shell shows the evaluator tools only in judge mode', () => {
    const { unmount } = shellAt('/dashboard')
    expect(screen.queryByRole('region', { name: 'Judge tools' })).toBeNull()
    expect(screen.queryByRole('button', { name: /UX Review/i })).toBeNull()
    unmount()

    shellAt('/dashboard?judge=1')
    const tools = screen.getByRole('region', { name: 'Judge tools' })
    expect(within(tools).getByRole('button', { name: 'Simulate offline' })).toBeInTheDocument()
    expect(within(tools).getByRole('button', { name: /UX Review/i })).toBeInTheDocument()
  })

  it('the task runner shows no evaluator, stage, preset or inspector controls without ?judge=1', async () => {
    runnerAt('/task/working_memory')
    await begin('Memory Gauntlet')
    for (const name of [/Evaluator/i, /Simulate Tab-Blur/i, /Block Summary/i, /Telemetry/i, /Dimensions?$/, /Exercise:/]) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    expect(screen.queryByText(/Evaluator/i)).toBeNull()
  })

  it('with ?judge=1 the task runner shows its evaluator controls', async () => {
    runnerAt('/task/working_memory?judge=1')
    await begin('Memory Gauntlet')
    const tools = screen.getByRole('complementary', { name: 'Evaluator controls' })
    expect(within(tools).getByRole('button', { name: 'Simulate Tab-Blur Pause' })).toBeInTheDocument()
    expect(within(tools).getByRole('group', { name: 'Task runner stage switcher' })).toBeInTheDocument()
    expect(within(tools).getByRole('group', { name: 'Cognitive dimension preset' })).toBeInTheDocument()
  })
})

describe('Routes and redirects (ticket 09a)', () => {
  const at = async (url: string) => {
    window.history.pushState({}, '', url)
    render(<App />)
    await screen.findByRole('heading', { level: 1 }, { timeout: 5000 })
    return window.location.pathname
  }

  it.each([
    ['/onboarding', '/'],
    ['/assessment', '/train'],
    ['/plan', '/train'],
    ['/practice', '/baseline'],
    ['/profile-reveal', '/results'],
    ['/reveal', '/results'],
    ['/goals', '/dashboard'],
    ['/brain-twin', '/dashboard'],
    ['/collaboration', '/dashboard'],
    ['/layer-d', '/dashboard'],
    ['/design-system', '/dashboard'],
    ['/dimensions', '/you'],
    ['/dimensions/working_memory', '/you'],
    ['/auth', '/'],
    ['/login', '/'],
    ['/register', '/'],
  ])('%s redirects to %s', async (from, to) => {
    // /results needs a finished session, or it sends the visitor back to Welcome.
    useSessionStore.getState().addSession({ id: 's1', at: '2026-10-31T10:00:00Z', inputs: { MST_LDI: { score: 60, trials: 20 } } })
    expect(await at(from)).toBe(to)
  })

  it.each(['/train', '/coach', '/you', '/privacy', '/settings', '/methodology'])('%s renders a page with its own h1', async (url) => {
    expect(await at(url)).toBe(url)
  })

  it('an unknown route shows a plain not-found page with one way home', async () => {
    await at('/no-such-page')
    expect(screen.getByRole('heading', { level: 1, name: "This page isn't here." })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/dashboard')
    expect(document.body.textContent).not.toMatch(/404|HTTP|Synaptic|route/i)
  })

  it.each([
    ['/offline', "You're offline."],
    ['/system-error', 'Something went wrong.'],
  ])('%s is a plain page', async (url, h1) => {
    await at(url)
    expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeInTheDocument()
    expect(document.querySelector('main')?.textContent).not.toMatch(/telemetry|queue|boundary|diagnostic/i)
  })

  it('a redirect keeps the query string', async () => {
    await at('/assessment?judge=1')
    expect(window.location.pathname + window.location.search).toBe('/train?judge=1')
  })

  // Re-run after the merge, when /dashboard, /train, /coach and /you are the real pages.
  it.each(['/', '/dashboard', '/train', '/coach', '/you'])('%s shows no v1/, QUEST, JSON or SAT-JEPA', async (url) => {
    await at(url)
    expect(document.querySelector('main')?.textContent).not.toMatch(/v1\/|QUEST|JSON|SAT-JEPA/)
  })

  it('/ and the shell show none of the technical clutter', async () => {
    await at('/')
    expect(document.body.textContent).not.toMatch(CLUTTER)
    cleanup()
    shellAt('/dashboard')
    expect(document.body.textContent).not.toMatch(CLUTTER)
  })
})
