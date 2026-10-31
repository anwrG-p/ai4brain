import { create } from 'zustand'
import type { LotiChoice, LotiMessage } from './types'

/* The talk with Loti for this browser session: what Loti said, what the user picked, and the open
   question. Every LotiBubbles records into it, so a talk started on one page continues on /coach.
   It holds only bubbles the user answered or saw open (the coach adapter's memory rule), lives in
   sessionStorage and is gone when the tab closes. */

export const LOTI_SESSION_KEY = 'synapsetwin_loti_v1'
const VERSION = 1
/** ponytail: a cap, not a summary; the oldest turns drop first. */
export const MAX_TURNS = 200

export type LotiTurn = { from: 'loti' | 'you'; text: string }

export interface LotiTalk {
  turns: LotiTurn[]
  /** The question still waiting for a reply, shown with its chips; null when no talk is open. */
  current: LotiMessage | null
}

export interface LotiSessionState extends LotiTalk {
  /** Opens a talk on `message`. */
  begin: (message: LotiMessage) => void
  /** The user picked `choice` on `message`; `next` is Loti's answer (null ends the talk). */
  record: (message: LotiMessage, choice: LotiChoice, next: LotiMessage | null) => void
  clear: () => void
}

const EMPTY: LotiTalk = { turns: [], current: null }

const isTurn = (x: unknown): x is LotiTurn => {
  const t = x as Partial<LotiTurn> | null
  return !!t && (t.from === 'loti' || t.from === 'you') && typeof t.text === 'string'
}

const isMessage = (x: unknown): x is LotiMessage => {
  const m = x as Partial<LotiMessage> | null
  return (
    !!m &&
    typeof m.id === 'string' &&
    typeof m.text === 'string' &&
    Array.isArray(m.choices) &&
    m.choices.every((c) => !!c && typeof c.id === 'string' && typeof c.label === 'string')
  )
}

/** Reads the stored talk; corrupt, foreign or other-version data reads as empty, a bad turn is dropped. */
export function loadLotiSession(): LotiTalk {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(LOTI_SESSION_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY
    const { version, turns, current } = raw as Record<string, unknown>
    if (version !== VERSION || !Array.isArray(turns)) return EMPTY
    return { turns: turns.filter(isTurn), current: isMessage(current) ? current : null }
  } catch {
    return EMPTY
  }
}

function save(talk: LotiTalk) {
  try {
    sessionStorage.setItem(LOTI_SESSION_KEY, JSON.stringify({ version: VERSION, ...talk }))
  } catch {
    // Storage full or blocked: the talk still works for this page.
  }
}

export const useLotiSession = create<LotiSessionState>((set, get) => {
  const commit = (talk: LotiTalk) => {
    const next = { turns: talk.turns.slice(-MAX_TURNS), current: talk.current }
    set(next)
    save(next)
  }
  return {
    ...loadLotiSession(),
    begin: (message) => commit({ turns: get().turns, current: message }),
    record: (message, choice, next) => {
      const { turns, current } = get()
      const added: LotiTurn[] = []
      // An open question answered elsewhere with another bubble was still read: keep it.
      if (current && current.text !== message.text) added.push({ from: 'loti', text: current.text })
      added.push({ from: 'loti', text: message.text }, { from: 'you', text: choice.label })
      const open = next && next.choices.length > 0
      if (next && !open) added.push({ from: 'loti', text: next.text })
      commit({ turns: [...turns, ...added], current: open ? next : null })
    },
    clear: () => {
      set(EMPTY)
      try {
        sessionStorage.removeItem(LOTI_SESSION_KEY)
      } catch {
        // Nothing stored to clear.
      }
    },
  }
})
