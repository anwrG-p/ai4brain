import { PREFS_KEY, useDevicePrefs } from '../../state/devicePrefs'
import { useAppStore } from '../../state/useAppStore'
import { useEmilyStore } from '../../state/useEmilyStore'
import { COACH_CONSENT_KEY, CONSENT_KEY, QUEUE_KEY, tracker } from '../assessment/telemetry/tracker'
import { forgetUserId, getUserId, UID_KEY, usingMocks } from '../assessment/tasks/taskSource'
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

/** Downloads server-side telemetry and coach turns as JSONL if available. */
export async function downloadServerData(userId = getUserId()): Promise<boolean> {
  if (usingMocks()) return false
  try {
    const res = await fetch(`/v1/user/export?user_id=${encodeURIComponent(userId)}`)
    if (!res.ok) return false
    const blob = await res.blob()
    if (typeof URL !== 'undefined' && URL.createObjectURL && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${userId.toLowerCase()}-server-data.jsonl`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    return true
  } catch {
    return false
  }
}

/* The privacy purge: deletes user telemetry and task registries on the server (when connected),
   then purges local queued answers, both consent choices, the anonymous id, sessions, goals,
   Loti's talk, the mood prefs with any mood correction, and the profile (sign-out). */
export async function deleteMyData(): Promise<void> {
  const userId = getUserId()
  if (!usingMocks()) {
    try {
      await fetch(`/v1/user/telemetry?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' })
    } catch {
      // server unreachable or mock: continue with local deletion
    }
  }
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
