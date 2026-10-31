import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tracker } from '../features/assessment/telemetry/tracker'
import type { TelemetryEvent } from '../features/assessment/telemetry/types'
import { useSessionStore } from '../features/insights/sessionStore'
import TaskRunnerPage from '../pages/TaskRunnerPage'
import { useAppStore } from '../state/useAppStore'
import { begin } from './exerciseFrame'

// Same flags as App.tsx, so the router prints no v7 warnings.
const future = { v7_startTransition: true, v7_relativeSplatPath: true }

const renderAt = (url: string) =>
  render(
    <MemoryRouter future={future} initialEntries={[url]}>
      <Routes>
        <Route path="/task/:dimId" element={<TaskRunnerPage />} />
      </Routes>
    </MemoryRouter>,
  )

// Browser Back, as a button inside the router.
function BackButton() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(-1)}>
      browser back
    </button>
  )
}

const event = (over: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
  user_id: 'u',
  session_id: 's',
  task_id: 'mock-mst-1.0',
  trial_index: 0,
  dimension: 'episodic_memory',
  score_norm: 1,
  response_time_ms: 640,
  error_flag: false,
  error_burst: 0,
  hesitation_jitter: 20,
  keystroke_latency_ms: 600,
  client_ts: '2026-10-30T00:00:00.000Z',
  ...over,
})

const dataRows = () =>
  within(screen.getByRole('table', { name: /Recorded trial telemetry events table/i }))
    .getAllByRole('row')
    .slice(1) // header

beforeEach(() => {
  sessionStorage.clear()
  useAppStore.getState().resetDemoState()
  useSessionStore.getState().clearSessions()
})

// Unmount first so the purge below does not re-render a mounted page outside act().
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  tracker.clear()
  sessionStorage.clear()
})

// A finished block sits on the frame's end card until Continue; a pause there must not discard it.
const finishMatrixBlock = async (query = '') => {
  renderAt(`/task/visuospatial_planning_gf?schema=matrix${query}`)
  const region = await begin('Pattern Puzzle')
  fireEvent.pointerDown(within(region).getAllByRole('button')[0]!) // the one trial
  expect(await screen.findByText('Nice work')).toBeInTheDocument()
}
const paused = () => screen.queryByRole('heading', { name: 'Paused' })
const completed = () => screen.getByRole('button', { name: 'Back to Train' })

