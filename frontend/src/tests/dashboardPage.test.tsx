import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGoalsStore } from '../features/insights/goals'
import { NOT_MEASURED } from '../features/insights/PillarRadar'
import type { TaskScores } from '../features/insights/pillars'
import { useSessionStore, type SessionRecord } from '../features/insights/sessionStore'
import DashboardPage from '../pages/DashboardPage'
import { useAppStore } from '../state/useAppStore'
import { useEmilyStore } from '../state/useEmilyStore'

/* Home = /dashboard (ticket 08). Real sessions from the session store; need-to-know only (rules 13, 14). */

const future = { v7_startTransition: true, v7_relativeSplatPath: true }
const DAY = 86_400_000
const WEEK = 7 * DAY

function full(s: number, memory = s): TaskScores {
  const i = { score: s, trials: 40 }
  return {
    OSPAN: i,
    OTS_Planning: i,
    OTS_Execution: i,
    FluidMatrices: i,
    ANT_Conflict: i,
    DCCS_SwitchCost: i,
    ErrorRecovery: i,
    SST_SSRT: { ...i, proxy: true },
    MST_LDI: { score: memory, trials: 40 },
    UFOV_SOA: i,
    ANT_Orienting: i,
  }
}
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
/** n sessions a week apart, the last one yesterday; scores rise 40, 44, 48, ... */
const sessions = (n: number, memoryLast?: number): SessionRecord[] =>
  Array.from({ length: n }, (_, k) => ({
    id: `s${k}`,
    at: ago((n - 1 - k) * WEEK + DAY),
    inputs: full(40 + 4 * k, k === n - 1 && memoryLast !== undefined ? memoryLast : 40 + 4 * k),
  }))

