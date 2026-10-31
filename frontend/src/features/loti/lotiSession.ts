import { create } from 'zustand'
import type { TaskSchemaType } from '../../types'
import { sanitizeTarget } from '../insights/goals'
import { isPillarId } from '../insights/pillars'
import type { LotiAction, LotiChoice, LotiMessage } from './types'

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

const SCHEMA_TYPES = ['n_back', 'stroop', 'matrix', 'mental_rotation', 'relational', 'tower', 'ufov', 'mst'] as const satisfies readonly TaskSchemaType[]
const isSchemaType = (x: unknown): x is TaskSchemaType => SCHEMA_TYPES.some((t) => t === x)
/** An in-app path only: one leading slash, no protocol-relative "//", no backslash. */
const isAppPath = (x: unknown): x is string => typeof x === 'string' && /^\/(?![/\\])[^\\]*$/.test(x)

/** Stored actions are untrusted (anyone can edit sessionStorage): rebuild each from known fields
    and drop anything that does not check out. */
function cleanAction(x: unknown): LotiAction | undefined {
  if (!x || typeof x !== 'object') return undefined
  const a = x as Record<string, unknown>
  switch (a.kind) {
    case 'train': {
      if (a.pillar !== undefined && !isPillarId(a.pillar)) return undefined
      if (a.schemaType !== undefined && !isSchemaType(a.schemaType)) return undefined
      return {
        kind: 'train',
        ...(a.pillar !== undefined && { pillar: a.pillar }),
        ...(a.schemaType !== undefined && { schemaType: a.schemaType }),
      }
    }
    case 'navigate':
      return isAppPath(a.to) ? { kind: 'navigate', to: a.to } : undefined
    case 'setGoal': {
      const target = sanitizeTarget(a.target)
      return isPillarId(a.pillar) && target !== null ? { kind: 'setGoal', pillar: a.pillar, target } : undefined
    }
    case 'reply':
      return typeof a.nodeId === 'string' ? { kind: 'reply', nodeId: a.nodeId } : undefined
    default:
      return undefined
  }
}

function cleanMessage(x: unknown): LotiMessage | null {
  const m = x as Partial<LotiMessage> | null
  if (!m || typeof m.id !== 'string' || typeof m.text !== 'string' || !Array.isArray(m.choices)) return null
  const choices: LotiChoice[] = []
  for (const c of m.choices as unknown[]) {
    const choice = c as Partial<LotiChoice> | null
    if (!choice || typeof choice.id !== 'string' || typeof choice.label !== 'string') return null
    const action = cleanAction(choice.action)
    // A choice whose action fails the check stays as a plain reply that ends the talk.
    choices.push(action ? { id: choice.id, label: choice.label, action } : { id: choice.id, label: choice.label })
  }
  const message: LotiMessage = { id: m.id, text: m.text, choices }
  if (m.pose === 'idle' || m.pose === 'talk' || m.pose === 'think' || m.pose === 'happy' || m.pose === 'wave') message.pose = m.pose
  return message
}

/** Reads the stored talk; corrupt, foreign or other-version data reads as empty, a bad turn is dropped. */
export function loadLotiSession(): LotiTalk {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(LOTI_SESSION_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY
    const { version, turns, current } = raw as Record<string, unknown>
    if (version !== VERSION || !Array.isArray(turns)) return EMPTY
    return { turns: turns.filter(isTurn).map((t) => ({ from: t.from, text: t.text })), current: cleanMessage(current) }
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
