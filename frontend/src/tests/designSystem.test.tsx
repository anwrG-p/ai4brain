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

  it('renders Page 13 Privacy Center (/privacy) with Hardware Lock banner, Granular Consent controls, Live JSON Inspector, and Purge Modal', async () => {
    window.history.pushState({}, '', '/privacy')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Privacy Center & Sovereign Audit Log/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // Non-Biometric Hardware Lock Banner
    expect(
      screen.getByText(/Non-Biometric Hardware Lock Active/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Physically Disconnected/i),
    ).toBeInTheDocument()

    // Test Reject All Optional button
    fireEvent.click(
      screen.getByRole('button', {
        name: /Reject All Optional/i,
      }),
    )
    expect(screen.getAllByText(/Revoked/i).length).toBeGreaterThanOrEqual(2)

    // Test Restore Defaults button
    fireEvent.click(
      screen.getByRole('button', {
        name: /Restore Defaults/i,
      }),
    )
    expect(screen.getAllByText(/Active/i).length).toBeGreaterThanOrEqual(2)

    // Verify "What the AI Sees" Inspector code region
    expect(
      screen.getByRole('region', {
        name: /Live Telemetry JSON payload code view/i,
      }),
    ).toBeInTheDocument()

    // Verify Chronological Audit Log Table
    expect(
      screen.getByRole('region', {
        name: /Chronological Audit Event Log Table/i,
      }),
    ).toBeInTheDocument()

    // Test Right to Erasure / Purge All Data modal flow
    fireEvent.click(
      screen.getByRole('button', {
        name: /Purge All Data/i,
      }),
    )
    expect(
      screen.getByRole('heading', {
        name: /Confirm Irrevocable Data Purge/i,
      }),
    ).toBeInTheDocument()

    // Acknowledge checkbox and confirm purge
    const ackCheckbox = screen.getByRole('checkbox')
    fireEvent.click(ackCheckbox)
    expect(ackCheckbox).toBeChecked()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Permanently Purge All Data/i,
      }),
    )

    // Expect Deletion Certificate issued
    expect(
      screen.getByText(/Cryptographic Deletion Certificate Issued/i),
    ).toBeInTheDocument()
  })

  it('renders Page 14 Settings (/settings) with sensory controls, zoom preview, rest days, and factory reset', async () => {
    window.history.pushState({}, '', '/settings')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Settings & Accessibility Controls/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // 1. Verify 5 setting categories
    expect(screen.getByText(/1. Visual & Sensory Ergonomics/i)).toBeInTheDocument()
    expect(screen.getByText(/2. Motion & Vestibular Comfort/i)).toBeInTheDocument()
    expect(screen.getByText(/3. Auditory Feedback & Task Pacing/i)).toBeInTheDocument()
    expect(screen.getByText(/4. Non-Punitive Habit & Study Boundaries/i)).toBeInTheDocument()
    expect(screen.getByText(/5. Cognitive Dimension Pool Preset/i)).toBeInTheDocument()

    // 2. Test Calm Sensory Mode
    const calmBtn = screen.getByRole('button', { name: /Calm Sensory Mode/i })
    fireEvent.click(calmBtn)
    expect(screen.getByText(/Calm Sensory Mode engaged/i)).toBeInTheDocument()

    // 3. Test Theme Selector
    const darkThemeRadio = screen.getByRole('radio', { name: /Night Lab \(Dark\)/i })
    fireEvent.click(darkThemeRadio)
    expect(darkThemeRadio).toHaveAttribute('aria-checked', 'true')

    // 4. Test Text Scale
    const highZoomRadio = screen.getByRole('radio', { name: /130% \(High Zoom\)/i })
    fireEvent.click(highZoomRadio)
    expect(highZoomRadio).toHaveAttribute('aria-checked', 'true')

    // 5. Test Rest Days Toggle
    const fridayBtn = screen.getByRole('checkbox', { name: /Friday/i })
    fireEvent.click(fridayBtn)
    expect(fridayBtn).toHaveAttribute('aria-checked', 'true')

    // 6. Test Keyboard Shortcuts Table Accessibility
    const tableRegion = screen.getByRole('region', { name: /Keyboard Shortcuts Table/i })
    expect(tableRegion).toHaveAttribute('tabIndex', '0')
    expect(screen.getByText(/Select Probe Option 1/i)).toBeInTheDocument()

    // 7. Test Factory Reset
    const resetBtn = screen.getByRole('button', { name: /Reset All Preferences to Factory Defaults/i })
    fireEvent.click(resetBtn)
    expect(screen.getByText(/All settings and accessibility preferences restored to factory defaults/i)).toBeInTheDocument()
  })

});
