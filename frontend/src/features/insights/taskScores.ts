import type { SchemaType, TelemetryEvent } from '../assessment/telemetry/types'
import type { InputScore, TaskScores } from './pillars'

/* Telemetry events -> the doc's 0-100 inputs (the mapping table is in pillars.ts). Pure: the
   caller passes one session's events; nothing is added to the server contract. */

/** The exercise an event came from. The event has no schema_type and task_id is the server's own
    (only mock ids carry a prefix), so it is read from the trial_meta signature, which is unique per
    exercise (assessment_engine/README.md, "trial_meta by schema_type"). Matrix logs no extra keys,
    so it is the pattern_induction event without relational's `hops`. */
export function schemaOf(e: TelemetryEvent): SchemaType | null {
  const m = e.trial_meta ?? {}
  if ('stream' in m) return 'n_back'
  if ('congruent' in m) return 'stroop'
  if ('angle_deg' in m) return 'mental_rotation'
  if ('hops' in m) return 'relational'
  if ('l_min' in m) return 'tower'
  if ('shown_ms' in m || 'peripheral_ok' in m) return 'ufov'
  if ('kind' in m) return 'mst'
  if (e.dimension === 'pattern_induction') return 'matrix'
  return null
}

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function probit(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const [a0, a1, a2, a3, a4, a5] = a as [number, number, number, number, number, number]
  const [b0, b1, b2, b3, b4] = b as [number, number, number, number, number]
  const [c0, c1, c2, c3, c4, c5] = c as [number, number, number, number, number, number]
  const [d0, d1, d2, d3] = d as [number, number, number, number]
  const tail = (q: number) =>
    (((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) / ((((d0 * q + d1) * q + d2) * q + d3) * q + 1)
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)))
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)))
  const q = p - 0.5
  const r = q * q
  return ((((((a0 * r + a1) * r + a2) * r + a3) * r + a4) * r + a5) * q) / (((((b0 * r + b1) * r + b2) * r + b3) * r + b4) * r + 1)
}

/** d' with the log-linear correction applied to every table (Hautus 1995):
    H = (hits + 0.5) / (N_signal + 1), FA = (FAs + 0.5) / (N_noise + 1). */
export function dPrime(hits: number, nSignal: number, fas: number, nNoise: number): number {
  return probit((hits + 0.5) / (nSignal + 1)) - probit((fas + 0.5) / (nNoise + 1))
}

/** Lure Discrimination Index: P("similar" | lure) - P("similar" | new). */
export function ldi(similarLures: number, nLures: number, similarNew: number, nNew: number): number {
  return similarLures / nLures - similarNew / nNew
}

