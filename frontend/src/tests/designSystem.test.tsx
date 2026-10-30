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

  it('renders Page 01 Welcome (/) and supports starting baseline assessment and viewing how it works', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Let's map how your mind works/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    const startBtn = screen.getByRole('button', {
      name: /Start my 2-minute baseline/i,
    })
    expect(startBtn).toBeInTheDocument()
    expect(screen.getByText(/How SynapseTwin Works/i)).toBeInTheDocument()
    expect(screen.getByText(/2-Minute Micro-Games/i)).toBeInTheDocument()
    expect(screen.getByText(/Your Living Brain Twin/i)).toBeInTheDocument()
    expect(screen.getByText(/Zero-Guilt Growth/i)).toBeInTheDocument()

    fireEvent.click(startBtn)
    expect(
      await screen.findByRole('heading', {
        name: /Configure your cognitive twin on your own terms/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders Page 02 Onboarding (/onboarding) and supports 3-step wizard, granular consent toggles, and Judge Fast-Track', async () => {
    window.history.pushState({}, '', '/onboarding')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Configure your cognitive twin on your own terms/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Continue to Step 2: Granular Consent/i,
      }),
    )
    expect(
      screen.getByRole('heading', {
        name: /Granular Telemetry Consent & Mandatory Non-Biometric Lock/i,
      }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Reject All Optional \(Minimal Mode\)/i,
      }),
    )
    expect(
      screen.getAllByText(/CONSENT-ST-2026-MINIMAL/i).length,
    ).toBeGreaterThanOrEqual(1)

    fireEvent.click(
      screen.getByRole('button', {
        name: /Judge Fast-Track: Safe Defaults & Go/i,
      }),
    )
    expect(
      screen.getAllByText(/CONSENT-ST-2026-FAST/i).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('renders Page 03 Assessment Hub (/assessment) and supports session modes, table toggle, and /v1/tasks/next payload inspector', async () => {
    window.history.pushState({}, '', '/assessment')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Calibrate your cognitive twin—2-minute adaptive micro-tasks/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /View Task Queue as Table/i }),
    )
    expect(
      screen.getByRole('table', {
        name: /Assessment Hub cognitive task queue table/i,
      }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Inspect Payload JSON/i }),
    )
    expect(
      screen.getByText(/low_confidence_hatched_band_narrowing/i),
    ).toBeInTheDocument()
  })

  it('renders Page 04 Task Runner (/task/:dimId) with Zero-Distraction Mascot Lock, Tab-Blur Auto-Pause, and live telemetry table toggle', async () => {
    window.history.pushState({}, '', '/task/episodic_pattern_separation')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Mnemonic Similarity Task/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()
    expect(
      screen.getByText(/Zero-Distraction Lock: Mascot Hidden/i),
    ).toBeInTheDocument()

    // Toggle Telemetry Table
    fireEvent.click(
      screen.getByRole('button', { name: /View Telemetry as Table/i }),
    )
    expect(
      screen.getByRole('table', {
        name: /Recorded trial telemetry events table/i,
      }),
    ).toBeInTheDocument()

    // Trigger Tab-Blur Auto-Pause
    fireEvent.click(
      screen.getByRole('button', { name: /Simulate Tab-Blur Pause/i }),
    )
    expect(
      screen.getByRole('heading', {
        name: /Trial Auto-Paused — Focus Left Window/i,
      }),
    ).toBeInTheDocument()

    // Resume and Fast-Forward to Summary (where Mascot Celebrate re-engages)
    fireEvent.click(
      screen.getByRole('button', { name: /Fast-Forward to Summary/i }),
    )
    expect(
      screen.getByRole('heading', {
        name: /Episodic Pattern Separation confidence interval narrowed!/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders Page 05 Profile Reveal (/profile-reveal) and supports 5-state Mascot switcher, confidence filters, and snapshot JSON inspector', async () => {
    window.history.pushState({}, '', '/profile-reveal')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Meet your initial Cognitive Twin—calibrated strengths/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /First-Session Hatched \(Salma/i,
      }),
    )
    expect(
      screen.getByText(/Exploratory Fast-Responder \(Preliminary Profile\)/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'thinking' }))
    expect(screen.getByText(/State: thinking/i)).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Inspect Snapshot JSON/i }),
    )
    expect(screen.getByText(/SNAP-2026-SALMA-01/i)).toBeInTheDocument()
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

  it('renders Page 08 Brain Twin (/brain-twin) with Signature #2 BrainTwinTimeTravel scrubber, snapshot diff table toggle, and manifold trajectory', async () => {
    window.history.pushState({}, '', '/brain-twin')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Longitudinal Brain Twin & Time-Travel Studio/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // Toggle Snapshot Diff Table
    fireEvent.click(
      screen.getByRole('button', { name: /View Snapshot Diff as Table/i }),
    )
    expect(
      screen.getByRole('table', {
        name: /Side-by-side historical snapshot comparison table/i,
      }),
    ).toBeInTheDocument()

    // Scrub to Early Snapshot (#1)
    fireEvent.click(
      screen.getByRole('button', { name: /2 · Scrub to Snap #1 \(Hatched\)/i }),
    )
    expect(
      screen.getAllByText(/Day 1 Cold Baseline/i).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('renders Page 09 AI Coach (/coach) with WhyThisPanel, Deterministic Fallback toggle, Coach Log Table, and Copy Guardrail Inspector', async () => {
    window.history.pushState({}, '', '/coach')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Explainable AI Coach & Cognitive Strategy Studio/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // Toggle Deterministic Rule Fallback
    fireEvent.click(
      screen.getByRole('button', {
        name: /Simulate LLM Down \(Fallback\)/i,
      }),
    )
    expect(
      screen.getAllByText(/deterministic_fallback/i).length,
    ).toBeGreaterThanOrEqual(1)

    // Toggle Guardrail Interception Demo
    fireEvent.click(
      screen.getByRole('button', { name: /Test Guardrail Interception/i }),
    )
    expect(
      screen.getByText(/Intercepted \(3 Rules\)/i),
    ).toBeInTheDocument()

    // Toggle Coach Log Table
    fireEvent.click(
      screen.getByRole('button', { name: /View Coach Log as Table/i }),
    )
    expect(
      screen.getByRole('table', {
        name: /AI Coach recommendations and reasoning log table/i,
      }),
    ).toBeInTheDocument()

    // Reset simulateLlmDown so subsequent tests start clean
    fireEvent.click(
      screen.getByRole('button', {
        name: /Deterministic Fallback: ON/i,
      }),
    )
  })

  it('renders Page 07 Dimension Detail (/dimensions/:dimId) with ProjectionFanChart, Session Trial Log Table, Psychometric Formula, and Biases', async () => {
    window.history.pushState({}, '', '/dimensions/working_memory')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /WM · Working Memory/i,
        level: 1,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // Check Session Trial Log table
    expect(
      screen.getByRole('table', {
        name: /Recent calibration sessions for Working Memory/i,
      }),
    ).toBeInTheDocument()

    // Switch to Hatched (<60% CI) state (jumps to Episodic Pattern Separation)
    fireEvent.click(
      screen.getByRole('button', { name: /2 · ⚡ Hatched \(<60% CI\)/i }),
    )
    expect(
      await screen.findByRole('heading', {
        name: /EP · Episodic Pattern Separation/i,
        level: 1,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Diagonal SVG Hatching Active/i),
    ).toBeInTheDocument()

    // Toggle Raw Telemetry JSON inspector
    fireEvent.click(
      screen.getByRole('button', { name: /View Telemetry JSON/i }),
    )
    expect(
      screen.getByRole('region', {
        name: /Dimension telemetry summary JSON payload/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders Page 10 Plan & Adaptive Exercises (/plan) with 7-day ribbon, prescribed exercise cards, delta-c table, and staircase simulator', async () => {
    window.history.pushState({}, '', '/plan')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Adaptive Training Plan & Staircase Curriculum/i,
        level: 1,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // Verify 7-day ribbon exists
    expect(
      screen.getByRole('group', {
        name: /Weekly training schedule day selector/i,
      }),
    ).toBeInTheDocument()

    // Verify SAT-JEPA Delta-C table exists
    expect(
      screen.getByRole('table', {
        name: /SAT-JEPA delta-c weekly allocation breakdown/i,
      }),
    ).toBeInTheDocument()

    // Switch to Rest-First Pacing preview state
    fireEvent.click(
      screen.getByRole('button', { name: /2 · ☾ Rest-First Pacing/i }),
    )
    expect(
      screen.getByText(/Scheduled Recovery & Memory Consolidation Day/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Streak Protected \(Zero Penalty\)/i),
    ).toBeInTheDocument()

    // Test Staircase Simulator stepper
    fireEvent.click(screen.getByRole('button', { name: 'Lvl 5' }))
    expect(
      screen.getByText(/Level 5 · Peak Attentional Stretch/i),
    ).toBeInTheDocument()
  })

  it('renders Page 12 AI Collaboration Score (/collaboration) with Signature #5 CollaborationScoreCard, dynamic weights, action simulator, and longitudinal curve', async () => {
    window.history.pushState({}, '', '/collaboration')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /AI Collaboration Score Deep-Dive/i,
        level: 1,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // Verify mandatory non-validated badges
    const badges = screen.getAllByText(/Design proposal, not validated/i)
    expect(badges.length).toBeGreaterThanOrEqual(1)

    // Verify Signature #5 heading
    expect(
      screen.getByRole('heading', {
        name: /Signature #5: AI Collaboration Score/i,
        level: 2,
      }),
    ).toBeInTheDocument()

    // Verify baseline score exists
    expect(screen.getByText('82')).toBeInTheDocument()

    // Switch to Dynamic Archetype Weights
    const dynamicWeightsBtn = screen.getByRole('button', {
      name: /Dynamic Archetype Weights/i,
    })
    fireEvent.click(dynamicWeightsBtn)
    expect(dynamicWeightsBtn).toHaveAttribute('aria-pressed', 'true')

    // Test Action Simulator button
    const auditBtn = screen.getByRole('button', {
      name: /Audit "Why This\?" Trail/i,
    })
    fireEvent.click(auditBtn)
    expect(screen.getByText(/Simulated Action Active/i)).toBeInTheDocument()

    // Expand Accessible Score Table
    fireEvent.click(
      screen.getByRole('button', {
        name: /Show Accessible Score Table/i,
      }),
    )
    expect(
      screen.getByRole('table', {
        name: /Collaboration Score Sub-dimension Breakdown/i,
      }),
    ).toBeInTheDocument()

    // Expand Longitudinal Curve Table
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Longitudinal Table Region/i,
      }),
    )
    expect(
      screen.getByRole('table', {
        name: /Longitudinal Collaboration Score History/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders Page 11 Goals & Habit Contracts (/goals) with Zero-Guilt Streak Protection, Bayesian ETA simulator, and contract cards', async () => {
    window.history.pushState({}, '', '/goals')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Goals & Habit Contracts Studio/i,
        level: 1,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // Verify Habit Streak Hero
    expect(screen.getByText(/Continuous Habit Continuity Engine/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Days Protected/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Rest Days Honored/i)).toBeInTheDocument()

    // Verify seeded contract exists
    expect(screen.getByText(/Dual-Stream N-Back Capacity Stretch/i)).toBeInTheDocument()

    // Test Rest Day toggle on contract
    const restBtns = screen.getAllByRole('button', {
      name: /Schedule Rest Day \(Zero Penalty\)/i,
    })
    expect(restBtns.length).toBeGreaterThan(0)
    fireEvent.click(restBtns[0]!)
    expect(screen.getAllByText(/Rest Day Active · Streak Safe/i).length).toBeGreaterThanOrEqual(2)

    // Test Milestone simulation
    const milestoneBtns = screen.getAllByRole('button', {
      name: /Simulate Milestone \(\+15%\)/i,
    })
    expect(milestoneBtns.length).toBeGreaterThan(0)
    fireEvent.click(milestoneBtns[0]!)

    // Expand Accessible Contracts Table Region
    fireEvent.click(
      screen.getByRole('button', {
        name: /Show Contracts Table/i,
      }),
    )
    expect(
      screen.getByRole('table', {
        name: /Habit Contracts and Bayesian ETAs Table/i,
      }),
    ).toBeInTheDocument()

    // Test Goal Creator form submit
    fireEvent.click(
      screen.getByRole('button', {
        name: /Commit to Habit Contract/i,
      }),
    )
    expect(screen.getByText(/Habit contract committed for/i)).toBeInTheDocument()
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

  it('renders Page 18 (/design-system) and supports 3-to-10 dimension switching and radar table toggle', async () => {
    window.history.pushState({}, '', '/design-system')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /SynapseTwin Living Design System/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    const tenBtn = screen.getByRole('button', { name: '10 Dimensions' })
    fireEvent.click(tenBtn)
    expect(
      screen.getByRole('heading', { name: /10 Dimensions Active/i }),
    ).toBeInTheDocument()

    const threeBtn = screen.getByRole('button', { name: '3 Dimensions' })
    fireEvent.click(threeBtn)
    expect(
      screen.getByRole('heading', { name: /3 Dimensions Active/i }),
    ).toBeInTheDocument()

    const tableBtn = screen.getByRole('button', { name: /View as Table/i })
    fireEvent.click(tableBtn)
    expect(
      screen.getByRole('table', {
        name: /Brain Twin Uncertainty Radar accessible data table/i,
      }),
    ).toBeInTheDocument()
  })
  it('renders 404 wayfinder cleanly when navigating to removed /judge-mode route', async () => {
    window.history.pushState({}, '', '/judge-mode')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Synaptic Pathway Not Mapped/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()
  })
  it('renders Page 17 (/system) and supports 404 wayfinder, offline queue simulation, and error boundary self-healing', async () => {
    window.history.pushState({}, '', '/system')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /System States & Fault Resilience Console/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // 1. Verify 404 Wayfinder default view
    expect(
      screen.getByRole('heading', { name: /Synaptic Pathway Not Mapped/i }),
    ).toBeInTheDocument()

    // 2. Switch to Offline Resilience tab
    const offlineTab = screen.getByRole('tab', { name: /Offline Resilience Hub/i })
    fireEvent.click(offlineTab)
    expect(
      screen.getByRole('heading', {
        name: /Offline Telemetry Buffer & Sync Engine/i,
      }),
    ).toBeInTheDocument()

    // Test adding mock telemetry event
    const addEventBtn = screen.getByRole('button', {
      name: /Add Mock Telemetry Event/i,
    })
    fireEvent.click(addEventBtn)
    expect(screen.getByText((content) => content.includes("15 / 500 Events"))).toBeInTheDocument()

    // Test flushing queue
    const flushBtn = screen.getByRole('button', {
      name: /Flush Queue & Sync Now/i,
    })
    fireEvent.click(flushBtn)
    expect(screen.getByText((content) => content.includes("0 / 500 Events"))).toBeInTheDocument()

    // 3. Switch to Error Boundary Test Bench tab
    const errorTab = screen.getByRole('tab', {
      name: /Error Boundary Test Bench/i,
    })
    fireEvent.click(errorTab)
    expect(screen.getByText(/Subtree Mounted Cleanly/i)).toBeInTheDocument()

    // Trigger simulated crash
    const crashBtn = screen.getByRole('button', {
      name: /Trigger Simulated Component Crash/i,
    })
    fireEvent.click(crashBtn)

    // Verify Error Boundary caught the error
    expect(
      screen.getByRole('heading', {
        name: /Component Fault Isolated & Preserved/i,
      }),
    ).toBeInTheDocument()

    // Recover by clicking Try Re-rendering Component
    const recoverBtn = screen.getByRole('button', {
      name: /Try Re-rendering Component/i,
    })
    fireEvent.click(recoverBtn)
    expect(screen.getByText(/Subtree Mounted Cleanly/i)).toBeInTheDocument()

    // 4. Switch to Diagnostic Logs tab
    const logsTab = screen.getByRole('tab', {
      name: /Diagnostic Recovery Log/i,
    })
    fireEvent.click(logsTab)
    expect(
      screen.getByRole('table', {
        name: /System Faults and Diagnostic Recovery Log Table/i,
      }),
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

  it('renders Page 15 Methodology (/methodology) with 4-stage pipeline, formula disclosure, bias simulator, and copy guardrail', async () => {
    window.history.pushState({}, '', '/methodology')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Methodology, Limits & Ethical Charter/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // 1. Verify 4 pipeline stages
    expect(screen.getByRole('tab', { name: /Active Probe Stimuli/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Weighted Staircase IRT/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Bayesian Twin Updating/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /SAT-JEPA Plan Generation/i })).toBeInTheDocument()

    // 2. Click Stage 3: Bayesian Twin Updating
    const stage3Tab = screen.getByRole('tab', { name: /Bayesian Twin Updating/i })
    fireEvent.click(stage3Tab)
    expect(stage3Tab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Stage 3: Bayesian Twin Updating/i)).toBeInTheDocument()

    // 3. Verify Mathematical Model headings
    expect(screen.getByText(/1. Conjugate Gaussian Trait Estimation/i)).toBeInTheDocument()
    expect(screen.getByText(/2. Archetype Classification Hysteresis/i)).toBeInTheDocument()
    expect(screen.getByText(/3. SAT-JEPA Latent Vector Differential/i)).toBeInTheDocument()

    // 4. Test Interactive Bias Simulator
    const slumpRadio = screen.getByRole('radio', { name: /Afternoon Slump/i })
    fireEvent.click(slumpRadio)
    expect(slumpRadio).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/Computed Posterior Credible Band:/i)).toBeInTheDocument()

    // 5. Test Live Copy Guardrail Sandbox
    const clinicalTestBtn = screen.getByRole('button', { name: /Clinical Test/i })
    fireEvent.click(clinicalTestBtn)
    expect(screen.getByText(/Violation\(s\) Flagged/i)).toBeInTheDocument()

    // 6. Verify Measurement Biases Reference Table
    const tableRegion = screen.getByRole('region', { name: /Measurement Biases Matrix/i })
    expect(tableRegion).toHaveAttribute('tabIndex', '0')
    expect(screen.getByRole('cell', { name: /Hardware Latency & Bluetooth Jitter/i })).toBeInTheDocument()
    expect(screen.getByText(/Circadian Rhythm Alertness Dip/i)).toBeInTheDocument()
  })

  it('renders Page 19 Layer D (/layer-d) with multimodal voice studio, what-if scenario simulator, and fatigue risk gauge', async () => {
    window.history.pushState({}, '', '/layer-d')
    render(<App />)

    const heading = await screen.findByRole(
      'heading',
      {
        name: /Layer D: Voice Coaching & Scenario Projections/i,
      },
      { timeout: 5000 },
    )
    expect(heading).toBeInTheDocument()

    // 1. Verify Voice Coaching Studio
    expect(screen.getByText(/Conversational Voice Coaching Studio/i)).toBeInTheDocument()
    const playBtn = screen.getByRole('button', { name: /Play Voice Brief/i })
    fireEvent.click(playBtn)
    expect(screen.getByRole('button', { name: /Pause Voice Brief/i })).toBeInTheDocument()

    // 2. Change speech pace
    const paceBtn = screen.getByRole('radio', { name: /1.25x/i })
    fireEvent.click(paceBtn)
    expect(paceBtn).toHaveAttribute('aria-checked', 'true')

    // 3. Verify Live Transcript
    expect(screen.getByText(/Synchronized Accessible Transcript:/i)).toBeInTheDocument()

    // 4. Test Counterfactual Scenario Tuner
    const acceleratedBtn = screen.getByRole('radio', { name: /Accelerated/i })
    fireEvent.click(acceleratedBtn)
    expect(acceleratedBtn).toHaveAttribute('aria-checked', 'true')

    const sleepBtn = screen.getByRole('radio', { name: /9.0 Hours/i })
    fireEvent.click(sleepBtn)
    expect(sleepBtn).toHaveAttribute('aria-checked', 'true')

    // 5. Verify Fatigue / Burnout Risk Forecast
    expect(screen.getByText(/Cognitive Fatigue & Burnout Risk Forecast/i)).toBeInTheDocument()

    // 6. Test Reset Button
    const resetBtn = screen.getByRole('button', { name: /Reset/i })
    fireEvent.click(resetBtn)
    expect(screen.getByText(/What-If scenario parameters restored to default baseline/i)).toBeInTheDocument()

    // 7. Verify Multidimensional Counterfactual Impact Matrix Table
    const tableRegion = screen.getByRole('region', { name: /Counterfactual Impact Table/i })
    expect(tableRegion).toHaveAttribute('tabIndex', '0')
    expect(screen.getByRole('cell', { name: /Working Memory/i })).toBeInTheDocument()
  })

  it('displays accurate team sprint progress labels across routes (Nearly Done, In Progress, Pending)', async () => {
    // 1. Auth routes -> Nearly Done
    window.history.pushState({}, '', '/auth')
    const { unmount: unmountAuth } = render(<App />)
    const authBadge = await screen.findByTestId('page-progress-badge')
    expect(authBadge).toHaveTextContent(/Nearly Done/i)
    unmountAuth()

    // 2. Welcome route (/) -> In Progress
    window.history.pushState({}, '', '/')
    const { unmount: unmountWelcome } = render(<App />)
    const welcomeBadge = await screen.findByTestId('page-progress-badge')
    expect(welcomeBadge).toHaveTextContent(/In Progress/i)
    unmountWelcome()

    // 3. Dashboard route (/dashboard) -> In Progress
    window.history.pushState({}, '', '/dashboard')
    const { unmount: unmountDashboard } = render(<App />)
    const dashboardBadge = await screen.findByTestId('page-progress-badge')
    expect(dashboardBadge).toHaveTextContent(/In Progress/i)
    unmountDashboard()

    // 4. Other routes (e.g. /settings) -> Pending
    window.history.pushState({}, '', '/settings')
    const { unmount: unmountSettings } = render(<App />)
    const settingsBadge = await screen.findByTestId('page-progress-badge')
    expect(settingsBadge).toHaveTextContent(/Pending/i)
    unmountSettings()
  })
});
