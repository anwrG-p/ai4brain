import { useAppStore } from '../../state/useAppStore'
import { CONSENT_KEY, QUEUE_KEY, tracker } from '../assessment/telemetry/tracker'
import { forgetUserId, UID_KEY } from '../assessment/tasks/taskSource'
import { GOALS_KEY, useGoalsStore } from '../insights/goals'
import { SESSIONS_KEY, useSessionStore } from '../insights/sessionStore'
import { useLotiSession, type LotiTalk } from '../loti/lotiSession'

/* Everything this device holds about the user, for "Export my data" and "Delete my data":
   sessions, goals, the consent choice ('granted' | 'denied'; absent means not chosen yet), the
   answers waiting to be sent, the anonymous id, and Loti's talk.
   Excluded: the judge tool's sign-offs (cistac_ux_review_signoffs, HumanReviewGate), which hold
   reviewers' notes about the UI, not anything about the user. */
export const LOCAL_KEYS = [SESSIONS_KEY, GOALS_KEY, CONSENT_KEY, QUEUE_KEY, UID_KEY] as const

// Storage can be blocked (reading it throws); a value that isn't JSON is kept as its raw string.
function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
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
  /** Loti's talk for this tab, from its store (what is on screen, even if storage is blocked). */
  lotiTalk: LotiTalk
  /** The profile and the two real settings. */
  app: Pick<AppState, (typeof APP_FIELDS)[number]>
}

export function collectMyData(now = new Date()): MyData {
  return {
    exportedAt: now.toISOString(),
    consent: tracker.getStatus().consent,
    localStorage: Object.fromEntries(LOCAL_KEYS.map((k) => [k, read(k)])),
    lotiTalk: (({ turns, current }) => ({ turns, current }))(useLotiSession.getState()),
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
  // The store, not just its key: a mounted Loti bubble would otherwise save the old turns back.
  useLotiSession.getState().clear()
}
