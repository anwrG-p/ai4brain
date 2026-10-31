import { create } from 'zustand'
import { isPillarId, type PillarId } from './pillars'

/* Yearly goals: the minimal slice Loti's setGoal writes to (ticket 03). Ticket 04 adopts it next
   to the session store and wires clearGoals() into the privacy purge. A target is the number of
   points (on the 0-100 pillar scale) the user wants to gain on that pillar this year. */

export const GOALS_KEY = 'synapsetwin_goals_v1'
const VERSION = 1

export type Goals = Partial<Record<PillarId, number>>

interface StoredGoals {
  year: number | null
  goals: Goals
}

export interface GoalsState extends StoredGoals {
  setGoal: (pillar: PillarId, target: number, now?: Date) => void
  clearGoals: () => void
}

const EMPTY: StoredGoals = { year: null, goals: {} }

/** Reads the stored goals; anything corrupt, foreign or from another version reads as empty. */
export function loadGoals(): StoredGoals {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(GOALS_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY
    const { version, year, goals } = raw as Record<string, unknown>
    if (version !== VERSION || typeof year !== 'number' || !goals || typeof goals !== 'object') return EMPTY
    const clean: Goals = {}
    for (const [pillar, target] of Object.entries(goals)) {
      if (isPillarId(pillar) && typeof target === 'number' && Number.isFinite(target)) clean[pillar] = target
    }
    return { year, goals: clean }
  } catch {
    return EMPTY
  }
}

function save(state: StoredGoals) {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify({ version: VERSION, ...state }))
  } catch {
    // Storage full or blocked: the goals still live for this visit.
  }
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  ...loadGoals(),
  setGoal: (pillar, target, now = new Date()) => {
    const year = now.getFullYear()
    const goals = get().year === year ? { ...get().goals, [pillar]: target } : { [pillar]: target }
    set({ year, goals })
    save({ year, goals })
  },
  clearGoals: () => {
    set(EMPTY)
    try {
      localStorage.removeItem(GOALS_KEY)
    } catch {
      // Nothing stored to clear.
    }
  },
}))

export function hasGoalsForYear(state: StoredGoals, year: number): boolean {
  return state.year === year && Object.keys(state.goals).length > 0
}
