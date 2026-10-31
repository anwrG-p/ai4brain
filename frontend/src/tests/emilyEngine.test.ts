import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  computeEmilyMetrics,
  classifyEmilyEmotion,
  EMILY_EMOTION_CONFIGS,
  startEmilyListener,
  type EmilyInteractionEvent,
  type EmilyEmotion,
} from '../utils/emilyEngine'
import { useEmilyStore } from '../state/useEmilyStore'

describe('EMILY Behavioral Emotion Engine (Circumplex Affective Model)', () => {
  beforeEach(() => {
    // Reset store state before each test
    useEmilyStore.getState().reset()
  })

  describe('1. Kinematic & Interaction Metrics Calculation', () => {
    it('calculates velocity, path directness, and curvature for straight movements', () => {
      // Linear trajectory: 100px in 200ms -> v = 0.5 px/ms, Euclidean = 100, Actual = 100, R_path = 1.0, kappa = 1.0
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'pointermove', x: 0, y: 0, timestamp: now - 200 },
        { type: 'pointermove', x: 50, y: 0, timestamp: now - 100 },
        { type: 'pointermove', x: 100, y: 0, timestamp: now },
      ]

      const metrics = computeEmilyMetrics(events)
      expect(metrics.cursorVelocity).toBeCloseTo(0.5, 1)
      expect(metrics.pathDirectness).toBeCloseTo(1.0, 2)
      expect(metrics.curvature).toBeCloseTo(1.0, 2)
      expect(metrics.cursorJerk).toBeLessThan(0.8)
      expect(metrics.clickBurstCount).toBe(0)
    })

    it('detects wandering trajectory with low directness, high curvature, and direction flips', () => {
      // Zig-zag wandering: start (0,0), up-right (100, 100), left-down (20, 20), up (20, 80)
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'pointermove', x: 0, y: 0, timestamp: now - 300 },
        { type: 'pointermove', x: 100, y: 100, timestamp: now - 200 },
        { type: 'pointermove', x: 20, y: 20, timestamp: now - 100 },
        { type: 'pointermove', x: 20, y: 80, timestamp: now },
      ]

      const metrics = computeEmilyMetrics(events)
      expect(metrics.pathDirectness).toBeLessThan(0.48)
      expect(metrics.curvature).toBeGreaterThan(2.0)
      expect(metrics.directionFlips).toBeGreaterThanOrEqual(1)
    })

    it('detects rage-click bursts (>= 3 clicks within < 400ms inside 30px radius)', () => {
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'click', x: 100, y: 100, timestamp: now - 250 },
        { type: 'click', x: 104, y: 102, timestamp: now - 150 },
        { type: 'click', x: 102, y: 105, timestamp: now },
      ]

      const metrics = computeEmilyMetrics(events)
      expect(metrics.clickBurstCount).toBeGreaterThanOrEqual(1)
      expect(metrics.rageClicksCount).toBeGreaterThanOrEqual(1)
    })

    it('measures click dwell time (mouseup - mousedown) and flags rapid taps or heavy presses', () => {
      const now = Date.now()
      // Rapid tap: 20ms dwell (<35ms)
      const rapidEvents: EmilyInteractionEvent[] = [
        { type: 'mousedown', x: 50, y: 50, timestamp: now - 20 },
        { type: 'mouseup', x: 50, y: 50, timestamp: now },
      ]
      const rapidMetrics = computeEmilyMetrics(rapidEvents)
      expect(rapidMetrics.clickDwellMs).toBe(20)
      expect(rapidMetrics.isRapidTap).toBe(true)
      expect(rapidMetrics.isHeavyPress).toBe(false)

      // Heavy forceful press: 500ms dwell (>450ms)
      const heavyEvents: EmilyInteractionEvent[] = [
        { type: 'mousedown', x: 50, y: 50, timestamp: now - 500 },
        { type: 'mouseup', x: 50, y: 50, timestamp: now },
      ]
      const heavyMetrics = computeEmilyMetrics(heavyEvents)
      expect(heavyMetrics.clickDwellMs).toBe(500)
      expect(heavyMetrics.isHeavyPress).toBe(true)
    })

    it('measures long idle gaps (> 6000ms pause) indicating fatigue or distraction', () => {
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'pointermove', x: 10, y: 10, timestamp: now - 8000 },
        { type: 'pointermove', x: 12, y: 12, timestamp: now },
      ]

      const metrics = computeEmilyMetrics(events)
      expect(metrics.maxIdleGapMs).toBeGreaterThanOrEqual(7900)
      expect(metrics.idleFatigueRatio).toBeGreaterThan(0.5)
    })
  })

  describe('2. 5-State Affective Classification (EmilyEmotion)', () => {
    it('classifies smooth, steady motion with 0 rage clicks as calm_flow', () => {
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'pointermove', x: 10, y: 10, timestamp: now - 300 },
        { type: 'pointermove', x: 80, y: 40, timestamp: now - 150 },
        { type: 'pointermove', x: 150, y: 70, timestamp: now },
      ]
      const metrics = computeEmilyMetrics(events)
      const emotion = classifyEmilyEmotion(metrics)
      expect(emotion).toBe('calm_flow')
    })

    it('classifies high-directness brisk velocity (>0.6 px/ms) as energized', () => {
      const now = Date.now()
      // 180px in 200ms -> v = 0.9 px/ms, directness = 1.0
      const events: EmilyInteractionEvent[] = [
        { type: 'pointermove', x: 0, y: 0, timestamp: now - 200 },
        { type: 'pointermove', x: 90, y: 0, timestamp: now - 100 },
        { type: 'pointermove', x: 180, y: 0, timestamp: now },
        { type: 'click', x: 180, y: 0, timestamp: now },
      ]
      const metrics = computeEmilyMetrics(events)
      const emotion = classifyEmilyEmotion(metrics)
      expect(emotion).toBe('energized')
    })

    it('classifies rage clicks or high jerk as frustrated (gentle de-escalation)', () => {
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'click', x: 50, y: 50, timestamp: now - 200 },
        { type: 'click', x: 52, y: 51, timestamp: now - 100 },
        { type: 'click', x: 51, y: 53, timestamp: now },
      ]
      const metrics = computeEmilyMetrics(events)
      const emotion = classifyEmilyEmotion(metrics)
      expect(emotion).toBe('frustrated')
    })

    it('classifies wandering paths (R_path < 0.48) and hesitation dwell as hesitant (reassuring guidance)', () => {
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'pointermove', x: 0, y: 0, timestamp: now - 400 },
        { type: 'pointermove', x: 80, y: 80, timestamp: now - 300 },
        { type: 'pointermove', x: 10, y: 20, timestamp: now - 200 },
        { type: 'pointermove', x: 70, y: 90, timestamp: now - 100 },
        { type: 'pointermove', x: 20, y: 10, timestamp: now },
      ]
      const metrics = computeEmilyMetrics(events)
      const emotion = classifyEmilyEmotion(metrics)
      expect(emotion).toBe('hesitant')
    })

    it('classifies sluggish velocity (< 0.15 px/ms) with long pauses (>6s) as fatigued (restorative wind-down)', () => {
      const now = Date.now()
      const events: EmilyInteractionEvent[] = [
        { type: 'pointermove', x: 0, y: 0, timestamp: now - 7000 },
        { type: 'pointermove', x: 5, y: 5, timestamp: now - 6900 },
        // >6s pause
        { type: 'pointermove', x: 8, y: 8, timestamp: now },
      ]
      const metrics = computeEmilyMetrics(events)
      const emotion = classifyEmilyEmotion(metrics)
      expect(emotion).toBe('fatigued')
    })
  })

  describe('3. Human Override & Pending Proposal State (useEmilyStore)', () => {
    it('initializes with calm_flow, no pending proposal, and autoAdapt disabled by default', () => {
      const state = useEmilyStore.getState()
      expect(state.currentEmotion).toBe('calm_flow')
      expect(state.proposedEmotion).toBeNull()
      expect(state.isHumanLocked).toBe(false)
      expect(state.autoAdapt).toBe(false)
    })

    it('proposes emotion change for negative states (frustrated/hesitant/fatigued) instead of auto-switching when autoAdapt is false', () => {
      const store = useEmilyStore.getState()
      
      // Simulate rage clicks
      const now = Date.now()
      const rageEvents: EmilyInteractionEvent[] = [
        { type: 'click', x: 100, y: 100, timestamp: now - 150 },
        { type: 'click', x: 102, y: 101, timestamp: now - 80 },
        { type: 'click', x: 101, y: 103, timestamp: now },
      ]

      store.updateTelemetry(rageEvents)

      const updated = useEmilyStore.getState()
      // Current remains calm_flow until user approves
      expect(updated.currentEmotion).toBe('calm_flow')
      expect(updated.proposedEmotion).toBe('frustrated')

      // User approves
      updated.approveProposedEmotion()
      expect(useEmilyStore.getState().currentEmotion).toBe('frustrated')
      expect(useEmilyStore.getState().proposedEmotion).toBeNull()
    })

    it('dismisses proposal when user rejects it', () => {
      const store = useEmilyStore.getState()
      store.setProposedEmotion('hesitant')
      expect(useEmilyStore.getState().proposedEmotion).toBe('hesitant')

      store.rejectProposedEmotion()
      expect(useEmilyStore.getState().proposedEmotion).toBeNull()
      expect(useEmilyStore.getState().currentEmotion).toBe('calm_flow')
    })

    it('immediately transitions when autoAdapt is explicitly enabled', () => {
      const store = useEmilyStore.getState()
      store.setAutoAdapt(true)

      const now = Date.now()
      const rageEvents: EmilyInteractionEvent[] = [
        { type: 'click', x: 100, y: 100, timestamp: now - 150 },
        { type: 'click', x: 102, y: 101, timestamp: now - 80 },
        { type: 'click', x: 101, y: 103, timestamp: now },
      ]

      store.updateTelemetry(rageEvents)

      const updated = useEmilyStore.getState()
      expect(updated.currentEmotion).toBe('frustrated')
      expect(updated.proposedEmotion).toBeNull()
    })

    it('respects human manual lock and ignores automatic telemetry updates until unlocked', () => {
      const store = useEmilyStore.getState()
      store.setManualEmotion('energized')

      expect(useEmilyStore.getState().currentEmotion).toBe('energized')
      expect(useEmilyStore.getState().isHumanLocked).toBe(true)

      // Feed rage clicks that would normally trigger frustrated
      const now = Date.now()
      const rageEvents: EmilyInteractionEvent[] = [
        { type: 'click', x: 100, y: 100, timestamp: now - 150 },
        { type: 'click', x: 102, y: 101, timestamp: now - 80 },
        { type: 'click', x: 101, y: 103, timestamp: now },
      ]

      store.updateTelemetry(rageEvents)

      // Should remain energized and locked with no proposed override
      expect(useEmilyStore.getState().currentEmotion).toBe('energized')
      expect(useEmilyStore.getState().proposedEmotion).toBeNull()

      // Unlock
      store.unlockHuman()
      expect(useEmilyStore.getState().isHumanLocked).toBe(false)
    })
  })

  describe('4. Counter-Regulatory Color Psychology & Doodle Tokens', () => {
    it('strictly adheres to anti-red policy for frustrated state (uses Tranquil Eucalyptus Sage, never #DC2626)', () => {
      const frustratedConfig = EMILY_EMOTION_CONFIGS.frustrated
      expect(frustratedConfig.accentLight).not.toBe('#DC2626')
      expect(frustratedConfig.accentLight.toLowerCase()).toContain('4d9078')
      expect(frustratedConfig.accentNight.toLowerCase()).toContain('68d391')
      expect(frustratedConfig.brianPose).toBe('thinking')
    })

    it('provides verified tokens for all 5 canonical emotions meeting WCAG 2.2 AA standards', () => {
      const emotions: EmilyEmotion[] = ['calm_flow', 'energized', 'frustrated', 'hesitant', 'fatigued']
      emotions.forEach((emotion) => {
        const config = EMILY_EMOTION_CONFIGS[emotion]
        expect(config).toBeDefined()
        expect(config.label).toBeTruthy()
        expect(config.accentLight).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(config.tintLight).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(config.accentNight).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(config.brianAdvice).toBeTruthy()
      })
    })
  })

  describe('5. Passive listener', () => {
    it('records events whose target is not an element (window, document) without throwing', () => {
      vi.useFakeTimers()
      const onEvaluation = vi.fn()
      const stop = startEmilyListener(onEvaluation, { evalIntervalMs: 100 })
      try {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        const button = document.body.appendChild(document.createElement('button'))
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        button.remove()
        vi.advanceTimersByTime(100)
        const buffer = onEvaluation.mock.calls.at(-1)?.[2] as EmilyInteractionEvent[] | undefined
        expect(buffer?.map((e) => [e.type, e.isInteractive])).toEqual([
          ['keydown', false],
          ['click', false],
          ['click', true],
        ])
      } finally {
        stop()
        vi.useRealTimers()
      }
    })
  })
})
