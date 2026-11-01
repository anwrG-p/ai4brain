import { create } from 'zustand'
import { sessionsThisWeek } from './dashboard'
import { isPillarId, type PillarId } from './pillars'
import type { SessionRecord } from './sessionStore'

/* Yearly goals: the slice Loti's setGoal writes to (ticket 03). A target is the number of points
   (on the 0-100 pillar scale) the user wants to gain on that pillar this year. Each goal also keeps
   its base: the pillar's score when the goal was set, so a goal reads "+10 from 52" and is checked
   against its own pillar only (ticket 08 review). A goal set before its pillar was measured has no
   base until the first score arrives (setBase). Version 1 still: `bases` is optional when loading. */

export const GOALS_KEY = 'synapsetwin_goals_v1'
const VERSION = 1

export type Goals = Partial<Record<PillarId, number>>
/** The pillar's score (0-100) at the moment each goal was set. */
export type GoalBases = Partial<Record<PillarId, number>>

export interface StoredGoals {
  year: number | null
  goals: Goals
  bases: GoalBases
}

export interface GoalsState extends StoredGoals {
  /** `base`: the pillar's current score, when it has one. */
  setGoal: (pillar: PillarId, target: number, now?: Date, base?: number) => void
  /** Records a base for a goal that has none yet; a goal's base never moves otherwise. */
  setBase: (pillar: PillarId, base: number) => void
  clearGoals: () => void
}

const EMPTY: StoredGoals = { year: null, goals: {}, bases: {} }

/** A sane target: a whole number of points from 1 to 100; anything else is dropped (null). */
export function sanitizeTarget(target: unknown): number | null {
  if (typeof target !== 'number' || !Number.isFinite(target) || target < 1) return null
  return Math.min(100, Math.round(target))
}

const isScore = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100

/** Reads the stored goals; anything corrupt, foreign or from another version reads as empty. */
export function loadGoals(): StoredGoals {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(GOALS_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY
    const { version, year, goals, bases } = raw as Record<string, unknown>
    if (version !== VERSION || typeof year !== 'number' || !goals || typeof goals !== 'object') return EMPTY
    const clean: Goals = {}
    for (const [pillar, target] of Object.entries(goals)) {
      const value = sanitizeTarget(target)
      if (isPillarId(pillar) && value !== null) clean[pillar] = value
    }
    const cleanBases: GoalBases = {}
    if (bases && typeof bases === 'object') {
      for (const [pillar, base] of Object.entries(bases)) {
        if (isPillarId(pillar) && clean[pillar] !== undefined && isScore(base)) cleanBases[pillar] = base
      }
    }
    return { year, goals: clean, bases: cleanBases }
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
  setGoal: (pillar, target, now = new Date(), base) => {
    const value = sanitizeTarget(target)
    if (value === null) return
    const year = now.getFullYear()
    const same = get().year === year
    const goals = same ? { ...get().goals, [pillar]: value } : { [pillar]: value }
    const bases: GoalBases = same ? { ...get().bases } : {}
    if (isScore(base)) bases[pillar] = base
    else delete bases[pillar]
    set({ year, goals, bases })
    save({ year, goals, bases })
  },
  setBase: (pillar, base) => {
    const { year, goals, bases } = get()
    if (goals[pillar] === undefined || bases[pillar] !== undefined || !isScore(base)) return
    const next = { ...bases, [pillar]: base }
    set({ bases: next })
    save({ year, goals, bases: next })
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

/* The weekly goal (research #10): 3 sessions a week (more than 3 a week showed no added benefit in a
   meta-analysis of older adults), with one built-in skip, so 2 of 3 still keeps the week. No streak
   is counted across weeks: every Monday starts again at 0, quietly, and nothing mentions a missed
   week. Computed from the sessions on this device; nothing extra is stored. */
export const WEEKLY_GOAL = 3
export const WEEKLY_SKIPS = 1

export type WeeklyGoal = {
  /** Sessions finished since Monday 00:00 (local time). */
  done: number
  target: number
  /** done >= target - WEEKLY_SKIPS: the week is kept, one skip allowed. */
  kept: boolean
}

/** The week is kept from WEEKLY_GOAL - WEEKLY_SKIPS sessions. Home's line and Loti's weekend nudge
    both decide with this. */
export const weekKept = (done: number): boolean => done >= WEEKLY_GOAL - WEEKLY_SKIPS

/** This week's count, the same one Loti reads (sessionsThisWeek: Monday 00:00 local time to now). */
export function weeklyGoal(sessions: readonly SessionRecord[], now: Date): WeeklyGoal {
  const done = sessionsThisWeek(sessions, now)
  return { done, target: WEEKLY_GOAL, kept: weekKept(done) }
}

/** The one plain line: "1 of 3 this week", and once the week is kept (one skip allowed) "2 of 3
    this week · week kept". Past the goal it counts on ("4 this week · week kept"). No guilt, no
    streak words, nothing about last week. */
export function weeklyGoalText({ done, target, kept }: WeeklyGoal): string {
  const count = done > target ? `${done} this week` : `${done} of ${target} this week`
  return kept ? `${count} · week kept` : count
}

export function hasGoalsForYear(state: { year: number | null; goals: Goals }, year: number): boolean {
  return state.year === year && Object.keys(state.goals).length > 0
}