function seed(list: SessionRecord[]) {
  useSessionStore.setState({ sessions: list })
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']} future={future}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/baseline" element={<h1>Baseline page</h1>} />
        <Route path="/train" element={<TrainStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

function TrainStub() {
  return <h1>Train {useLocation().search}</h1>
}

const page = () => document.querySelector('[data-page="home"]') as HTMLElement
const fold = () => page().querySelector('[data-fold]') as HTMLElement

/** Words a sighted user reads: everything but screen-reader-only text. */
function visibleWords(el: HTMLElement): number {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return (clone.textContent ?? '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/).filter((w) => /[\p{L}\p{N}—]/u.test(w)).length
}

beforeEach(() => {
  // Loti's opening depends on the weekday and hour: a Wednesday afternoon (only Date is faked).
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T15:00:00'))
  useAppStore.getState().resetDemoState()
  useEmilyStore.getState().reset()
  useSessionStore.getState().clearSessions()
  useGoalsStore.getState().clearGoals()
})

afterEach(() => {
  cleanup() // unmount first: clearing the stores below would otherwise update a mounted page outside act()
  vi.useRealTimers()
  useSessionStore.getState().clearSessions()
  useGoalsStore.getState().clearGoals()
  localStorage.clear()
})

describe('Home (/dashboard)', () => {
  it('has exactly one primary button, "Start today\'s session", which trains the weakest pillar', async () => {
    const list = sessions(4)
    list[3]!.inputs.UFOV_SOA = { score: 5, trials: 40 }
    seed(list)
    renderHome()
    const primaries = [...document.querySelectorAll('button')].filter((b) => b.className.includes('bg-brand '))
    expect(primaries.map((b) => b.textContent)).toEqual(["Start today's session"])
    await userEvent.click(primaries[0]!)
    expect(screen.getByRole('heading', { name: 'Train ?pillar=visual' })).toBeInTheDocument()
  })

  it('with no data, "Start today\'s session" opens the five-exercise baseline', async () => {
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: "Start today's session" }))
    expect(screen.getByRole('heading', { name: 'Baseline page' })).toBeInTheDocument()
  })

  it('above the fold: 3 blocks, at most 2 quiet controls besides the primary, and 60 words or fewer', () => {
    for (const n of [0, 1, 4]) {
      seed(sessions(n))
      const { unmount } = renderHome()
      expect(fold().children, `${n} sessions`).toHaveLength(3)
      // Nothing else sits before the progress curve.
      const progress = screen.getByRole('region', { name: 'Your progress' })
      expect([...page().children].indexOf(progress)).toBe(1)
      expect(within(fold()).getAllByRole('button').length, `${n} sessions`).toBeLessThanOrEqual(3)
      expect(visibleWords(fold()), `${n} sessions`).toBeLessThanOrEqual(60)
      unmount()
    }
  })

  it('greets by name, with Momo beside the greeting', () => {
    useAppStore.getState().loginUser({ preferredName: 'Mazen', email: '', focusGoal: '' })
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Hi, Mazen' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Momo/ })).toBeInTheDocument()
  })

  it('Momo follows the mood store, and the mood only changes the canvas tint class (no red, no banner)', () => {
    renderHome()
    expect(page()).toHaveClass('mood-tint-calm')
    act(() => useEmilyStore.setState({ currentEmotion: 'fatigued' }))
    expect(page()).toHaveClass('mood-tint-tired')
    expect(page()).not.toHaveClass('mood-tint-calm')
    expect(screen.getByRole('img', { name: 'Momo looks tired' })).toBeInTheDocument()
    act(() => useEmilyStore.setState({ currentEmotion: 'frustrated' }))
    expect(page()).toHaveClass('mood-tint-frustrated')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(page().innerHTML).not.toMatch(/danger|\bred\b|stroop-red/)
  })

  it('no sessions: the radar shows "—", the table says "Not measured yet", Loti says what to do', () => {
    renderHome()
    const svg = document.querySelector('figure svg')!
    expect(svg.textContent!.match(/—/g)).toHaveLength(5)
    const table = screen.getByRole('table', { name: 'Your five skills, out of 100' })
    expect(within(table).getAllByText(NOT_MEASURED)).toHaveLength(5)
    expect(screen.getByText('Your first session fills in your five skills.')).toBeInTheDocument()
    expect(screen.getByText('Finish one session to see your curve.')).toBeInTheDocument()
  })

  it('one and two sessions: the radar is filled, the curve shows the real points and no projection yet', () => {
    for (const n of [1, 2]) {
      seed(sessions(n))
      const { unmount } = renderHome()
      expect(document.querySelector('figure svg')!.textContent).not.toContain('—')
      expect(document.querySelectorAll('[data-session]')).toHaveLength(n)
      expect(document.querySelector('[data-line="keep"]')).toBeNull()
      unmount()
    }
  })

  it('the Loti line is one clickable bubble that opens the talk', async () => {
    const list = sessions(2)
    list[1]!.inputs.MST_LDI = { score: 10, trials: 40 }
    seed(list)
    renderHome()
    const line = screen.getByRole('button', { name: /Deep Memory could use some care/ })
    await userEvent.click(line)
    expect(screen.getByRole('button', { name: "Yes, let's train" })).toHaveFocus()
  })

  it('"View as table" reveals a 5-row table with each score\'s range; the radar keeps one number', async () => {
    seed(sessions(4))
    renderHome()
    expect(document.querySelector('figure svg')!.textContent).not.toContain('likely')
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }))
    const table = screen.getByRole('table', { name: 'Your five skills, out of 100' })
    expect(table).not.toHaveClass('sr-only')
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(within(table).getByRole('row', { name: /^Deep Memory 52 · likely \d+–\d+$/ })).toBeInTheDocument()
  })

  it('"Real improvement" shows only on a pillar that passes RCI >= 1.96', () => {
    // 3 sessions: 40, 44, 48 everywhere; memory's last is 40 + 13 = 53 (RCI 2.06), the rest +8 (1.26).
    seed(sessions(3, 53))
    const { unmount } = renderHome()
    const tags = [...document.querySelectorAll('[data-real-improvement]')].map((t) => t.getAttribute('data-real-improvement'))
    expect(tags).toEqual(['memory'])
    unmount()
    seed(sessions(3, 52)) // +12: RCI 1.90
    renderHome()
    expect(document.querySelector('[data-real-improvement]')).toBeNull()
  })

  it('default view: no uncertainty band, no legend over 2 items, no toggles but "View as table"', () => {
    seed(sessions(4))
    renderHome()
    expect(document.querySelector('[data-uncertainty-band]')).toBeNull()
    for (const list of screen.queryAllByRole('list')) expect(within(list).getAllByRole('listitem').length).toBeLessThanOrEqual(2)
    const legend = screen.getByRole('list', { name: 'Line styles' })
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Your score', 'If you keep training'])
    // One dashed projection, no dotted "If you pause" line (user decision, 2026-10-31).
    expect(document.querySelector('[data-line="keep"]')).toHaveAttribute('stroke-dasharray')
    expect(document.querySelector('[data-line="pause"]')).toBeNull()
    expect(page().textContent).not.toMatch(/if you pause/i)
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual(expect.arrayContaining(['View as table', 'Further explore my training']))
    expect(names.filter((n) => /bars|radar|band|range/i.test(n ?? ''))).toEqual([])
  })

  it('"Further explore my training" is closed by default; open, it holds the heatmap legend and why Loti picked this, not the ranges', async () => {
    // Four weekly sessions on all five exercises: 20+ cells, so a heatmap.
    seed(sessions(5))
    renderHome()
    const toggle = screen.getByRole('button', { name: 'Further explore my training' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Score scale' })).toBeNull()
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('list', { name: 'Score scale' })).toBeInTheDocument()
    // Ranges live in the "View as table" only (user decision, 2026-10-31).
    expect(screen.queryByText(/likely/, { ignore: '.sr-only, .sr-only *' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Why Loti picked this' })).toBeInTheDocument()
    expect(screen.getByText(/is your lowest score right now/)).toBeInTheDocument()
  })

  // Review fix: each goal shows against its own pillar, from the score it had when the goal was set,
  // so it can never look met on the day it is set; the overall curve has no goal marker.
  it('sets a goal from "Further explore": shown against its own pillar, from today’s score, never met at once', async () => {
    seed(sessions(3)) // Deep Memory's latest score: 48
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Further explore my training' }))
    await userEvent.click(screen.getByRole('button', { name: 'Set a goal' }))
    await userEvent.click(screen.getByRole('button', { name: 'Deep Memory' }))
    await userEvent.click(screen.getByRole('button', { name: 'Steady (+10)' }))
    expect(useGoalsStore.getState()).toMatchObject({ goals: { memory: 10 }, bases: { memory: 48 } })
    const goals = screen.getByRole('list', { name: 'Your goals this year' })
    expect(within(goals).getByRole('listitem')).toHaveTextContent(/^Deep Memory 48 → goal 58$/)
    expect(goals.textContent).not.toMatch(/reached/i)
    // One line in "View as table", and nothing on the overall curve.
    expect(screen.getByRole('row', { name: /^Deep Memory 48 · likely \d+–\d+ · goal 58$/ })).toBeInTheDocument()
    expect(document.querySelector('[data-goal]')).toBeNull()
  })

  it('a goal set before its pillar was measured takes its start from the first score, then is reached only by that pillar', () => {
    useGoalsStore.setState({ year: 2026, goals: { memory: 10 }, bases: {} })
    seed(sessions(3))
    const { unmount } = renderHome()
    expect(useGoalsStore.getState().bases).toEqual({ memory: 48 })
    fireEvent.click(screen.getByRole('button', { name: 'Further explore my training' }))
    expect(screen.getByText(/^Deep Memory 48 → goal 58$/)).toBeInTheDocument()
    unmount()
    const later = sessions(4)
    later[3]!.inputs.MST_LDI = { score: 60, trials: 40 }
    seed(later)
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Further explore my training' }))
    expect(screen.getByText(/^Deep Memory 60 → goal 58 · reached$/)).toBeInTheDocument()
  })

  it('motion: the blocks enter in sequence and the radar grows once; none with reduced motion', () => {
    seed(sessions(4))
    const { unmount } = renderHome()
    const blocks = [...fold().children] as HTMLElement[]
    expect(blocks.every((b) => b.classList.contains('anim-enter'))).toBe(true)
    expect(blocks.map((b) => b.style.getPropertyValue('--i'))).toEqual(['0', '1', '2'])
    expect(document.querySelector('.anim-radar-grow polygon')).not.toBeNull()
    unmount()
    useAppStore.getState().setReducedMotion(true)
    renderHome()
    expect(page().querySelector('[class*="anim-"]')).toBeNull()
  })

  it('no <img>, no emoji, no gradient classes', () => {
    seed(sessions(5))
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Further explore my training' }))
    expect(page().querySelectorAll('img')).toHaveLength(0)
    expect(page().textContent).not.toMatch(/\p{Extended_Pictographic}/u)
    for (const el of page().querySelectorAll('[class]')) {
      expect(el.getAttribute('class')).not.toMatch(/gradient|bg-linear|bg-radial|from-|via-/)
    }
  })
})
