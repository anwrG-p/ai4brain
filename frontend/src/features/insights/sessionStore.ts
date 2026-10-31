import { create } from 'zustand'
import { isInputId, type InputScore, type TaskScores } from './pillars'

/* Completed sessions on this device (R5): each one's per-input scores from taskScores(). Versioned
   like the goals slice and cleared by the privacy purge. Member 3's server profile can replace it. */

export const SESSIONS_KEY = 'synapsetwin_sessions_v1'
const VERSION = 1
/** ponytail: a cap, not a compaction policy; the oldest sessions drop first. */
export const MAX_SESSIONS = 365

export type SessionRecord = {
  id: string
  /** ISO 8601, when the session finished. */
  at: string
  inputs: TaskScores
}

export interface SessionState {
  sessions: SessionRecord[]
  /** Adds a session, or replaces the one saved under the same id. */
  addSession: (record: SessionRecord) => void
  clearSessions: () => void
}

function cleanInput(x: unknown): InputScore | null {
  if (!x || typeof x !== 'object') return null
  const { score, trials, proxy } = x as Record<string, unknown>
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) return null
  if (typeof trials !== 'number' || !Number.isInteger(trials) || trials < 0) return null
  if (proxy !== undefined && proxy !== true) return null
  return proxy ? { score, trials, proxy } : { score, trials }
}

function cleanRecord(x: unknown): SessionRecord | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const { id, at, inputs } = x as Record<string, unknown>
  if (typeof id !== 'string' || !id || typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return null
  const clean: TaskScores = {}
  for (const [key, value] of Object.entries(inputs)) {
    const v = cleanInput(value)
    if (isInputId(key) && v) clean[key] = v
  }
  return { id, at, inputs: clean }
}

/** Reads the stored sessions; corrupt, foreign or other-version data reads as empty, and a bad
    record or input is dropped on its own. */
export function loadSessions(): SessionRecord[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const { version, sessions } = raw as Record<string, unknown>
    if (version !== VERSION || !Array.isArray(sessions)) return []
    return sessions.map(cleanRecord).filter((r): r is SessionRecord => r !== null)
  } catch {
    return []
  }
}

function save(sessions: SessionRecord[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({ version: VERSION, sessions }))
  } catch {
    // Storage full or blocked: the sessions still live for this visit.
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: loadSessions(),
  addSession: (record) => {
    const clean = cleanRecord(record)
    if (!clean) return
    const sessions = [...get().sessions.filter((s) => s.id !== clean.id), clean].slice(-MAX_SESSIONS)
    set({ sessions })
    save(sessions)
  },
  clearSessions: () => {
    set({ sessions: [] })
    try {
      localStorage.removeItem(SESSIONS_KEY)
    } catch {
      // Nothing stored to clear.
    }
  },
}))
