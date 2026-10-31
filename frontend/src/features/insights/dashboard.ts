import { EXERCISE_NAME } from '../assessment/names'
import type { SchemaType } from '../assessment/telemetry/types'
import type { StoredGoals } from './goals'
import { PILLAR_IDS, pillarScores, unifiedScore, type InputId, type PillarId, type PillarScore } from './pillars'
import { isRealImprovement } from './projection'
import type { SessionRecord } from './sessionStore'

/* What the Home dashboard shows, from the sessions on this device (R5). Pure: no store, no clock. */

const DAY_MS = 86_400_000
type Pillars = Record<PillarId, PillarScore>

const byTime = (sessions: readonly SessionRecord[]) =>
  [...sessions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

/** Each pillar as last measured: the latest session that gave it a score. A short session that
    skipped a pillar does not blank it.
    ponytail: a pillar's latest single session, not a running estimate over several. */
export function currentPillars(sessions: readonly SessionRecord[]): Pillars {
  const out = pillarScores({})
  for (const s of byTime(sessions)) {
    const p = pillarScores(s.inputs)
    for (const id of PILLAR_IDS) if (p[id].score !== null) out[id] = p[id]
  }
  return out
}

/** The lowest measured pillar among `among` (default all), or null when none of them is measured;
    ties keep the pillar order. The one weakest pillar of the app: Home, Loti and Train use it. */
export function weakestPillar(pillars: Pillars, among: readonly PillarId[] = PILLAR_IDS): PillarId | null {
  let best: PillarId | null = null
  for (const id of PILLAR_IDS) {
    const s = pillars[id].score
    if (s === null || !among.includes(id)) continue
    if (best === null || s < pillars[best].score!) best = id
  }
  return best
}

/** Pillars whose latest score is a real improvement (RCI >= 1.96) over their first measured score. */
export function improvedPillars(sessions: readonly SessionRecord[]): PillarId[] {
  const scored = byTime(sessions).map((s) => pillarScores(s.inputs))
  return PILLAR_IDS.filter((id) => {
    const values = scored.map((p) => p[id].score).filter((v): v is number => v !== null)
    return values.length >= 2 && isRealImprovement(values.at(-1)!, values[0]!)
  })
}

export type HistoryPoint = { at: string; score: number }

/** The unified score of every session that has one, oldest first. */
export function unifiedHistory(sessions: readonly SessionRecord[]): HistoryPoint[] {
  return byTime(sessions).flatMap((s) => {
    const score = unifiedScore(pillarScores(s.inputs))
    return score === null ? [] : [{ at: s.at, score }]
  })
}

/** Monday 00:00 (local time) of the week holding `d`. */
export function weekStart(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

export function sessionsThisWeek(sessions: readonly SessionRecord[], now: Date): number {
  const from = weekStart(now).getTime()
  return sessions.filter((s) => Date.parse(s.at) >= from && Date.parse(s.at) <= now.getTime()).length
}

export type GoalLine = {
  pillar: PillarId
  /** Points to gain this year. */
  target: number
  /** The pillar's score when the goal was set, or null when it was not measured yet. */
  base: number | null
  /** base + target (at most 100), or null without a base. */
  goal: number | null
  /** The pillar's latest score, or null. */
  current: number | null
  reached: boolean
}

/** Each of this year's goals against its own pillar: "Deep Memory 52 -> goal 62". A goal is never
    met when it is set (current = base < goal), and only its own pillar can meet it: reaching needs
    current >= goal and a rise above the base (so a goal capped at 100 from 100 is not met at once). */
export function goalLines(stored: StoredGoals, pillars: Pillars, now: Date): GoalLine[] {
  if (stored.year !== now.getFullYear()) return []
  return PILLAR_IDS.flatMap((pillar) => {
    const target = stored.goals[pillar]
    if (target === undefined) return []
    const base = stored.bases[pillar] ?? null
    const goal = base === null ? null : Math.min(100, base + target)
    const current = pillars[pillar].score
    const reached = goal !== null && current !== null && base !== null && current >= goal && current > base
    return [{ pillar, target, base, goal, current, reached }]
  })
}

const MIN_PAST_DAYS = 21
export const MAX_HORIZON_DAYS = 30

/** The progress curve's time range: at least 21 past days, and a forecast of at most 30% of the whole
    range (spec charts table), capped at 30 days. */
export function curveWindow(history: readonly HistoryPoint[], now: Date) {
  const first = history.length ? Date.parse(history[0]!.at) : now.getTime()
  const pastDays = Math.max(MIN_PAST_DAYS, Math.ceil((now.getTime() - first) / DAY_MS))
  const horizonDays = Math.min(MAX_HORIZON_DAYS, Math.floor((pastDays * 3) / 7))
  return { start: now.getTime() - pastDays * DAY_MS, end: now.getTime() + horizonDays * DAY_MS, horizonDays }
}

/* Past results per exercise and week, for the heatmap behind "Further explore my training". Each input
   belongs to the exercise it is measured in (pillars.ts header). ErrorRecovery spans every exercise,
   so it is left out. ponytail: FluidMatrices mixes Pattern Puzzle and Logic Web; it is shown as Logic
   Web, the one in the five-exercise session. */
const INPUT_EXERCISE: Partial<Record<InputId, SchemaType>> = {
  OSPAN: 'n_back',
  DCCS_SwitchCost: 'n_back',
  OTS_Planning: 'tower',
  OTS_Execution: 'tower',
  FluidMatrices: 'relational',
  ANT_Conflict: 'stroop',
  SST_SSRT: 'stroop',
  MST_LDI: 'mst',
  UFOV_SOA: 'ufov',
  ANT_Orienting: 'ufov',
}
const EXERCISE_ORDER: readonly SchemaType[] = ['relational', 'n_back', 'tower', 'ufov', 'mst', 'stroop']

/** Below this many filled cells the past results show as a list, not a heatmap (spec charts table). */
export const HEATMAP_MIN_CELLS = 20

export type ExerciseRow = { schema: SchemaType; name: string; values: (number | null)[] }

/** One row per exercise that has data, one column per week (Monday starts, contiguous); each value
    the mean of that exercise's input scores over the week's sessions. */
export function exerciseWeeks(sessions: readonly SessionRecord[]) {
  const sorted = byTime(sessions)
  if (!sorted.length) return { weeks: [] as number[], rows: [] as ExerciseRow[], cells: 0 }
  const first = weekStart(new Date(sorted[0]!.at)).getTime()
  const weeks: number[] = []
  for (let w = new Date(first); w.getTime() <= Date.parse(sorted.at(-1)!.at); w.setDate(w.getDate() + 7)) {
    weeks.push(w.getTime())
  }
  const sums = new Map<SchemaType, { sum: number; n: number }[]>()
  for (const s of sorted) {
    const col = weeks.indexOf(weekStart(new Date(s.at)).getTime())
    const per = new Map<SchemaType, number[]>()
    for (const [id, input] of Object.entries(s.inputs) as [InputId, { score: number }][]) {
      const ex = INPUT_EXERCISE[id]
      if (ex) per.set(ex, [...(per.get(ex) ?? []), input.score])
    }
    for (const [ex, scores] of per) {
      const row = sums.get(ex) ?? weeks.map(() => ({ sum: 0, n: 0 }))
      row[col]!.sum += scores.reduce((a, b) => a + b, 0) / scores.length
      row[col]!.n += 1
      sums.set(ex, row)
    }
  }
  const rows = EXERCISE_ORDER.flatMap((schema) => {
    const row = sums.get(schema)
    return row ? [{ schema, name: EXERCISE_NAME[schema], values: row.map((c) => (c.n ? c.sum / c.n : null)) }] : []
  })
  const cells = rows.reduce((n, r) => n + r.values.filter((v) => v !== null).length, 0)
  return { weeks, rows, cells }
}

/** Where "Start today's session" goes: training for the weakest measured pillar (/train?pillar=),
    or the five-exercise baseline when nothing is measured yet. */
export function sessionPath(weakest: PillarId | undefined): string {
  return weakest ? `/train?pillar=${weakest}` : '/baseline'
}
