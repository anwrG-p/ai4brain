import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachPage from '../pages/CoachPage'
import { useGoalsStore } from '../features/insights/goals'
import { useSessionStore } from '../features/insights/sessionStore'
import { LotiBubbles } from '../features/loti/LotiBubbles'
import { LOTI_SESSION_KEY, useLotiSession } from '../features/loti/lotiSession'

const future = { v7_startTransition: true, v7_relativeSplatPath: true }

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname + loc.search}</p>
}

function renderAt(path = '/coach') {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <Routes>
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/dashboard" element={<LotiBubbles context={{ now: new Date(), hasGoalsThisYear: true, sessionsThisWeek: 0 }} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

const log = () => screen.getByRole('log')
/** Words a sighted user sees: screen-reader-only and hidden text left out. */
function visibleWords(root: HTMLElement): number {
  const copy = root.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.sr-only, [aria-hidden="true"], svg, title').forEach((n) => n.remove())
  return (copy.textContent ?? '').split(/\s+/).filter(Boolean).length
}

beforeEach(() => {
  // A Wednesday afternoon with nothing measured: Loti opens with "How was your day?".
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T15:00:00'))
})

afterEach(() => {
  cleanup() // unmount before the stores reset, so the reset does not re-render the page
  vi.useRealTimers()
  useLotiSession.getState().clear()
  useSessionStore.getState().clearSessions()
  useGoalsStore.getState().clearGoals()
  sessionStorage.clear()
  localStorage.clear()
})

describe('CoachPage (/coach)', () => {
  it('shows Loti, one heading and the opening question with its chips, in a polite log', () => {
    renderAt()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /loti/i }).length).toBeGreaterThanOrEqual(1)
    expect(log()).toHaveAttribute('aria-live', 'polite')
    expect(within(log()).getByText('How was your day?')).toBeInTheDocument()
    const chips = within(screen.getByRole('group', { name: /reply to loti/i })).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['Great', 'Okay', 'Tough'])
    for (const chip of chips) expect(chip).toHaveAccessibleDescription('How was your day?')
  })

  it('keeps the visible words to 60 or fewer on first load, with no technical text', () => {
    const { container } = renderAt()
    expect(visibleWords(container)).toBeLessThanOrEqual(60)
    expect(container.textContent).not.toMatch(/gemini|model|LLM|v1\/|JSON|QUEST|SAT-JEPA|contract/i)
  })

  it('choosing a chip appends the reply on the right and Loti’s next bubble, and focus moves to the new chip', async () => {
    const user = userEvent.setup()
    renderAt()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    const reply = within(log()).getByText('Great')
    expect(reply.closest('[data-from="you"]')).not.toBeNull()
    expect(within(log()).getByText('How was your day?')).toBeInTheDocument()
    expect(within(log()).getByText(/good to hear/i)).toBeInTheDocument()
    const next = screen.getByRole('button', { name: /yes, let's train/i })
    expect(next).toHaveFocus()
    expect(next).toHaveAccessibleDescription(/good to hear/i)
  })

  it('persists the history in the session and resumes it when the page comes back', async () => {
    const user = userEvent.setup()
    const first = renderAt()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    expect(JSON.parse(sessionStorage.getItem(LOTI_SESSION_KEY) ?? 'null').turns).toHaveLength(2)
    first.unmount()

    renderAt()
    expect(within(log()).getByText('How was your day?')).toBeInTheDocument()
    expect(within(log()).getByText('Great')).toBeInTheDocument()
    expect(within(log()).getAllByText(/good to hear/i)).toHaveLength(1)
    expect(screen.getByRole('button', { name: /yes, let's train/i })).toBeInTheDocument()
  })

  it('continues a talk started on another page’s Loti bubble', async () => {
    const user = userEvent.setup()
    const dash = renderAt('/dashboard')
    await user.click(screen.getByRole('button', { name: 'Great' }))
    dash.unmount()

    renderAt()
    expect(within(log()).getByText('How was your day?')).toBeInTheDocument()
    expect(within(log()).getByText('Great')).toBeInTheDocument()
    expect(within(log()).getByText(/good to hear/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, let's train/i })).toBeInTheDocument()
  })

  it('after a talk that ended elsewhere, keeps it and opens a new question below', async () => {
    const user = userEvent.setup()
    const dash = renderAt('/dashboard')
    await user.click(screen.getByRole('button', { name: 'Tough' }))
    dash.unmount()

    renderAt()
    expect(within(log()).getByText('Tough')).toBeInTheDocument()
    expect(within(log()).getByText(/sorry it was tough/i)).toBeInTheDocument()
    expect(within(log()).getAllByText('How was your day?')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Great' })).toBeInTheDocument()
  })

  it('a talk that ends in place keeps the history and moves focus to the conversation', async () => {
    const user = userEvent.setup()
    renderAt()
    await user.click(screen.getByRole('button', { name: 'Tough' }))
    expect(within(log()).getByText(/sorry it was tough/i)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /reply to loti/i })).toBeNull()
    expect(log()).toHaveFocus()
  })

  it('a train chip records the reply and leaves for the exercise', async () => {
    const user = userEvent.setup()
    renderAt()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    await user.click(screen.getByRole('button', { name: /yes, let's train/i }))
    expect(screen.getByTestId('where').textContent).not.toBe('/coach')
    expect(useLotiSession.getState().turns.at(-1)).toEqual({ from: 'you', text: "Yes, let's train" })
  })

  it('"Start over" is hidden on a fresh talk, then clears the history and asks again', async () => {
    const user = userEvent.setup()
    renderAt()
    expect(screen.queryByRole('button', { name: /start over/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    await user.click(screen.getByRole('button', { name: /start over/i }))
    expect(within(log()).queryByText(/good to hear/i)).toBeNull()
    expect(within(log()).queryByText('Great')).toBeNull()
    expect(within(log()).getByText('How was your day?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Great' })).toHaveFocus()
    expect(useLotiSession.getState().turns).toEqual([])
  })

  it('Escape does nothing destructive', async () => {
    const user = userEvent.setup()
    renderAt()
    await user.click(screen.getByRole('button', { name: 'Great' }))
    await user.keyboard('{Escape}')
    expect(within(log()).getByText('Great')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, let's train/i })).toBeInTheDocument()
  })

  it('works from the keyboard: Tab to a chip, Enter picks it', async () => {
    const user = userEvent.setup()
    renderAt()
    screen.getByRole('button', { name: 'Okay' }).focus()
    await user.keyboard('{Enter}')
    expect(within(log()).getByText(/thanks for telling me/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, let's try one/i })).toHaveFocus()
  })
})
