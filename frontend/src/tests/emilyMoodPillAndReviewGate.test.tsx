import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { EmilyMoodPill } from '../components/common/EmilyMoodPill'
import { HumanReviewGate } from '../components/dev/HumanReviewGate'
import { useEmilyStore } from '../state/useEmilyStore'
import { EMILY_EMOTION_CONFIGS } from '../styles/emilyTokens'

describe('EMILY Mood Pill & Designer / Evaluator UX Review Gate Suite', () => {
  beforeEach(() => {
    useEmilyStore.getState().reset()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('Part 1: EmilyMoodPill Component', () => {
    it('renders default Calm Flow mood pill with color dot and accessible semantics', () => {
      render(<EmilyMoodPill />)

      const pillBtn = screen.getByRole('button', {
        name: /EMILY Atmosphere: Calm Flow/i,
      })
      expect(pillBtn).toBeInTheDocument()
      expect(screen.getByText('Calm Flow')).toBeInTheDocument()
      expect(screen.getByText('🌿')).toBeInTheDocument()
      expect(document.documentElement.getAttribute('data-emotion')).toBe('calm_flow')
    })

    it('opens popover dialog on pill click displaying kinematics summary and emotion options', () => {
      render(<EmilyMoodPill />)

      const pillBtn = screen.getByRole('button', {
        name: /EMILY Atmosphere: Calm Flow/i,
      })
      fireEvent.click(pillBtn)

      // Popover should now be visible
      expect(screen.getByRole('dialog', { name: /EMILY Emotion Atmosphere/i })).toBeInTheDocument()
      expect(screen.getByText(/Live Pointer Dynamics/i)).toBeInTheDocument()
      expect(screen.getByText(/Pointer Rhythm: Smooth arcs/i)).toBeInTheDocument()

      // Should render all 5 emotion buttons
      expect(screen.getByText('Curious Spark')).toBeInTheDocument()
      expect(screen.getByText('Gentle De-Escalation')).toBeInTheDocument()
      expect(screen.getByText('Reassuring Guidance')).toBeInTheDocument()
      expect(screen.getByText('Restorative Wind-Down')).toBeInTheDocument()
    })

    it('allows manually selecting an emotion and activates human lock', () => {
      render(<EmilyMoodPill />)

      const pillBtn = screen.getByRole('button', {
        name: /EMILY Atmosphere: Calm Flow/i,
      })
      fireEvent.click(pillBtn)

      // Click on Curious Spark (energized)
      const sparkBtn = screen.getByText('Curious Spark')
      fireEvent.click(sparkBtn)

      expect(useEmilyStore.getState().currentEmotion).toBe('energized')
      expect(useEmilyStore.getState().isHumanLocked).toBe(true)
      expect(document.documentElement.getAttribute('data-emotion')).toBe('energized')
    })

    it('shows non-intrusive BRIAN approval bubble when proposedEmotion is set', () => {
      render(<EmilyMoodPill />)

      // Simulate store receiving a proposed frustrated state wrapped in act
      act(() => {
        useEmilyStore.setState({ proposedEmotion: 'frustrated' })
      })

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/BRIAN Companion Check-In/i)).toBeInTheDocument()
      expect(screen.getByText(/Notice rapid bursts and elevated cursor tension/i)).toBeInTheDocument()

      const applyBtn = screen.getByRole('button', { name: /Apply Calm Mode/i })
      const keepBtn = screen.getByRole('button', { name: /Keep Current/i })
      expect(applyBtn).toBeInTheDocument()
      expect(keepBtn).toBeInTheDocument()

      // Clicking apply mode adopts the proposed state
      fireEvent.click(applyBtn)
      expect(useEmilyStore.getState().currentEmotion).toBe('frustrated')
      expect(useEmilyStore.getState().proposedEmotion).toBeNull()
    })

    it('clears proposedEmotion when user clicks Keep Current', () => {
      render(<EmilyMoodPill />)

      act(() => {
        useEmilyStore.setState({ proposedEmotion: 'hesitant' })
      })
      expect(screen.getByText(/Notice wandering arcs and searching pauses/i)).toBeInTheDocument()

      const keepBtn = screen.getByRole('button', { name: /Keep Current/i })
      fireEvent.click(keepBtn)

      expect(useEmilyStore.getState().proposedEmotion).toBeNull()
      expect(useEmilyStore.getState().currentEmotion).toBe('calm_flow')
    })
  })

  describe('Part 2: HumanReviewGate Evaluator Controls', () => {
    it('renders discreet closed trigger button by default and opens upon click', () => {
      render(<HumanReviewGate />)

      const triggerBtn = screen.getByRole('button', {
        name: /Open Evaluator Human UX Review Gate/i,
      })
      expect(triggerBtn).toBeInTheDocument()

      fireEvent.click(triggerBtn)

      expect(screen.getByTestId('ux-review-gate')).toBeInTheDocument()
      expect(screen.getByText(/UX Review & Evaluator Controls/i)).toBeInTheDocument()
    })

    it('opens automatically when defaultOpen is true or when Shift+J is pressed', () => {
      render(<HumanReviewGate />)

      // Trigger Shift + J
      fireEvent.keyDown(window, { key: 'J', shiftKey: true })

      expect(screen.getByTestId('ux-review-gate')).toBeInTheDocument()
    })

    it('Live DOM Jargon Scanner verifies text and reports 0 Jargon Violations', () => {
      render(
        <div>
          <main id="main-content">
            <p>Welcome to your personal space. Your Thinking Style is well-balanced.</p>
          </main>
          <HumanReviewGate defaultOpen={true} />
        </div>,
      )

      const badge = screen.getByTestId('jargon-scanner-badge')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent(/0 Jargon Violations \(GLOSSARY\.md Verified\)/i)
    })

    it('EMILY State Simulator triggers emotion shifts via direct buttons', () => {
      render(<HumanReviewGate defaultOpen={true} />)

      // Click simulate-energized
      const sparkBtn = screen.getByTestId('simulate-energized')
      fireEvent.click(sparkBtn)
      expect(useEmilyStore.getState().currentEmotion).toBe('energized')

      // Click simulate-frustrated
      const frustrateBtn = screen.getByTestId('simulate-frustrated')
      fireEvent.click(frustrateBtn)
      expect(useEmilyStore.getState().currentEmotion).toBe('frustrated')

      // Click simulate-calm
      const calmBtn = screen.getByTestId('simulate-calm')
      fireEvent.click(calmBtn)
      expect(useEmilyStore.getState().currentEmotion).toBe('calm_flow')
    })

    it('EMILY Kinematic Stress Scenarios trigger kinematic metrics updates', () => {
      render(<HumanReviewGate defaultOpen={true} />)

      // Click simulate rage clicks
      const rageBtn = screen.getByTestId('simulate-rage-clicks')
      fireEvent.click(rageBtn)
      expect(useEmilyStore.getState().metrics.clickBurstCount).toBeGreaterThanOrEqual(1)

      // Click simulate wandering
      const wanderBtn = screen.getByTestId('simulate-wandering')
      fireEvent.click(wanderBtn)
      expect(useEmilyStore.getState().metrics.pathDirectness).toBeLessThan(0.48)

      // Click simulate idle fatigue
      const idleBtn = screen.getByTestId('simulate-idle-fatigue')
      fireEvent.click(idleBtn)
      expect(useEmilyStore.getState().metrics.cursorVelocity).toBeLessThan(0.15)
    })

    it('signs off screen UX and stores audit entry in localStorage', () => {
      render(<HumanReviewGate defaultOpen={true} />)

      const noteInput = screen.getByTestId('evaluator-notes-input')
      fireEvent.change(noteInput, {
        target: { value: 'Verified all 6 skills adhere to Doodle styling' },
      })

      const approveBtn = screen.getByTestId('approve-screen-ux')
      fireEvent.click(approveBtn)

      expect(screen.getByTestId('approval-status-message')).toBeInTheDocument()

      const rawSaved = localStorage.getItem('cistac_ux_review_signoffs')
      expect(rawSaved).toBeTruthy()
      const parsed = JSON.parse(rawSaved!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].status).toBe('APPROVED')
      expect(parsed[0].evaluatorNotes).toBe('Verified all 6 skills adhere to Doodle styling')
    })

    it('supports 1-click JSON audit export', () => {
      render(<HumanReviewGate defaultOpen={true} />)

      // Pre-seed a signoff
      const preseeded = [
        {
          id: 'test-1',
          screenPath: '/dashboard',
          timestamp: new Date().toISOString(),
          status: 'APPROVED',
        },
      ]
      localStorage.setItem('cistac_ux_review_signoffs', JSON.stringify(preseeded))

      // Mock URL.createObjectURL, URL.revokeObjectURL, and HTMLAnchorElement click
      const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      const revokeObjectURL = vi.fn()
      window.URL.createObjectURL = createObjectURL
      window.URL.revokeObjectURL = revokeObjectURL
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const exportBtn = screen.getByTestId('export-review-json')
      fireEvent.click(exportBtn)

      expect(createObjectURL).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURL).toHaveBeenCalled()
      clickSpy.mockRestore()
    })
  })

  describe('Part 3: Token Anti-Red Policy Enforcement', () => {
    it('guarantees frustrated emotion never uses alert red (#DC2626)', () => {
      const frustratedConfig = EMILY_EMOTION_CONFIGS.frustrated
      expect(frustratedConfig.accentLight).not.toBe('#DC2626')
      expect(frustratedConfig.accentNight).not.toBe('#DC2626')
      // Uses Tranquil Eucalyptus Sage
      expect(frustratedConfig.accentLight).toBe('#4D9078')
      expect(frustratedConfig.accentNight).toBe('#68D391')
    })
  })
})
