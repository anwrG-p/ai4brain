import { create } from 'zustand'
import type { DimensionPresetKey } from '../config/dimensions'

export type ThemeMode = 'light' | 'dark'
export type TextScale = '100' | '115' | '130'
export type PersonaId =
  | 'new-user'
  | 'steady-improver'
  | 'noisy-low-confidence'
  | 'edge-missing-dim'
  | 'edge-10-dimensions'
  | 'edge-llm-offline'

export type FocusGoalId =
  | 'deep-focus-wm'
  | 'fast-set-shifting'
  | 'balanced-360-twin'

export type PeakWindowId = 'morning' | 'afternoon' | 'evening'
export type BaselineModeId = 'quick-2min' | 'standard-5min'

export interface ConsentPreferences {
  focusGoal: FocusGoalId
  peakWindow: PeakWindowId
  coreTelemetry: true
  nonBiometricMode: true
  historicalSnapshots: boolean
  coachAndCollab: boolean
  researchExport: boolean
  nonClinicalAck: boolean
  baselineMode: BaselineModeId
  inputLatencyMs: number | null
  consentReceiptId: string
  updatedAtIso: string
}

export interface UserProfile {
  preferredName: string
  email: string
  focusGoal: string
  rememberOnDevice?: boolean
}

export const DEFAULT_CONSENT_PREFERENCES: ConsentPreferences = {
  focusGoal: 'balanced-360-twin',
  peakWindow: 'morning',
  coreTelemetry: true,
  nonBiometricMode: true,
  historicalSnapshots: true,
  coachAndCollab: true,
  researchExport: false,
  nonClinicalAck: true,
  baselineMode: 'quick-2min',
  inputLatencyMs: 138,
  consentReceiptId: 'CONSENT-ST-2026-8F4A',
  updatedAtIso: '2026-10-24T17:00:00Z',
}

interface AppState {
  theme: ThemeMode
  reducedMotion: boolean
  dimensionPreset: DimensionPresetKey
  showMascot: boolean
  activePersona: PersonaId
  simulateOffline: boolean
  simulateLlmDown: boolean
  consentPreferences: ConsentPreferences
  userProfile: UserProfile | null
  isAuthenticated: boolean
  loginUser: (profile: UserProfile) => void
  logoutUser: () => void
  textScale: TextScale
  enhancedGlyphs: boolean
  soundEffects: boolean
  blurAutoPause: boolean
  studyWindow: string
  restDays: string[]
  setTextScale: (scale: TextScale) => void
  setEnhancedGlyphs: (enhanced: boolean) => void
  setSoundEffects: (sound: boolean) => void
  setBlurAutoPause: (blur: boolean) => void
  setStudyWindow: (window: string) => void
  setRestDays: (days: string[]) => void
  toggleRestDay: (day: string) => void
  resetSettingsToDefault: () => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setReducedMotion: (reduced: boolean) => void
  setDimensionPreset: (preset: DimensionPresetKey) => void
  setShowMascot: (show: boolean) => void
  setActivePersona: (persona: PersonaId) => void
  setSimulateOffline: (offline: boolean) => void
  setSimulateLlmDown: (llmDown: boolean) => void
  updateConsentPreferences: (patch: Partial<ConsentPreferences>) => void
  applyFastTrackConsent: () => void
  resetConsentPreferences: () => void
  resetDemoState: () => void
}

function syncDocumentAttributes(theme: ThemeMode, reducedMotion: boolean, textScale: TextScale = '100') {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute(
      'data-reduced-motion',
      reducedMotion ? 'true' : 'false',
    )
    document.documentElement.setAttribute('data-text-scale', textScale)
  }
}

/** The theme survives a reload; nothing else in this store is stored. */
export const THEME_KEY = 'synapsetwin_theme_v1'

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light' // storage blocked
  }
}

function saveTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage full or blocked: the theme holds for this visit.
  }
}

const initialTheme = loadTheme()
syncDocumentAttributes(initialTheme, false)

