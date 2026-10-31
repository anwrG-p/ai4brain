import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import TrainPage from '../../pages/TrainPage'
import { EXERCISE_NAME } from '../assessment/names'
import { PILLAR_LABELS } from '../insights/pillars'
import { useSessionStore } from '../insights/sessionStore'
import { useAppStore } from '../../state/useAppStore'

function RunnerProbe() {
  const { pathname, search } = useLocation()
  return <p>runner {pathname + search}</p>
}

// ponytail: /train is wired in App.tsx by ticket 09a; this harness routes it locally.
function renderTrain(url = '/train') {
  render(
    <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/train" element={<TrainPage />} />
        <Route path="/task/:dimId" element={<RunnerProbe />} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.getByTestId('train-page')
}

const pillarHeadings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim())
const primaries = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('a, button')).filter((el) => /(^|\s)bg-brand(\s|$)/.test(el.className))

// Visible words: screen-reader-only text does not count.
function visibleWords(root: HTMLElement): number {
  const copy = root.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.sr-only, [aria-hidden="true"]').forEach((n) => n.remove())
  return (copy.textContent ?? '').split(/\s+/).filter(Boolean).length
}

const SESSION = {
  id: 's1',
  at: '2026-10-30T10:00:00.000Z',
  inputs: {
    OSPAN: { score: 80, trials: 20 },
    ANT_Conflict: { score: 60, trials: 20 },
    SST_SSRT: { score: 70, trials: 20, proxy: true as const },
    MST_LDI: { score: 50, trials: 20 },
    UFOV_SOA: { score: 30, trials: 20 },
    ANT_Orienting: { score: 40, trials: 20 },
  },
}

