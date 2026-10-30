import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tracker } from '../features/assessment/telemetry/tracker'
import type { TelemetryEvent } from '../features/assessment/telemetry/types'
import TaskRunnerPage from '../pages/TaskRunnerPage'
import { useAppStore } from '../state/useAppStore'

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
  useAppStore.getState().resetDemoState()
})

// Unmount first so the purge below does not re-render a mounted page outside act().
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  tracker.clear()
})

describe('TaskRunnerPage mounts the real exercises', () => {
  it('pressing "1" while N-back runs triggers no page answer handler; Escape still pauses (R4, R3)', async () => {
    renderAt('/task/working_memory')
    await screen.findByRole('region', { name: 'Memory Sharpness' })

    fireEvent.keyDown(window, { key: '1' })
    fireEvent.click(screen.getByRole('button', { name: /View Telemetry as Table/i }))
    expect(dataRows()).toHaveLength(0) // no fabricated event, no seeded row
    expect(screen.getByRole('region', { name: 'Memory Sharpness' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('heading', { name: /Trial Auto-Paused — Focus Left Window/i })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Memory Sharpness' })).toBeNull() // unmounted

    fireEvent.click(screen.getByRole('button', { name: /Resume/i }))
    expect(await screen.findByRole('region', { name: 'Memory Sharpness' })).toBeInTheDocument()
  })

  it('?schema= picks the exercise of the current dimension; evaluator buttons switch it (R2)', async () => {
    renderAt('/task/visuospatial_planning_gf?schema=tower')
    expect(await screen.findByRole('region', { name: 'Tower puzzle' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exercise: relational' }))
    expect(await screen.findByRole('region', { name: 'Word relations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exercise: mental_rotation' })).toBeInTheDocument()
  })

  it('a ?schema= outside the dimension falls back to its first schema type', async () => {
    renderAt('/task/visuospatial_planning_gf?schema=ufov')
    expect(await screen.findByRole('region', { name: 'Pattern puzzle' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exercise: ufov' })).toBeNull()
  })

  it('the table and the summary show real tracker events and status, never a fixed "202 Accepted" (R5)', async () => {
    renderAt('/task/episodic_pattern_separation')
    await screen.findByRole('region', { name: 'Shape memory' })
    act(() => {
      tracker.push(event())
      tracker.push(event({ trial_index: 1, score_norm: 0, error_flag: true, response_time_ms: 660 }))
    })

    fireEvent.click(screen.getByRole('button', { name: /View Telemetry as Table/i }))
    expect(dataRows()).toHaveLength(2)
    expect(dataRows()[0]).toHaveTextContent('episodic_memory')

    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(
      screen.getByRole('heading', { name: /Episodic Pattern Separation confidence interval narrowed!/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/202 Accepted/i)).toBeNull()
    expect(screen.getByText(/Accuracy 50% · 650 ms/)).toBeInTheDocument()
    expect(screen.getByText(/2 waiting to send/i)).toBeInTheDocument()
    // No made-up confidence number tied to the answer count.
    expect(screen.queryByText(/\d+% → \d+%/)).toBeNull()
  })

  it('counts and averages every event of the block, though the table keeps only the latest 50', async () => {
    renderAt('/task/episodic_pattern_separation')
    await screen.findByRole('region', { name: 'Shape memory' })
    act(() => {
      // 50 correct at 600 ms, then 1 error at 2100 ms: mean RT 32100/51 = 629, accuracy 50/51 = 98%.
      for (let i = 0; i < 50; i++) tracker.push(event({ trial_index: i, response_time_ms: 600 }))
      tracker.push(event({ trial_index: 50, error_flag: true, score_norm: 0, response_time_ms: 2100 }))
    })
    expect(screen.getByText('Recorded: 51')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    expect(screen.getByText(/Accuracy 98% · 629 ms/)).toBeInTheDocument()
    expect(screen.getByText(/^Telemetry: 51 recorded/)).toBeInTheDocument()
    expect(dataRows()).toHaveLength(50)
    expect(screen.getByText(/latest 50 of 51/i)).toBeInTheDocument()
  })

  it('the completed drawer has no card chrome around the WhyThisPanel card', async () => {
    renderAt('/task/episodic_pattern_separation')
    await screen.findByRole('region', { name: 'Shape memory' })
    fireEvent.click(screen.getByRole('button', { name: /Fast-Forward to Summary/i }))
    const drawer = screen.getByText('Show details').closest('details')!
    const panel = drawer.querySelector('.editorial-card, .tactile-card, .hero-card')
    expect(panel).not.toBeNull()
    for (let el = panel!.parentElement; el && el !== document.body; el = el.parentElement) {
      expect(el.className).not.toMatch(/\bborder\b|card/)
    }
  })
})
