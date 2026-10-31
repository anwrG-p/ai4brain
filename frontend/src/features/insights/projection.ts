/* The doc's projection model ("Rou7 zebda", DASHBOARD PROJECTIONS): exponential approach to a
   ceiling, a decay penalty when idle, and an RCI gate before calling a change real.

     T(t) = Tmax - (Tmax - T0) * e^(-alpha * N) - lambda * dt_idle

   N is the number of sessions since T0 and dt_idle the idle days. Scores are on the 0-100 pillar
   scale. Defaults (assumptions to tune against Member 3's data, not evidence):
   - Tmax = 90: a ceiling below 100, since timed tasks have a physiological limit; raised to the best
     score seen when the user is already above it.
   - lambda = 0.1 points per idle day (about 3 points per idle month), counted after a 2-day grace,
     which is the gap 4 sessions a week leave.
   - alpha falls back to 0.05 per session with fewer than 3 points (about 60% of the gap closed in
     30 days at 4 sessions a week), and is clamped to 0.01-0.3. */

const DAY_MS = 86_400_000
export const DEFAULT_TMAX = 90
export const DEFAULT_LAMBDA = 0.1
export const GRACE_DAYS = 2
export const SESSIONS_PER_WEEK = 4
export const FALLBACK_ALPHA = 0.05
const ALPHA_MIN = 0.01
const ALPHA_MAX = 0.3

/** alpha by least squares through the origin on ln((Tmax - T_n) / (Tmax - T0)) = -alpha * n, where
    `scores` are in session order and T0 is the first. */
export function fitAlpha(scores: readonly number[], tmax: number): number {
  const t0 = scores[0]
  if (scores.length < 3 || t0 === undefined || t0 >= tmax) return FALLBACK_ALPHA
  let sxy = 0
  let sxx = 0
  scores.forEach((t, n) => {
    if (n === 0) return
    const ratio = Math.max(1e-6, (tmax - t) / (tmax - t0))
    sxy += n * Math.log(ratio)
    sxx += n * n
  })
  return Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, -sxy / sxx))
}

export type ProjectionPoint = { day: number; at: number; score: number }
export type Projection = {
  alpha: number
  tmax: number
  lambda: number
  /** Training 4 sessions a week from now. */
  optimal: ProjectionPoint[]
  /** No training from now. */
  decay: ProjectionPoint[]
}

export type ProjectionOptions = {
  now?: Date
  days?: 30 | 90
  tmax?: number
  lambda?: number
}

/** Daily points from today (day 0) for `days` days, or null without history. Both series start at
    the latest score less the idle penalty so far. Because the exponential has no memory, re-basing
    T0 to that score and counting N from today is the same curve as the doc's formula.
    `optimal` counts 4/7 of a session per day (a smooth expected count) and no idle time; `decay`
    keeps N and adds the idle days. Both are clamped to 0..Tmax. */
export function projection(
  history: readonly { at: string | number; score: number }[],
  opts: ProjectionOptions = {},
): Projection | null {
  if (!history.length) return null
  const sorted = [...history].sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime())
  const scores = sorted.map((h) => h.score)
  const tmax = Math.max(opts.tmax ?? DEFAULT_TMAX, ...scores)
  const lambda = opts.lambda ?? DEFAULT_LAMBDA
  const alpha = fitAlpha(scores, tmax)
  const now = (opts.now ?? new Date()).getTime()
  const days = opts.days ?? 30
  const last = sorted[sorted.length - 1]!
  const idleNow = Math.max(0, (now - new Date(last.at).getTime()) / DAY_MS)
  const penalty = (idleDays: number) => lambda * Math.max(0, idleDays - GRACE_DAYS)
  const start = Math.max(0, last.score - penalty(idleNow))
  const clamp = (x: number) => Math.min(tmax, Math.max(0, x))

  const optimal: ProjectionPoint[] = []
  const decay: ProjectionPoint[] = []
  for (let day = 0; day <= days; day++) {
    const at = now + day * DAY_MS
    const n = (day * SESSIONS_PER_WEEK) / 7
    optimal.push({ day, at, score: clamp(start + (tmax - start) * (1 - Math.exp(-alpha * n))) })
    decay.push({ day, at, score: clamp(last.score - penalty(idleNow + day)) })
  }
  return { alpha, tmax, lambda, optimal, decay }
}

/** Reliable Change Index (Jacobson & Truax 1991): (current - baseline) / SEdiff, with
    SEdiff = sqrt(2) * sd * sqrt(1 - rxx). */
export function rci(current: number, baseline: number, rxx = 0.8, sd = 10): number {
  return (current - baseline) / (Math.SQRT2 * sd * Math.sqrt(1 - rxx))
}

export const RCI_THRESHOLD = 1.96

/** A change counts as real only when RCI >= 1.96 (p < .05). The 1e-9 absorbs float rounding at the
    boundary itself. */
export function isRealImprovement(current: number, baseline: number, rxx = 0.8, sd = 10): boolean {
  return rci(current, baseline, rxx, sd) >= RCI_THRESHOLD - 1e-9
}
