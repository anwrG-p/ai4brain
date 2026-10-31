import { useAppStore } from '../../state/useAppStore'
import { tracker } from '../assessment/telemetry/tracker'
import { forgetUserId } from '../assessment/tasks/taskSource'
import { GOALS_KEY, useGoalsStore } from '../insights/goals'
import { SESSIONS_KEY, useSessionStore } from '../insights/sessionStore'

/* Everything this device holds about the user, for "Export my data" and "Delete my data".
   The tracker and the task source keep their keys private; tracker.test.ts and taskSource.ts pin
   the same strings. */
export const CONSENT_KEY = 'synapsetwin_consent_v1' // 'granted' | 'denied'; absent means not chosen yet
export const QUEUE_KEY = 'synapsetwin_telemetry_queue_v2' // answers waiting to be sent
export const UID_KEY = 'aura_uid' // the anonymous id
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

export interface MyData {
  exportedAt: string
  consent: string
  localStorage: Record<string, unknown>
  sessionStorage: Record<string, unknown>
  /** The profile and app settings: every non-function field of the app store. */
  app: Record<string, unknown>
}

export function collectMyData(now = new Date()): MyData {
  return {
    exportedAt: now.toISOString(),
    consent: tracker.getStatus().consent,
    localStorage: Object.fromEntries(LOCAL_KEYS.map((k) => [k, read(() => localStorage, k)])),
    sessionStorage: { [LOTI_KEY]: read(() => sessionStorage, LOTI_KEY) },
    app: Object.fromEntries(Object.entries(useAppStore.getState()).filter(([, v]) => typeof v !== 'function')),
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
  setTimeout(() => URL.revokeObjectURL(url), 0)
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