// Scale anchors (documented in pillars.ts).
const D_PRIME_MAX = 4
const SWITCH_COST_MAX = 0.5
const STROOP_COST_MAX_MS = 300
const PLAN_TIME_MAX_MS = 30_000 // half of the TOL-F 60 s limit
const UFOV_MIN_MS = 17 // one 60 Hz frame
const UFOV_MAX_MS = 500 // the top of the UFOV duration grid

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const ok = (e: TelemetryEvent) => !e.error_flag
const share = (es: TelemetryEvent[], f: (e: TelemetryEvent) => boolean) => es.filter(f).length / es.length
const num = (e: TelemetryEvent, key: string) => {
  const v = e.trial_meta?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
const input = (fraction: number, trials: number): InputScore => ({ score: 100 * clamp01(fraction), trials })

export function taskScores(events: readonly TelemetryEvent[]): TaskScores {
  const by = new Map<SchemaType, TelemetryEvent[]>()
  for (const e of events) {
    const s = schemaOf(e)
    if (s) by.set(s, [...(by.get(s) ?? []), e])
  }
  const get = (s: SchemaType) => by.get(s) ?? []
  const out: TaskScores = {}

  // n-back. Only the rule stream's answer follows trial_type (target <-> respond), so d' uses it.
  // ponytail: 'parity' rule events have no stream to score and are skipped for d'.
  const nb = get('n_back')
  const ruleStream = nb.filter((e) => e.trial_meta?.stream === e.trial_meta?.rule)
  const signal = ruleStream.filter((e) => e.trial_meta?.trial_type === 'target')
  const noise = ruleStream.filter((e) => e.trial_meta?.trial_type !== 'target')
  if (signal.length && noise.length) {
    const d = dPrime(signal.filter(ok).length, signal.length, noise.filter((e) => !ok(e)).length, noise.length)
    out.OSPAN = input(d / D_PRIME_MAX, ruleStream.length)
  }
  const switches = nb.filter((e) => e.trial_meta?.trial_type === 'switch')
  const rest = nb.filter((e) => e.trial_meta?.trial_type !== 'switch')
  if (switches.length && rest.length) {
    const cost = share(rest, ok) - share(switches, ok)
    out.DCCS_SwitchCost = input(1 - cost / SWITCH_COST_MAX, nb.length)
  }

  // Stroop: RT cost on correct trials; incongruent accuracy stands in for SSRT.
  const st = get('stroop')
  const inc = st.filter((e) => e.trial_meta?.congruent === false)
  const incOk = inc.filter(ok)
  const conOk = st.filter((e) => e.trial_meta?.congruent === true && ok(e))
  if (incOk.length && conOk.length) {
    const cost = mean(incOk.map((e) => e.response_time_ms)) - mean(conOk.map((e) => e.response_time_ms))
    out.ANT_Conflict = input(1 - cost / STROOP_COST_MAX_MS, incOk.length + conOk.length)
  }
  if (inc.length) out.SST_SSRT = { ...input(share(inc, ok), inc.length), proxy: true }

  // Tower: one event per problem.
  const tw = get('tower').filter((e) => num(e, 'l_min') !== null && num(e, 'l_user') !== null)
  if (tw.length) {
    const solved = (e: TelemetryEvent) => e.trial_meta?.solved === true
    const ratio = (e: TelemetryEvent) => (solved(e) ? Math.min(1, num(e, 'l_min')! / Math.max(1, num(e, 'l_user')!)) : 0)
    out.OTS_Execution = input(mean(tw.map(ratio)), tw.length)
    const perfect = tw.filter((e) => solved(e) && num(e, 'l_user')! <= num(e, 'l_min')!)
    const speed = perfect.length
      ? mean(perfect.map((e) => clamp01(1 - (num(e, 'planning_time_ms') ?? PLAN_TIME_MAX_MS) / PLAN_TIME_MAX_MS)))
      : 0
    out.OTS_Planning = input(0.8 * (perfect.length / tw.length) + 0.2 * speed, tw.length)
  }

  // Matrix accuracy and hop-weighted relational accuracy, averaged.
  const mx = get('matrix')
  const rel = get('relational')
  const hops = (e: TelemetryEvent) => Math.max(1, num(e, 'hops') ?? 1)
  const parts: number[] = []
  if (mx.length) parts.push(share(mx, ok))
  if (rel.length) parts.push(rel.reduce((a, e) => a + (ok(e) ? hops(e) : 0), 0) / rel.reduce((a, e) => a + hops(e), 0))
  if (parts.length) out.FluidMatrices = input(mean(parts), mx.length + rel.length)

  // MST: a timeout ('none') counts as not "similar".
  const ms = get('mst')
  const lures = ms.filter((e) => e.trial_meta?.kind === 'lure')
  const news = ms.filter((e) => e.trial_meta?.kind === 'new')
  const similar = (e: TelemetryEvent) => e.trial_meta?.response === 'similar'
  if (lures.length && news.length) {
    out.MST_LDI = input(ldi(lures.filter(similar).length, lures.length, news.filter(similar).length, news.length), lures.length + news.length)
  }

  // UFOV: the QUEST threshold rides on each task's last event; several tasks are averaged.
  const uf = get('ufov')
  const thresholds = uf.map((e) => num(e, 'quest_threshold_ms')).filter((t): t is number => t !== null)
  if (thresholds.length) out.UFOV_SOA = input((UFOV_MAX_MS - mean(thresholds)) / (UFOV_MAX_MS - UFOV_MIN_MS), uf.length)
  if (uf.length) out.ANT_Orienting = input(share(uf, (e) => e.trial_meta?.peripheral_ok === true), uf.length)

  const recovery = errorRecovery(events)
  if (recovery) out.ErrorRecovery = recovery
  return out
}

/** Accuracy on the trial right after an error, within each task. A trial (n-back logs one event
    per stream) is wrong when any of its events is. */
function errorRecovery(events: readonly TelemetryEvent[]): InputScore | null {
  const tasks = new Map<string, Map<number, boolean>>()
  for (const e of events) {
    const trials = tasks.get(e.task_id) ?? new Map<number, boolean>()
    trials.set(e.trial_index, (trials.get(e.trial_index) ?? true) && ok(e))
    tasks.set(e.task_id, trials)
  }
  let after = 0
  let recovered = 0
  for (const trials of tasks.values()) {
    const seq = [...trials.entries()].sort((x, y) => x[0] - y[0]).map(([, correct]) => correct)
    for (let k = 1; k < seq.length; k++) {
      if (seq[k - 1]) continue
      after++
      if (seq[k]) recovered++
    }
  }
  return after ? input(recovered / after, after) : null
}
