import { PREFS_KEY, useDevicePrefs } from '../../state/devicePrefs'
import { useAppStore } from '../../state/useAppStore'
import { useEmilyStore } from '../../state/useEmilyStore'
import { COACH_CONSENT_KEY, CONSENT_KEY, QUEUE_KEY, tracker } from '../assessment/telemetry/tracker'
import { forgetUserId, UID_KEY } from '../assessment/tasks/taskSource'
import { GOALS_KEY, useGoalsStore } from '../insights/goals'
import { SESSIONS_KEY, useSessionStore } from '../insights/sessionStore'
import { useLotiSession, type LotiTalk } from '../loti/lotiSession'

/* Everything this device holds about the user, for "Export my data" and "Delete my data":
   sessions, goals, the two consent choices (saving answers, AI replies from Loti; each 'granted' |
   'denied', absent means not chosen yet), the answers waiting to be sent, the anonymous id, the
   device prefs (mood guess on/off, opt-in; the mood notice seen; colour-blind friendly inks) and
   Loti's talk.
   Momo's mood itself is never stored, so there is none to export.
   Excluded: the judge tool's sign-offs (cistac_ux_review_signoffs, HumanReviewGate), which hold
   reviewers' notes about the UI, not anything about the user. */
export const LOCAL_KEYS = [SESSIONS_KEY, GOALS_KEY, CONSENT_KEY, COACH_CONSENT_KEY, QUEUE_KEY, UID_KEY, PREFS_KEY] as const

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
type AppFields = Pick<AppState, (typeof APP_FIELDS)[number]>
const pick = (s: AppState) => Object.fromEntries(APP_FIELDS.map((k) => [k, s[k]])) as AppFields

export interface MyData {
  exportedAt: string
  /** Purpose 1: saving answers (telemetry). */
  consent: string
  /** Purpose 2: AI replies from Loti. */
  coachConsent: string
  localStorage: Record<string, unknown>
  /** Loti's talk for this tab, from its store (what is on screen, even if storage is blocked). */
  lotiTalk: LotiTalk
  /** The profile and the two real settings. */
  app: AppFields
}

export function collectMyData(now = new Date()): MyData {
  return {
    exportedAt: now.toISOString(),
    consent: tracker.getStatus().consent,
    coachConsent: tracker.getStatus().coachConsent,
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
   answers, both consent choices (back to not chosen, so nothing is sent until the user chooses
   again), the anonymous id, sessions, goals, Loti's talk, the mood prefs (guess off, notice
   unseen) with any mood correction, and the profile
   (sign-out). The mood guess goes back OFF (its opt-in default, ADR 0002): a purge never turns it
   on. The theme, reduce motion and colour-blind friendly inks are preferences, not data, so they
   survive. */
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
  useDevicePrefs.getState().clearMoodPrefs()
  useEmilyStore.getState().reset()
  // The store, not just its key: a mounted Loti bubble would otherwise save the old turns back.
  useLotiSession.getState().clear()
}
