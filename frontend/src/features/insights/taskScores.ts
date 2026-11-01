import { NBACK_RULE_STREAM } from '../assessment/telemetry/types'
import type { SchemaType, TelemetryEvent } from '../assessment/telemetry/types'
import type { InputScore, TaskScores } from './pillars'

/* Telemetry events -> the doc's 0-100 inputs (the mapping table is in pillars.ts). Pure: the
   caller passes one session's events; nothing is added to the server contract. */

/** The exercise an event came from. The event has no schema_type and task_id is the server's own
    (only mock ids carry a prefix), so it is read from the trial_meta signature, which is unique per
    exercise (assessment_engine/README.md, "trial_meta by schema_type"). Matrix logs no extra keys,
    so it is the pattern_induction event without relational's `hops`. The newer exercises are read
    first: their keys are their own (stop_trial; Arrow Focus logs `flanker`, never Stroop's
    `congruent`). */
export function schemaOf(e: TelemetryEvent): SchemaType | null {
  const m = e.trial_meta ?? {}
  if ('stop_trial' in m) return 'stop_signal'
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

// Scale anchors and gates (listed in pillars.ts). ASSUMPTIONS to tune against Member 3's data,
// not evidence, except the UFOV range (the payload's duration grid) and Stroop chance (4 inks).
export const D_PRIME_MAX = 4 // d' 0 -> 0, 4 -> 100
const D_PRIME_GATE = 1 // the switch cost counts fully from d' 1
export const SWITCH_COST_MAX = 0.5 // switch cost 0 -> 100, 0.5 -> 0
export const STROOP_COST_MAX_MS = 300 // RT cost 0 ms -> 100, 300 ms -> 0
const STROOP_CHANCE = 0.25 // red, green, blue, yellow (README payload contract)
export const PLAN_SHARE = 0.8 // OTS_Planning = 0.8 x solved in minimum moves + 0.2 x planning speed
export const PLAN_TIME_MAX_MS = 30_000 // half of the TOL-F 60 s limit
export const UFOV_MIN_MS = 17 // one 60 Hz frame
export const UFOV_MAX_MS = 500 // the top of the UFOV duration grid
export const SSRT_BEST_MS = 150 // SSRT 150 ms -> 100, 450 ms -> 0
export const SSRT_WORST_MS = 450
const SST_CHANCE = 0.5 // two arrows on the go task
// Exclusion rules of the consensus guide (Verbruggen et al. 2019), evidence, not tuning: outside
// this P(respond | signal) range the integration estimate is unreliable.
export const SST_P_RESPOND_MIN = 0.25
export const SST_P_RESPOND_MAX = 0.75

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

  // n-back. d' on the rule stream, switch trials left out (they feed the switch cost).
  const nb = get('n_back')
  const d = nbackDPrime(nb)
  if (d !== null) out.OSPAN = input(d / D_PRIME_MAX, ruleStream(nb).filter((e) => !isSwitch(e)).length)
  // Switch cost: switch trials against the rule stream's non-switch noise trials (both withhold a
  // response, so response bias cancels), gated by d' so a non-responder's perfect withholding
  // scores 0, not 100.
  const rs = ruleStream(nb)
  const switches = rs.filter(isSwitch)
  const quiet = rs.filter((e) => !isSwitch(e) && !isTarget(e))
  if (d !== null && switches.length && quiet.length) {
    const cost = share(quiet, ok) - share(switches, ok)
    out.DCCS_SwitchCost = input((1 - cost / SWITCH_COST_MAX) * clamp01(d / D_PRIME_GATE), switches.length + quiet.length)
  }

  // Stroop: RT cost on correct trials, gated by accuracy above chance so random or absent
  // pressing (no RT difference) scores 0, not 100. Incongruent accuracy stands in for SSRT.
  const st = get('stroop')
  const inc = st.filter((e) => e.trial_meta?.congruent === false)
  const incOk = inc.filter(ok)
  const conOk = st.filter((e) => e.trial_meta?.congruent === true && ok(e))
  const gate = st.length ? stroopGate(st) : 0
  if (incOk.length && conOk.length) {
    const cost = mean(incOk.map((e) => e.response_time_ms)) - mean(conOk.map((e) => e.response_time_ms))
    // The RT term is clamped before the gate: a negative cost must not lift a guesser above the gate.
    out.ANT_Conflict = input(clamp01(1 - cost / STROOP_COST_MAX_MS) * gate, incOk.length + conOk.length)
  } else if (st.length && gate === 0) {
    out.ANT_Conflict = input(0, st.length) // no cost to measure, and nothing above chance either
  }
  // SST_SSRT: Stop Light's SSRT when the session played it; Stroop's stand-in only otherwise.
  const ss = get('stop_signal')
  if (ss.length) {
    const sst = stopSignalInput(ss)
    if (sst) out.SST_SSRT = sst
  } else if (inc.length) out.SST_SSRT = { ...input(share(inc, ok), inc.length), proxy: true }

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
    out.OTS_Planning = input(PLAN_SHARE * (perfect.length / tw.length) + (1 - PLAN_SHARE) * speed, tw.length)
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

/** True for the n-back event that carries its trial's verdict: the one on the stream whose key the
    rule's hint names (NBACK_RULE_STREAM; symbol for parity). An unknown rule falls back to the
    stream of the same name. */
export function onRuleStream(e: TelemetryEvent): boolean {
  const rule = e.trial_meta?.rule
  const want = typeof rule === 'string' && Object.hasOwn(NBACK_RULE_STREAM, rule) ? NBACK_RULE_STREAM[rule as keyof typeof NBACK_RULE_STREAM] : rule
  return e.trial_meta?.stream === want
}

/** The events that count toward a block's accuracy: all of them, except n-back's off-rule events
    (the rule-stream event already holds the trial's verdict, R16). */
export const countsToward = (e: TelemetryEvent) => schemaOf(e) !== 'n_back' || onRuleStream(e)

const ruleStream = (nb: TelemetryEvent[]) => nb.filter(onRuleStream)
const isSwitch = (e: TelemetryEvent) => e.trial_meta?.trial_type === 'switch'
const isTarget = (e: TelemetryEvent) => e.trial_meta?.trial_type === 'target'

/** d' on the n-back rule stream (only its answer follows trial_type: target <-> respond; under a
    parity rule a target is an even symbol), switch trials left out. Signal = a rule-stream match
    (target); noise = every other non-switch trial, other-stream lures included. NBack.tsx marks the
    rule event wrong on any off-rule press (R16): on a noise trial that is a false alarm, on a target
    trial a miss (never a hit plus a false alarm). Floored at 0 when the raw hit rate is not above
    the raw false-alarm rate (the log-linear correction alone would give a non-responder a small
    positive d'). Null without both signal and noise trials. */
function nbackDPrime(nb: TelemetryEvent[]): number | null {
  const scored = ruleStream(nb).filter((e) => !isSwitch(e))
  const signal = scored.filter(isTarget)
  const noise = scored.filter((e) => !isTarget(e))
  if (!signal.length || !noise.length) return null
  const hits = signal.filter(ok).length
  const fas = noise.filter((e) => !ok(e)).length
  if (hits / signal.length <= fas / noise.length) return 0
  return Math.max(0, dPrime(hits, signal.length, fas, noise.length))
}

/** Hyndman & Fan (1996) type-6 sample quantile of ascending `sorted` (R's quantile(type = 6), the
    one the consensus guide's script uses): h = (n + 1) p, interpolated between the order statistics
    around h, clamped to the first and last. */
export function quantile6(sorted: readonly number[], p: number): number {
  const n = sorted.length
  const h = (n + 1) * p
  if (h <= 1) return sorted[0]!
  if (h >= n) return sorted[n - 1]!
  const lo = Math.floor(h)
  return sorted[lo - 1]! + (h - lo) * (sorted[lo]! - sorted[lo - 1]!)
}

const responded = (e: TelemetryEvent) => {
  const r = e.trial_meta?.response
  return typeof r === 'string' && r !== 'none'
}
const isStopTrial = (e: TelemetryEvent) => e.trial_meta?.stop_trial === true
const isGoTrial = (e: TelemetryEvent) => e.trial_meta?.stop_trial === false

/** Stop-signal reaction time by the integration method with go omissions replaced, as the consensus
    guide recommends (Verbruggen et al. 2019, eLife 8:e46323):
    - the go RT distribution is every go trial, choice errors included, with each omission
      (response 'none') replaced by the slowest go RT;
    - nth RT = its type-6 quantile at p = P(respond | signal);
    - SSRT = nth RT - mean SSD over all stop trials.
    Null (not estimable) under the guide's exclusion rules: no stop trial or no go response,
    P(respond | signal) outside [0.25, 0.75], or a mean signal-respond RT not below the mean go RT
    (responses on go trials only), which breaks the race model's independence. */
export function ssrt(events: readonly TelemetryEvent[]): number | null {
  const go = events.filter(isGoTrial)
  const stop = events.filter(isStopTrial)
  const goRts = go.filter(responded).map((e) => e.response_time_ms)
  const ssds = stop.map((e) => num(e, 'ssd_ms')).filter((v): v is number => v !== null)
  if (!stop.length || !goRts.length || ssds.length !== stop.length) return null
  const pRespond = share(stop, responded)
  if (pRespond < SST_P_RESPOND_MIN || pRespond > SST_P_RESPOND_MAX) return null
  if (mean(stop.filter(responded).map((e) => e.response_time_ms)) >= mean(goRts)) return null
  const slowest = Math.max(...goRts)
  const dist = go.map((e) => (responded(e) ? e.response_time_ms : slowest)).sort((a, b) => a - b)
  return quantile6(dist, pRespond) - mean(ssds)
}

/** SST_SSRT from one session's Stop Light events: SSRT scaled SSRT_BEST_MS -> 100, SSRT_WORST_MS -> 0,
    times the go-task gate (go accuracy - 1/2) / (1/2) (omissions count wrong), so pressing at random
    or not at all scores 0. A gate of 0 scores 0 even when no SSRT can be estimated; otherwise an
    SSRT the guide excludes gives no input. `trials` = stop trials. */
function stopSignalInput(ss: TelemetryEvent[]): InputScore | null {
  const go = ss.filter(isGoTrial)
  const stops = ss.filter(isStopTrial).length
  if (!stops) return null
  const gate = go.length ? clamp01((share(go, ok) - SST_CHANCE) / (1 - SST_CHANCE)) : 0
  if (gate === 0) return input(0, stops)
  const value = ssrt(ss)
  if (value === null) return null
  return input(clamp01((SSRT_WORST_MS - value) / (SSRT_WORST_MS - SSRT_BEST_MS)) * gate, stops)
}

/** 0 at chance accuracy (1 in 4 inks) or below, 1 at perfect accuracy. */
const stroopGate = (st: TelemetryEvent[]) => clamp01((share(st, ok) - STROOP_CHANCE) / (1 - STROOP_CHANCE))

/** Exercises whose errors are not the user's to recover from: Stop Light's staircase holds stop
    trials near half wrong by design. A task is read by its first event's schema. */
const NO_RECOVERY: ReadonlySet<SchemaType> = new Set<SchemaType>(['stop_signal'])

/** Accuracy on the trial right after an error, within each task. A trial is wrong when any of its
    events is; n-back logs one event per stream, and only its rule-stream event (which carries the
    trial's verdict, off-rule presses included) is read. Tasks played at chance or below (n-back d' 0,
    Stroop accuracy <= 1 in 4) are left out: a non-responder's next n-back trial is "correct" by
    withholding, which is not recovery. So are the NO_RECOVERY exercises. */
function errorRecovery(events: readonly TelemetryEvent[]): InputScore | null {
  const byTask = new Map<string, TelemetryEvent[]>()
  for (const e of events) byTask.set(e.task_id, [...(byTask.get(e.task_id) ?? []), e])
  let after = 0
  let recovered = 0
  for (const taskEvents of byTask.values()) {
    const first = taskEvents[0]
    const schema = first ? schemaOf(first) : null
    if ((schema && NO_RECOVERY.has(schema)) || atChance(taskEvents)) continue
    const read = schema === 'n_back' ? ruleStream(taskEvents) : taskEvents
    const trials = new Map<number, boolean>()
    for (const e of read) trials.set(e.trial_index, (trials.get(e.trial_index) ?? true) && ok(e))
    const seq = [...trials.entries()].sort((x, y) => x[0] - y[0]).map(([, correct]) => correct)
    for (let k = 1; k < seq.length; k++) {
      if (seq[k - 1]) continue
      after++
      if (seq[k]) recovered++
    }
  }
  return after ? input(recovered / after, after) : null
}

function atChance(taskEvents: TelemetryEvent[]): boolean {
  const first = taskEvents[0]
  const schema = first ? schemaOf(first) : null
  if (schema === 'n_back') return nbackDPrime(taskEvents) === 0
  if (schema === 'stroop') return stroopGate(taskEvents) === 0
  return false
}
