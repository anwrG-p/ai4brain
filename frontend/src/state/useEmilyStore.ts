import { create } from 'zustand'
import {
  computeEmilyMetrics,
  classifyEmilyEmotion,
  INITIAL_EMILY_METRICS,
  type EmilyEmotion,
  type EmilyMetrics,
  type EmilyInteractionEvent,
} from '../utils/emilyEngine'

export interface EmilyHistoryEntry {
  timestamp: number
  emotion: EmilyEmotion
  metrics: EmilyMetrics
}

export interface EmilyStoreState {
  currentEmotion: EmilyEmotion
  proposedEmotion: EmilyEmotion | null
  isHumanLocked: boolean
  autoAdapt: boolean
  metrics: EmilyMetrics
  history: EmilyHistoryEntry[]

  // Core Actions
  /** Pointer and key events only. Answer errors are never an input: the difficulty staircase causes
      them on purpose, so they must not read as strain (ADR 0002). */
  updateTelemetry: (events: readonly EmilyInteractionEvent[]) => void
  setManualEmotion: (emotion: EmilyEmotion) => void
  unlockHuman: () => void
  approveProposedEmotion: () => void
  rejectProposedEmotion: () => void
  setProposedEmotion: (emotion: EmilyEmotion | null) => void
  setAutoAdapt: (enabled: boolean) => void
  toggleAutoAdapt: () => void
  reset: () => void
}

export const useEmilyStore = create<EmilyStoreState>((set, get) => ({
  currentEmotion: 'calm_flow',
  proposedEmotion: null,
  isHumanLocked: false,
  autoAdapt: false,
  metrics: INITIAL_EMILY_METRICS,
  history: [],

  updateTelemetry: (events) => {
    const { isHumanLocked, autoAdapt, currentEmotion } = get()
    const metrics = computeEmilyMetrics(events)
    const classifiedEmotion = classifyEmilyEmotion(metrics)

    // If human locked, only track metrics, never auto-transition
    if (isHumanLocked) {
      set({ metrics })
      return
    }

    // Same emotion: clear any stale proposal
    if (classifiedEmotion === currentEmotion) {
      set({ metrics, proposedEmotion: null })
      return
    }

    // Negative / strained state: requires user approval unless autoAdapt is on
    const isStrainedState =
      classifiedEmotion === 'frustrated' ||
      classifiedEmotion === 'hesitant' ||
      classifiedEmotion === 'fatigued'

    // Rage clicks only. Wrong answers are not strain: the staircase causes them on purpose.
    const hasActiveTaskStrain = metrics.clickBurstCount >= 1

    if (isStrainedState && !autoAdapt) {
      // Only propose unprompted emotion changes on rage clicks, never from passive reading pauses
      // or from errors.
      if (hasActiveTaskStrain) {
        set((state) => ({
          metrics,
          proposedEmotion: classifiedEmotion,
          history: [
            ...state.history.slice(-49),
            { timestamp: Date.now(), emotion: state.currentEmotion, metrics },
          ],
        }))
        return
      }
      set({ metrics })
      return
    }

    // Direct transition (either autoAdapt is on, or transitioning to positive state)
    set((state) => ({
      metrics,
      currentEmotion: classifiedEmotion,
      proposedEmotion: null,
      history: [
        ...state.history.slice(-49),
        { timestamp: Date.now(), emotion: classifiedEmotion, metrics },
      ],
    }))
  },

  setManualEmotion: (emotion) => {
    set((state) => ({
      currentEmotion: emotion,
      proposedEmotion: null,
      isHumanLocked: true,
      history: [
        ...state.history.slice(-49),
        { timestamp: Date.now(), emotion, metrics: state.metrics },
      ],
    }))
  },

  unlockHuman: () => {
    set({ isHumanLocked: false })
  },

  approveProposedEmotion: () => {
    const { proposedEmotion, metrics } = get()
    if (!proposedEmotion) return
    set((state) => ({
      currentEmotion: proposedEmotion,
      proposedEmotion: null,
      history: [
        ...state.history.slice(-49),
        { timestamp: Date.now(), emotion: proposedEmotion, metrics },
      ],
    }))
  },

  rejectProposedEmotion: () => {
    set({ proposedEmotion: null })
  },

  setProposedEmotion: (emotion) => {
    set({ proposedEmotion: emotion })
  },

  setAutoAdapt: (enabled) => {
    set({ autoAdapt: enabled })
  },

  toggleAutoAdapt: () => {
    set((state) => ({ autoAdapt: !state.autoAdapt }))
  },

  reset: () => {
    set({
      currentEmotion: 'calm_flow',
      proposedEmotion: null,
      isHumanLocked: false,
      autoAdapt: false,
      metrics: INITIAL_EMILY_METRICS,
      history: [],
    })
  },
}))