export const useAppStore = create<AppState>((set) => ({
  theme: initialTheme,
  reducedMotion: false,
  dimensionPreset: '7',
  showMascot: true,
  activePersona: 'steady-improver',
  simulateOffline: false,
  simulateLlmDown: false,
  consentPreferences: DEFAULT_CONSENT_PREFERENCES,
  userProfile: null,
  isAuthenticated: false,
  loginUser: (profile: UserProfile) => set({ userProfile: profile, isAuthenticated: true }),
  logoutUser: () => set({ userProfile: null, isAuthenticated: false }),
  textScale: '100',
  enhancedGlyphs: true,
  soundEffects: true,
  blurAutoPause: true,
  studyWindow: 'morning',
  restDays: ['Wednesday', 'Sunday'],
  setTextScale: (textScale) =>
    set((state) => {
      syncDocumentAttributes(state.theme, state.reducedMotion, textScale)
      return { textScale }
    }),
  setEnhancedGlyphs: (enhancedGlyphs) => set({ enhancedGlyphs }),
  setSoundEffects: (soundEffects) => set({ soundEffects }),
  setBlurAutoPause: (blurAutoPause) => set({ blurAutoPause }),
  setStudyWindow: (studyWindow) => set({ studyWindow }),
  setRestDays: (restDays) => set({ restDays }),
  toggleRestDay: (day) =>
    set((state) => ({
      restDays: state.restDays.includes(day)
        ? state.restDays.filter((d) => d !== day)
        : [...state.restDays, day],
    })),
  resetSettingsToDefault: () =>
    set(() => {
      syncDocumentAttributes('light', false, '100')
      return {
        theme: 'light',
        reducedMotion: false,
        dimensionPreset: '7',
        textScale: '100',
        enhancedGlyphs: true,
        soundEffects: true,
        blurAutoPause: true,
        studyWindow: 'morning',
        restDays: ['Wednesday', 'Sunday'],
      }
    }),
  setTheme: (theme) =>
    set((state) => {
      syncDocumentAttributes(theme, state.reducedMotion, state.textScale)
      return { theme }
    }),
  toggleTheme: () =>
    set((state) => {
      const next: ThemeMode = state.theme === 'light' ? 'dark' : 'light'
      syncDocumentAttributes(next, state.reducedMotion, state.textScale)
      return { theme: next }
    }),
  setReducedMotion: (reducedMotion) =>
    set((state) => {
      syncDocumentAttributes(state.theme, reducedMotion, state.textScale)
      return { reducedMotion }
    }),
  setDimensionPreset: (dimensionPreset) => set({ dimensionPreset }),
  setShowMascot: (showMascot) => set({ showMascot }),
  setActivePersona: (activePersona) => set({ activePersona }),
  setSimulateOffline: (simulateOffline) => set({ simulateOffline }),
  setSimulateLlmDown: (simulateLlmDown) => set({ simulateLlmDown }),
  updateConsentPreferences: (patch) =>
    set((state) => ({
      consentPreferences: {
        ...state.consentPreferences,
        ...patch,
        coreTelemetry: true,
        nonBiometricMode: true,
      },
    })),
  applyFastTrackConsent: () =>
    set({
      consentPreferences: {
        ...DEFAULT_CONSENT_PREFERENCES,
        nonClinicalAck: true,
        inputLatencyMs: 138,
        consentReceiptId: 'CONSENT-ST-2026-FAST',
      },
    }),
  resetConsentPreferences: () =>
    set({
      consentPreferences: {
        ...DEFAULT_CONSENT_PREFERENCES,
        historicalSnapshots: false,
        coachAndCollab: false,
        researchExport: false,
        nonClinicalAck: false,
        inputLatencyMs: null,
        consentReceiptId: 'CONSENT-ST-2026-MINIMAL',
      },
    }),
  resetDemoState: () =>
    set(() => {
      syncDocumentAttributes('light', false, '100')
      return {
        theme: 'light',
        reducedMotion: false,
        dimensionPreset: '7',
        showMascot: true,
        activePersona: 'steady-improver',
        simulateOffline: false,
        simulateLlmDown: false,
        consentPreferences: DEFAULT_CONSENT_PREFERENCES,
        userProfile: null,
        isAuthenticated: false,
        textScale: '100',
        enhancedGlyphs: true,
        soundEffects: true,
        blurAutoPause: true,
        studyWindow: 'morning',
        restDays: ['Wednesday', 'Sunday'],
      }
    }),
}))

useAppStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) saveTheme(state.theme)
})

if (typeof window !== 'undefined') {
  ;(window as any).__appStore = useAppStore
  ;(window as any).__setDimensionPreset = (preset: DimensionPresetKey) => {
    useAppStore.getState().setDimensionPreset(preset)
  }
}

