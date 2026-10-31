import { useAppStore } from '../../state/useAppStore'
import { CONSENT_KEY, QUEUE_KEY, tracker } from '../assessment/telemetry/tracker'
import { forgetUserId, UID_KEY } from '../assessment/tasks/taskSource'
import { GOALS_KEY, useGoalsStore } from '../insights/goals'
import { SESSIONS_KEY, useSessionStore } from '../insights/sessionStore'

/* Everything this device holds about the user, for "Export my data" and "Delete my data":
   sessions, goals, the consent choice ('granted' | 'denied'; absent means not chosen yet), the
   answers waiting to be sent, the anonymous id, and Loti's talk.
   Excluded: the judge tool's sign-offs (cistac_ux_review_signoffs, HumanReviewGate), which hold
   reviewers' notes about the UI, not anything about the user. */
// ponytail: the Loti talk store (09c) lives on another branch; after the merge use
// useLotiSession.getState().clear() for delete and its state for export instead of the raw key.
export const LOTI_KEY = 'synapsetwin_loti_v1' // sessionStorage

export const LOCAL_KEYS = [SESSIONS_KEY, GOALS_KEY, CONSENT_KEY, QUEUE_KEY, UID_KEY] as const

// Storage can be blocked (reading it throws); a value that isn't JSON is kept as its raw string.
function read(storage: () => Storage, key: string): unknown {
  try {
    const raw = storage().getItem(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  } catch {
    return null
  }
}

/* The app store fields that are the user's: listed, not copied wholesale. The rest is demo or judge
   state (persona, offline simulation, dimension preset) or the legacy consentPreferences, whose
   hard-coded defaults (a fixed receipt id, telemetry "on") would contradict the real consent choice. */
export const APP_FIELDS = ['userProfile', 'isAuthenticated', 'theme', 'reducedMotion'] as const
type AppState = ReturnType<typeof useAppStore.getState>
const pick = (s: AppState) => ({
  userProfile: s.userProfile,
  isAuthenticated: s.isAuthenticated,
  theme: s.theme,
  reducedMotion: s.reducedMotion,
})

export interface MyData {
  exportedAt: string
  consent: string
  localStorage: Record<string, unknown>
  sessionStorage: Record<string, unknown>
  /** The profile and the two real settings. */
  app: Pick<AppState, (typeof APP_FIELDS)[number]>
}

export function collectMyData(now = new Date()): MyData {
  return {
    exportedAt: now.toISOString(),
    consent: tracker.getStatus().consent,
    localStorage: Object.fromEntries(LOCAL_KEYS.map((k) => [k, read(() => localStorage, k)])),
    sessionStorage: { [LOTI_KEY]: read(() => sessionStorage, LOTI_KEY) },
    app: pick(useAppStore.getState()),
  }
}

/** Downloads collectMyData() as one JSON file. */
export function downloadMyData(now = new Date()): void {
  const blob = new Blob([JSON.stringify(collectMyData(now), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `my-data-${now.toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Edge and Chrome start the download asynchronously; revoking at once can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* The privacy purge, on this device only (server-side deletion is Member 4's route): the queued
   answers, the consent choice (back to not chosen, so nothing is sent until the user chooses
   again), the anonymous id, sessions, goals, Loti's talk, and the profile (sign-out). The theme
   and reduce motion are preferences, not data, so they survive. */
export function deleteMyData(): void {
  const { theme, reducedMotion, resetDemoState, setTheme, setReducedMotion } = useAppStore.getState()
  resetDemoState()
  setTheme(theme)
  setReducedMotion(reducedMotion)
  tracker.clear()
  tracker.resetConsent()
  forgetUserId()
  useSessionStore.getState().clearSessions()
  useGoalsStore.getState().clearGoals()
  try {
    sessionStorage.removeItem(LOTI_KEY)
  } catch {
    // Storage blocked: nothing stored to clear.
  }
}
