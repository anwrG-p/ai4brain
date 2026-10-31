import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { evaluateDesignSystemContrast } from '../utils/contrast'
import { lintCopyText } from '../utils/copyLinter'
import { getDimensionsByPreset } from '../config/dimensions'
import { useAppStore } from '../state/useAppStore'
import { App } from '../App'

describe('Wave 1 & Wave 2 Pages & Design System Unit Suite', () => {
  beforeEach(() => {
    useAppStore.getState().resetDemoState()
  })
  it('verifies all Light & Dark token pairs pass WCAG 2.1 thresholds', () => {
    const reports = evaluateDesignSystemContrast()
    expect(reports.length).toBeGreaterThanOrEqual(20)
    for (const report of reports) {
      expect(report.passes, `${report.id} failed with ${report.ratio}:1`).toBe(true)
    }
  })

  it('flags clinical and punitive-guilt vocabulary in lintCopyText', () => {
    const clean = lintCopyText(
      'Your Working Memory estimate is 76% ± 5%. Two more blocks will narrow the range.',
    )
    expect(clean.isClean).toBe(true)
    expect(clean.violations).toHaveLength(0)

    const flagged = lintCopyText(
      'Patient shows ADHD deficit and you broke your 5-day streak.',
    )
    expect(flagged.isClean).toBe(false)
    expect(flagged.violations.length).toBeGreaterThanOrEqual(3)
  })

  it('scales DimensionRegistry cleanly across 3, 6, 7, 8, and 10 dimensions', () => {
    expect(getDimensionsByPreset('3')).toHaveLength(3)
    expect(getDimensionsByPreset('6')).toHaveLength(6)
    expect(getDimensionsByPreset('7')).toHaveLength(7)
    expect(getDimensionsByPreset('8')).toHaveLength(8)
    expect(getDimensionsByPreset('10')).toHaveLength(10)
  })

  it('renders Page 01 Welcome (/): Loti greets, Start goes to the baseline', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    const heading = await screen.findByRole('heading', { level: 1, name: "Hi, I'm Loti." }, { timeout: 5000 })
    expect(heading).toBeInTheDocument()

    const startBtn = screen.getByRole('button', { name: 'Start' })
    fireEvent.click(startBtn)
    expect(await screen.findByRole('heading', { level: 1, name: 'Your first check-in' })).toBeInTheDocument()
  })

  it('renders Page 06 Dashboard (/dashboard) with classroom lecture stage, Teacher Brian, and Core Balance Insights', async () => {
    window.history.pushState({}, '', '/dashboard')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Good morning|Welcome back/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    expect(screen.getByTestId('brian-teacher-slot')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Start Today\'s 2-Min Flow/i }),
    ).toBeInTheDocument()
    // Test clicking a cognitive dimension chip on the interactive radar
    const wmBtn = screen.getAllByRole('button', { name: /WM/i })[0]!
    fireEvent.click(wmBtn)
    expect(screen.getByText(/Working Memory/i)).toBeInTheDocument()
    expect(screen.getByText(/Core Balance Insights/i)).toBeInTheDocument()
  })

  it('renders Page 13 Privacy (/privacy): consent in one line, one sentence, Delete my data (09d)', async () => {
    window.history.pushState({}, '', '/privacy')
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByTestId('consent-line')).toBeInTheDocument()
    expect(screen.getByText('We record answer timing and accuracy only. No camera, no microphone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete my data' })).toBeInTheDocument()
    expect(screen.queryByText(/JSON|receipt|never collected/i)).toBeNull()
  })

  it('renders Page 14 Settings (/settings): theme and reduce motion only (09d)', async () => {
    window.history.pushState({}, '', '/settings')
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' }, { timeout: 5000 })).toBeInTheDocument()
    const dark = screen.getByRole('radio', { name: 'Dark (Night Lab)' })
    fireEvent.click(dark)
    expect(dark).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Reduce motion' })).toBeInTheDocument()
    expect(screen.queryByText(/Dimension|Shortcut|Factory/i)).toBeNull()
  })

});