describe('TaskRunnerPage mounts the real exercises', () => {
  it('pressing "1" while N-back runs triggers no page answer handler; Escape still pauses (R4, R3)', async () => {
    renderAt('/task/working_memory?judge=1')
    await begin('Memory Gauntlet')

    fireEvent.keyDown(window, { key: '1' })
    fireEvent.click(screen.getByRole('button', { name: /View Telemetry as Table/i }))
    expect(dataRows()).toHaveLength(0) // no fabricated event, no seeded row
    expect(screen.getByRole('region', { name: 'Memory Gauntlet' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('heading', { level: 1, name: 'Paused' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Memory Gauntlet' })).toBeNull() // unmounted

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(await begin('Memory Gauntlet')).toBeInTheDocument()
  })

  it('the running screen has the exercise, Exit and Pause only; its h1 is the consumer name (no research name)', async () => {
    renderAt('/task/episodic_pattern_separation')
    await begin('Precision Archive')
    expect(screen.getByRole('heading', { level: 1, name: 'Precision Archive' })).toBeInTheDocument()
    expect(screen.queryByText(/Mnemonic Similarity Task/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'Exit' })).toHaveAttribute('href', '/train')
    expect(screen.getByRole('button', { name: 'Pause trial' })).toBeInTheDocument()
    expect(screen.queryByText(/Recorded:|Zero-Distraction/i)).toBeNull()
  })

  it('the instruction screen has no Pause (rule 14: Begin plus Exit); Begin brings it, Resume hides it again', async () => {
    renderAt('/task/episodic_pattern_separation')
    expect(await screen.findByRole('button', { name: 'Begin' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause trial' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Exit' })).toBeInTheDocument()
    await begin('Precision Archive')
    fireEvent.click(screen.getByRole('button', { name: 'Pause trial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(await screen.findByRole('button', { name: 'Begin' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause trial' })).toBeNull()
  })

  it('?schema= picks the exercise of the current dimension; judge buttons switch it (R2)', async () => {
    renderAt('/task/visuospatial_planning_gf?schema=tower&judge=1')
    expect(await begin('Strategic Blueprint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exercise: relational' }))
    expect(await begin('Logic Web')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exercise: mental_rotation' })).toBeInTheDocument()
  })

  it('a ?schema= outside the dimension falls back to its first schema type', async () => {
    renderAt('/task/visuospatial_planning_gf?schema=ufov')
    expect(await begin('Pattern Puzzle')).toBeInTheDocument()
  })

  it('the judge table and the result line show real tracker events, never a fixed "202 Accepted" (R5)', async () => {
    renderAt('/task/episodic_pattern_separation?judge=1')
    await begin('Precision Archive')
    act(() => {
      tracker.push(event())
      tracker.push(event({ trial_index: 1, score_norm: 0, error_flag: true, response_time_ms: 660 }))
    })

    fireEvent.click(screen.getByRole('button', { name: /View Telemetry as Table/i }))
    expect(dataRows()).toHaveLength(2)
    expect(dataRows()[0]).toHaveTextContent('episodic_memory')

    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(screen.getByRole('heading', { level: 1, name: 'Precision Archive' })).toBeInTheDocument()
    expect(screen.queryByText(/202 Accepted/i)).toBeNull()
    expect(screen.getByText(/Accuracy 50% · 650 ms\./)).toBeInTheDocument()
  })

  it('counts and averages every event of the block, though the judge table keeps only the latest 50', async () => {
    renderAt('/task/episodic_pattern_separation?judge=1')
    await begin('Precision Archive')
    act(() => {
      // 50 correct at 600 ms, then 1 error at 2100 ms: mean RT 32100/51 = 629, accuracy 50/51 = 98%.
      for (let i = 0; i < 50; i++) tracker.push(event({ trial_index: i, response_time_ms: 600 }))
      tracker.push(event({ trial_index: 50, error_flag: true, score_norm: 0, response_time_ms: 2100 }))
    })
    expect(screen.getByText('Recorded: 51')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /View Telemetry as Table/i }))
    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(screen.getByText(/Accuracy 98% · 629 ms\./)).toBeInTheDocument()
    expect(dataRows()).toHaveLength(50)
  })

  it('the result screen is one honest line and one button, with nothing technical (FE-02, U1)', async () => {
    vi.spyOn(tracker, 'getStatus').mockReturnValue({
      isOnline: true,
      queuedCount: 0,
      droppedCount: 4,
      maxCapacity: 500,
      consent: 'denied',
    })
    renderAt('/task/episodic_pattern_separation?judge=1')
    await begin('Precision Archive')
    act(() => void tracker.push(event()))
    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    const screenEl = screen.getByRole('heading', { level: 1 }).parentElement!
    expect(within(screenEl).getAllByRole('button')).toHaveLength(1)
    expect(within(screenEl).getByRole('button', { name: 'Back to Train' })).toBeInTheDocument()
    expect(within(screenEl).queryByRole('link')).toBeNull()
    expect(screenEl.textContent).not.toMatch(/dropped|Sent to|POST|v1\/|Telemetry|QUEST|confidence interval|Calibrated|JSON/i)
  })

  it('a finished run is saved as a session, like the baseline, so it reaches the dashboard (FE-02)', async () => {
    await finishMatrixBlock()
    expect(useSessionStore.getState().sessions).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Pattern Puzzle' })).toBeInTheDocument()
    expect(screen.getByText(/Added to your progress\./)).toBeInTheDocument()
    const sessions = useSessionStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(Object.keys(sessions[0]!.inputs).length).toBeGreaterThan(0)
  })

  it('a paused attempt is discarded: its events are not scored or saved', async () => {
    renderAt('/task/episodic_pattern_separation?judge=1')
    await begin('Precision Archive')
    act(() => void tracker.push(event({ error_flag: true, score_norm: 0 })))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await begin('Precision Archive')
    expect(screen.getByText('Recorded: 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(screen.getByText('No answers this time.')).toBeInTheDocument()
    expect(useSessionStore.getState().sessions).toHaveLength(0)
  })

  // One real answer in a multi-trial exercise: the run has events of its own task but has not ended.
  const answerOneShapeTurn = async () => {
    renderAt('/task/visuospatial_planning_gf?schema=mental_rotation&judge=1')
    const region = await begin('Shape Turn')
    act(() => void fireEvent.pointerDown(within(region).getByRole('button', { name: /turned/i })))
    expect(await screen.findByText('Recorded: 1')).toBeInTheDocument()
  }

  it('Escape, then the judge "Block Summary": the discarded attempt is not saved', async () => {
    await answerOneShapeTurn()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(paused()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Block Summary' }))
    expect(screen.getByText('No answers this time.')).toBeInTheDocument()
    expect(useSessionStore.getState().sessions).toHaveLength(0)
  })

  it('a judge Fast-Forward mid-run shows the summary without saving a session', async () => {
    await answerOneShapeTurn()
    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(completed()).toBeInTheDocument()
    expect(screen.queryByText(/Added to your progress/)).toBeNull()
    expect(useSessionStore.getState().sessions).toHaveLength(0)
  })

  it('Back to another dimension resets the block, so its summary never shows the old totals', async () => {
    render(
      <MemoryRouter
        future={future}
        initialEntries={['/task/working_memory?judge=1', '/task/episodic_pattern_separation?judge=1']}
        initialIndex={1}
      >
        <BackButton />
        <Routes>
          <Route path="/task/:dimId" element={<TaskRunnerPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await begin('Precision Archive')
    act(() => {
      tracker.push(event())
      tracker.push(event({ trial_index: 1 }))
    })
    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(screen.getByText(/Accuracy 100% · 640 ms\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'browser back' }))
    expect(await begin('Memory Gauntlet')).toBeInTheDocument()
    expect(screen.getByText('Recorded: 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(screen.getByText('No answers this time.')).toBeInTheDocument()
  })

  it('a tab switch on the end card completes the block instead of pausing it; nothing replays', async () => {
    await finishMatrixBlock()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(paused()).toBeNull()
    expect(completed()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull() // no new task fetched
    expect(useSessionStore.getState().sessions).toHaveLength(1)
  })

  it('the end card has no Pause (Continue and Exit only); Escape there completes the block instead of pausing it', async () => {
    await finishMatrixBlock()
    expect(screen.queryByRole('button', { name: 'Pause trial' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Exit' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(paused()).toBeNull()
    expect(completed()).toBeInTheDocument()
  })

  it('the judge "Simulate Tab-Blur Pause" goes through pause(): on the end card it completes, never replays', async () => {
    await finishMatrixBlock('&judge=1')
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Tab-Blur Pause' }))
    expect(paused()).toBeNull()
    expect(completed()).toBeInTheDocument()
    expect(useSessionStore.getState().sessions).toHaveLength(1)
  })
})