describe('Train (/train)', () => {
  beforeEach(() => {
    useAppStore.getState().resetDemoState()
    act(() => useSessionStore.setState({ sessions: [] }))
  })
  afterEach(() => {
    act(() => useAppStore.getState().setReducedMotion(false))
  })

  it('has one h1 and the five pillars in order', () => {
    renderTrain()
    expect(screen.getByRole('heading', { level: 1, name: 'Train' })).toBeInTheDocument()
    expect(pillarHeadings()).toEqual(['Focus & Strategy', 'Mental Agility', 'Impulse Control', 'Deep Memory', 'Visual Radar'])
  })

  it('names every exercise exactly once', () => {
    const page = renderTrain()
    for (const name of Object.values(EXERCISE_NAME)) {
      expect(within(page).getAllByText(name)).toHaveLength(1)
    }
  })

  it('gives each exercise one Start link to its runner route', () => {
    renderTrain()
    const link = (name: string) => screen.getByRole('link', { name: `Start ${name}` })
    expect(link('Color Clash')).toHaveAttribute('href', '/task/inhibition_control?schema=stroop')
    expect(link('Memory Gauntlet')).toHaveAttribute('href', '/task/working_memory?schema=n_back')
    expect(link('Precision Archive')).toHaveAttribute('href', '/task/episodic_pattern_separation?schema=mst')
    expect(link('Perceptual Radar')).toHaveAttribute('href', '/task/attention_networks?schema=ufov')
    expect(link('Shape Turn')).toHaveAttribute('href', '/task/visuospatial_planning_gf?schema=mental_rotation')
    expect(screen.getAllByRole('link', { name: /^Start / })).toHaveLength(Object.keys(EXERCISE_NAME).length)
  })

  it('makes each row the link: the name and a chevron, "Start" shown only on the one primary', () => {
    const page = renderTrain()
    const row = screen.getByRole('link', { name: 'Start Logic Web' })
    expect(row).toHaveTextContent(/^Logic Web$/)
    expect(row.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    const startWords = (page.textContent ?? '').match(/\bStart\b/g) ?? []
    expect(startWords).toHaveLength(1)
    expect(primaries(page)[0]).toHaveTextContent('Start Strategic Blueprint')
  })

  it('Start opens the runner', () => {
    renderTrain()
    fireEvent.click(screen.getByRole('link', { name: 'Start Logic Web' }))
    expect(screen.getByText('runner /task/visuospatial_planning_gf?schema=relational')).toBeInTheDocument()
  })

  it('without data: a neutral Loti line, a dash for every score, the first exercise is the one primary', () => {
    const page = renderTrain()
    expect(within(page).getByRole('img', { name: /Loti/ })).toBeInTheDocument()
    expect(screen.getByText('Pick any exercise to start.')).toBeInTheDocument()
    expect(within(page).getAllByText('—')).toHaveLength(5)
    expect(primaries(page).map((el) => el.getAttribute('aria-label') ?? el.textContent)).toEqual(['Start Strategic Blueprint'])
    expect(document.activeElement).toBe(document.body) // a plain visit does not move focus
  })

  it('with a session: plain scores, the weakest pillar first, its first exercise primary', () => {
    act(() => useSessionStore.setState({ sessions: [SESSION] }))
    const page = renderTrain()
    expect(screen.getByText(`${PILLAR_LABELS.visual} could use some care today.`)).toBeInTheDocument()
    expect(pillarHeadings()[0]).toBe('Visual Radar')
    const visual = screen.getByRole('region', { name: 'Visual Radar' })
    expect(within(visual).getByText('35')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Focus & Strategy' })).getByText('80')).toBeInTheDocument()
    expect(primaries(page).map((el) => el.getAttribute('aria-label'))).toEqual(['Start Perceptual Radar'])
  })

  it('?pillar= puts that pillar first, highlights it and moves focus to it', () => {
    act(() => useSessionStore.setState({ sessions: [SESSION] }))
    const page = renderTrain('/train?pillar=memory')
    expect(pillarHeadings()[0]).toBe('Deep Memory')
    const memory = screen.getByRole('region', { name: 'Deep Memory' })
    expect(document.activeElement).toBe(memory)
    expect(memory).toHaveAttribute('data-current', 'true')
    expect(memory).toHaveClass('focus-ring') // a visible ring on :focus-visible
    expect(screen.getByText(`Let's train ${PILLAR_LABELS.memory} today.`)).toBeInTheDocument()
    expect(primaries(page).map((el) => el.getAttribute('aria-label'))).toEqual(['Start Precision Archive'])
  })

  it('skips pillars with no exercise in the active set, and never puts them first', () => {
    act(() => {
      useSessionStore.setState({ sessions: [SESSION] })
      useAppStore.getState().setDimensionPreset('3') // n-back and Color Clash only
    })
    const page = renderTrain('/train?pillar=memory')
    // Visual Radar is the weakest overall and Deep Memory was asked for; neither is listed.
    expect(pillarHeadings()).toEqual(['Mental Agility', 'Impulse Control'])
    expect(document.activeElement).toBe(document.body)
    expect(screen.getByText(`${PILLAR_LABELS.agility} could use some care today.`)).toBeInTheDocument()
    expect(primaries(page).map((el) => el.getAttribute('aria-label'))).toEqual(['Start Memory Gauntlet'])
    for (const section of screen.getAllByRole('region')) {
      expect(within(section).getAllByRole('link').length).toBeGreaterThan(0)
    }
  })

  it('ignores an unknown ?pillar=', () => {
    renderTrain('/train?pillar=nope')
    expect(pillarHeadings()[0]).toBe('Focus & Strategy')
    expect(document.activeElement).toBe(document.body)
  })

  it('shows no technical words', () => {
    act(() => useSessionStore.setState({ sessions: [SESSION] }))
    const page = renderTrain()
    expect(page.textContent).not.toMatch(/v1\/|QUEST|JSON|SAT-JEPA|contract|receipt|telemetry|schema|dimension|±|σ/i)
  })

  it('stays short: one line per pillar at most, under 90 visible words in all', () => {
    const page = renderTrain()
    expect(visibleWords(page)).toBeLessThanOrEqual(90)
    for (const section of screen.getAllByRole('region')) {
      expect(section.querySelectorAll('p:not(.sr-only)').length).toBeLessThanOrEqual(2) // the score and one line
    }
  })

  it('enters gently when motion is on', () => {
    const page = renderTrain()
    expect(page.querySelectorAll('[class*="anim-"]').length).toBeGreaterThan(0)
  })

  it('reduced motion: no entrance classes', () => {
    act(() => useAppStore.getState().setReducedMotion(true))
    const page = renderTrain()
    expect(page.querySelectorAll('[class*="anim-"]')).toHaveLength(0)
  })
})
