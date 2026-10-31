import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { HumanReviewGate } from '../components/dev/HumanReviewGate'
import { useEmilyStore } from '../state/useEmilyStore'
import { EMILY_EMOTION_CONFIGS } from '../styles/emilyTokens'

describe('Designer / Evaluator UX Review Gate Suite', () => {
  beforeEach(() => {
    useEmilyStore.getState().reset()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('Part 2: HumanReviewGate Evaluator Controls', () => {
    it('renders discreet closed trigger button by default and opens upon click', () => {
      render(<HumanReviewGate />)

      const triggerBtn = screen.getByRole('button', {
        name: /UX Review & Evaluator Controls/i,
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
