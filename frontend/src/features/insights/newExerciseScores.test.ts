import { describe, expect, it } from 'vitest'
import type { Dimension, TelemetryEvent, TrialMeta } from '../assessment/telemetry/types'
import { pillarScores } from './pillars'
import { quantile6, schemaOf, ssrt, taskScores } from './taskScores'

/* The scorers of the newer exercises (ticket F-B), on hand-computed vectors. Each expected value is
   worked out in the comment above it, so the Python port (BE-07) can check the same numbers. */

let seq = 0
function ev(meta: TrialMeta, o: { ok?: boolean; rt?: number; dim?: Dimension; task?: string; trial?: number } = {}): TelemetryEvent {
  const ok = o.ok ?? true
  return {
    user_id: 'u',
    session_id: 's',
    task_id: o.task ?? 'sst',
    trial_index: o.trial ?? seq++,
    dimension: o.dim ?? 'executive_function',
    score_norm: ok ? 1 : 0,
    response_time_ms: o.rt ?? 800,
    error_flag: !ok,
    error_burst: 0,
    hesitation_jitter: 0,
    trial_meta: meta,
    client_ts: '2026-11-01T10:00:00Z',
  }
}

// ---- Stop Light ------------------------------------------------------------------------------

const goEv = (rt: number | null, ok = rt !== null) =>
  ev({ stop_trial: false, dir: 'left', response: rt === null ? 'none' : ok ? 'left' : 'right' }, { ok, rt: rt ?? 1250 })
const stopEv = (ssd: number, rt: number | null) =>
  ev({ stop_trial: true, dir: 'left', response: rt === null ? 'none' : 'left', ssd_ms: ssd }, { ok: rt === null, rt: rt ?? 1250 })

// 10 go trials: 8 correct presses at 300..650 ms, 2 omissions. 4 stop trials, SSD 200/250/300/250
// (mean 250), 2 failed (signal-respond RT 380 and 420, mean 400 < mean go RT 475).
const BASE_GO = [300, 350, 400, 450, 500, 550, 600, 650].map((rt) => goEv(rt))
const session = (stops = [stopEv(200, 380), stopEv(250, null), stopEv(300, 420), stopEv(250, null)]) => [
  ...BASE_GO,
  goEv(null),
  goEv(null),
  ...stops,
]

describe('quantile6 (R type 6)', () => {
  it('interpolates at h = (n + 1) p and clamps at the ends', () => {
    expect(quantile6([1, 2, 3, 4], 0.5)).toBe(2.5) // h = 2.5
    expect(quantile6([1, 2, 3, 4], 0.1)).toBe(1) // h = 0.5 -> first
    expect(quantile6([1, 2, 3, 4], 0.9)).toBe(4) // h = 4.5 -> last
    expect(quantile6([10, 20, 30], 0.25)).toBe(10) // h = 1 exactly
    expect(quantile6([10, 20, 30], 0.6)).toBeCloseTo(24, 10) // h = 2.4: x2 + 0.4 x (x3 - x2)
  })
})

describe('Stop Light: SSRT (integration method, Verbruggen et al. 2019)', () => {
  it('is read from the stop_trial signature', () => {
    expect(schemaOf(stopEv(250, null))).toBe('stop_signal')
    expect(schemaOf(goEv(400))).toBe('stop_signal')
  })

  it('replaces go omissions with the slowest go RT and takes the type-6 quantile at P(respond | signal)', () => {
    // Go RTs with omissions -> 650: [300 350 400 450 500 550 600 650 650 650]; P(respond | signal) = 2/4.
    // h = 11 x 0.5 = 5.5 -> 500 + 0.5 x (550 - 500) = 525. SSRT = 525 - mean SSD 250 = 275.
    expect(ssrt(session())).toBe(275)
  })

  it('counts choice errors in the go distribution (they are go responses)', () => {
    // Swap the 650 press for a wrong-way press at 650: same RTs, same SSRT.
    const events = session().map((e, k) => (k === 7 ? goEv(650, false) : e))
    expect(ssrt(events)).toBe(275)
  })

  it('scores SST_SSRT: (450 - SSRT) / 300 times the go gate; trials = stop trials; not a proxy', () => {
    // Go accuracy 8/10 -> gate (0.8 - 0.5) / 0.5 = 0.6. (450 - 275) / 300 = 0.58333 -> x 0.6 = 35.
    const out = taskScores(session())
    expect(out.SST_SSRT!.score).toBeCloseTo(35, 9)
    expect(out.SST_SSRT!.trials).toBe(4)
    expect(out.SST_SSRT!.proxy).toBeUndefined()
  })

  it('applies the guide’s exclusions: P(respond | signal) outside [0.25, 0.75] gives no input', () => {
    const allStopped = session([stopEv(200, null), stopEv(250, null), stopEv(300, null), stopEv(350, null)])
    expect(ssrt(allStopped)).toBeNull()
    expect(taskScores(allStopped).SST_SSRT).toBeUndefined()
    const neverStopped = session([stopEv(200, 300), stopEv(150, 310), stopEv(100, 320), stopEv(50, 330)])
    expect(ssrt(neverStopped)).toBeNull()
    // 1 in 4 is still inside: h = 11 x 0.25 = 2.75 -> 350 + 0.75 x 50 = 387.5; minus mean SSD 250.
    const oneIn4 = session([stopEv(200, 380), stopEv(250, null), stopEv(300, null), stopEv(250, null)])
    expect(ssrt(oneIn4)).toBe(137.5)
  })

  it('applies the race-model check: signal-respond RTs not faster than go RTs give no input', () => {
    // Signal-respond mean 700 >= go mean 475.
    const slowFails = session([stopEv(200, 690), stopEv(250, null), stopEv(300, 710), stopEv(250, null)])
    expect(ssrt(slowFails)).toBeNull()
    expect(taskScores(slowFails).SST_SSRT).toBeUndefined()
  })

  it('scores a non-responder 0 (go gate 0), not "no data"', () => {
    const idle = [...Array.from({ length: 6 }, () => goEv(null)), stopEv(250, null), stopEv(300, null)]
    expect(taskScores(idle).SST_SSRT).toEqual({ score: 0, trials: 2 })
  })

  it('a go task at chance (half wrong) also scores 0', () => {
    const coin = [...[300, 320, 340, 360].map((rt) => goEv(rt)), ...[310, 330, 350, 370].map((rt) => goEv(rt, false)), stopEv(250, 300), stopEv(300, null)]
    expect(taskScores(coin).SST_SSRT).toEqual({ score: 0, trials: 2 })
  })

  it('needs stop trials: go trials alone give no input', () => {
    expect(taskScores(BASE_GO).SST_SSRT).toBeUndefined()
  })

  it('replaces the Color Clash stand-in: the proxy only fills in when the session has no Stop Light trials', () => {
    const stroop = [ev({ congruent: false }, { task: 'st', ok: true }), ev({ congruent: false }, { task: 'st', ok: false })]
    expect(taskScores(stroop).SST_SSRT).toEqual({ score: 50, trials: 2, proxy: true })
    const both = taskScores([...stroop, ...session()])
    expect(both.SST_SSRT!.proxy).toBeUndefined()
    expect(both.SST_SSRT!.score).toBeCloseTo(35, 9)
  })

  it('leaves Stop Light out of ErrorRecovery (the staircase makes stop errors by design)', () => {
    expect(taskScores(session()).ErrorRecovery).toBeUndefined()
  })

  it('wires Impulse Control: SST_SSRT at weight 0.5, no proxy listed', () => {
    const p = pillarScores(taskScores(session())).impulse
    expect(p.coverage).toBe(0.5)
    expect(p.score).toBeCloseTo(35, 9)
    expect(p.proxies).toEqual([])
  })
})
