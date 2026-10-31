import { describe, expect, it } from 'vitest'
import type { Dimension, TelemetryEvent, TrialMeta } from '../assessment/telemetry/types'
import { dPrime, ldi, probit, schemaOf, taskScores } from './taskScores'

let seq = 0
function ev(
  meta: TrialMeta,
  o: { ok?: boolean; rt?: number; dim?: Dimension; trial?: number; task?: string } = {},
): TelemetryEvent {
  const ok = o.ok ?? true
  return {
    user_id: 'u',
    session_id: 's',
    task_id: o.task ?? 't1',
    trial_index: o.trial ?? seq++,
    dimension: o.dim ?? 'working_memory',
    score_norm: ok ? 1 : 0,
    response_time_ms: o.rt ?? 800,
    error_flag: !ok,
    error_burst: ok ? 0 : 1,
    hesitation_jitter: 0,
    trial_meta: meta,
    client_ts: '2026-10-31T10:00:00Z',
  }
}
const repeat = <T,>(n: number, f: (k: number) => T) => Array.from({ length: n }, (_, k) => f(k))

describe('schemaOf (from the trial_meta signature)', () => {
  it.each<[TrialMeta, Dimension, string | null]>([
    [{ trial_type: 'target', rule: 'position', stream: 'position' }, 'working_memory', 'n_back'],
    [{ congruent: true }, 'executive_function', 'stroop'],
    [{ angle_deg: 90, mirrored: false }, 'spatial_orientation', 'mental_rotation'],
    [{ hops: 2, inverted: false, level: 1 }, 'pattern_induction', 'relational'],
    [{ l_min: 4, l_user: 5, solved: true }, 'executive_function', 'tower'],
    [{ shown_ms: 52, central_ok: true, peripheral_ok: false }, 'processing_speed', 'ufov'],
    [{ kind: 'lure', delta: 0.1, response: 'similar' }, 'episodic_memory', 'mst'],
    [{ item_id: 'm:0' }, 'pattern_induction', 'matrix'],
    [{ item_id: 'x:0' }, 'processing_speed', null],
  ])('%j on %s -> %s', (meta, dim, schema) => {
    expect(schemaOf(ev(meta, { dim }))).toBe(schema)
  })
})

describe('probit and d′', () => {
  it('matches the normal quantiles', () => {
    expect(probit(0.5)).toBeCloseTo(0, 9)
    expect(probit(0.975)).toBeCloseTo(1.959964, 6)
    expect(probit(0.001)).toBeCloseTo(-3.090232, 6)
    expect(probit(0.0001)).toBeCloseTo(-3.719016, 6)
  })

  it('applies the log-linear correction to every table (Hautus 1995)', () => {
    // H = 9.5/11, FA = 1.5/31
    expect(dPrime(9, 10, 1, 30)).toBeCloseTo(2.757501, 5)
    // H = 20.5/26, FA = 5.5/26
    expect(dPrime(20, 25, 5, 25)).toBeCloseTo(1.602189, 5)
    // A perfect table stays finite
    expect(dPrime(10, 10, 0, 30)).toBeCloseTo(3.83182, 4)
  })
})

describe('LDI', () => {
  it('is P(similar | lure) - P(similar | new)', () => {
    expect(ldi(6, 10, 1, 10)).toBeCloseTo(0.5, 10)
    expect(ldi(0, 10, 2, 10)).toBeCloseTo(-0.2, 10)
  })
})

describe('taskScores', () => {
  it('is empty without events', () => {
    expect(taskScores([])).toEqual({})
  })

  it('scores n-back d′ on the rule stream and ignores the other stream', () => {
    const rule = 'position'
    const events = [
      ...repeat(10, (k) => ev({ trial_type: 'target', rule, stream: rule }, { ok: k < 9 })),
      ...repeat(30, (k) => ev({ trial_type: k % 2 ? 'standard' : 'lure_minus', rule, stream: rule }, { ok: k !== 0 })),
      ...repeat(20, () => ev({ trial_type: 'standard', rule, stream: 'symbol' }, { ok: false })),
    ]
    const ospan = taskScores(events).OSPAN
    expect(ospan?.trials).toBe(40)
    expect(ospan?.score).toBeCloseTo((100 * 2.757501) / 4, 3)
  })

  it('scores the n-back switch cost as an accuracy delta', () => {
    const events = [
      ...repeat(4, (k) => ev({ trial_type: 'switch', rule: 'symbol', stream: 'symbol' }, { ok: k !== 0 })),
      ...repeat(8, () => ev({ trial_type: 'standard', rule: 'symbol', stream: 'symbol' })),
    ]
    // cost = 1 - 0.75 = 0.25; 0 -> 100, 0.5 -> 0
    expect(taskScores(events).DCCS_SwitchCost).toEqual({ score: 50, trials: 12 })
  })

  it('scores the Stroop RT cost on correct trials only, and incongruent accuracy as a proxy', () => {
    const dim = 'executive_function'
    const events = [
      ev({ congruent: true }, { dim, rt: 500 }),
      ev({ congruent: true }, { dim, rt: 600 }),
      ev({ congruent: false }, { dim, rt: 650 }),
      ev({ congruent: false }, { dim, rt: 750 }),
      ev({ congruent: false }, { dim, rt: 2000, ok: false }),
    ]
    const s = taskScores(events)
    // cost = 700 - 550 = 150 ms; 0 ms -> 100, 300 ms -> 0
    expect(s.ANT_Conflict).toEqual({ score: 50, trials: 4 })
    expect(s.SST_SSRT?.score).toBeCloseTo(200 / 3, 6)
    expect(s.SST_SSRT).toMatchObject({ trials: 3, proxy: true })
  })

  it('leaves out an input it cannot compute', () => {
    const s = taskScores([ev({ congruent: true }, { dim: 'executive_function' })])
    expect(s.ANT_Conflict).toBeUndefined()
    expect(s.SST_SSRT).toBeUndefined()
  })

  it('scores LDI from MST responses', () => {
    const dim = 'episodic_memory'
    const events = [
      ...repeat(10, (k) => ev({ kind: 'lure', delta: 0.1, response: k < 6 ? 'similar' : k < 9 ? 'old' : 'none' }, { dim })),
      ...repeat(10, (k) => ev({ kind: 'new', delta: 0, response: k < 1 ? 'similar' : 'new' }, { dim })),
      ...repeat(5, () => ev({ kind: 'old', delta: 0, response: 'old' }, { dim })),
    ]
    expect(taskScores(events).MST_LDI).toEqual({ score: 50, trials: 20 })
  })

  it('scores UFOV from the QUEST threshold and the peripheral accuracy', () => {
    const dim = 'processing_speed'
    const events = [
      ev({ shown_ms: 100, central_ok: true, peripheral_ok: true }, { dim }),
      ev({ shown_ms: 100, central_ok: true, peripheral_ok: true }, { dim }),
      ev({ shown_ms: 50, central_ok: true, peripheral_ok: false }, { dim }),
      ev({ shown_ms: 50, central_ok: true, peripheral_ok: true, quest_threshold_ms: 258.5 }, { dim }),
    ]
    const s = taskScores(events)
    // 17 ms -> 100, 500 ms -> 0
    expect(s.UFOV_SOA?.score).toBeCloseTo(50, 6)
    expect(s.UFOV_SOA?.trials).toBe(4)
    expect(s.ANT_Orienting).toEqual({ score: 75, trials: 4 })
  })

  it('scores tower planning and execution', () => {
    const dim = 'executive_function'
    const events = [
      ev({ l_min: 4, l_user: 4, solved: true, planning_time_ms: 6000 }, { dim, task: 'a', trial: 0 }),
      ev({ l_min: 5, l_user: 10, solved: true, planning_time_ms: 2000 }, { dim, task: 'b', trial: 0, ok: false }),
      ev({ l_min: 5, l_user: 15, solved: false, planning_time_ms: 1000 }, { dim, task: 'c', trial: 0, ok: false }),
    ]
    const s = taskScores(events)
    expect(s.OTS_Execution?.score).toBeCloseTo(50, 6) // mean(1, 0.5, 0)
    // 0.8 * (1/3 solved in minimum moves) + 0.2 * (1 - 6000/30000)
    expect(s.OTS_Planning?.score).toBeCloseTo(100 * (0.8 / 3 + 0.2 * 0.8), 6)
    expect(s.OTS_Planning?.trials).toBe(3)
  })

  it('pools matrix accuracy with hop-weighted relational accuracy', () => {
    const dim = 'pattern_induction'
    const events = [
      ev({ item_id: 'm:0' }, { dim }),
      ev({ hops: 1, inverted: false }, { dim }),
      ev({ hops: 3, inverted: true }, { dim, ok: false }),
    ]
    expect(taskScores(events).FluidMatrices).toEqual({ score: 62.5, trials: 3 })
  })

  it('scores error recovery as accuracy on the trial right after an error, per task', () => {
    const dim = 'executive_function'
    const pattern = [false, true, false, false, true]
    const events = pattern.map((ok, trial) => ev({ congruent: true }, { dim, ok, trial, task: 'r' }))
    // The n-back trial 1 is wrong on one of its two streams, so trial 2 follows an error.
    const nb = (trial: number, ok: boolean, stream: string) =>
      ev({ trial_type: 'standard', rule: 'position', stream }, { trial, ok, task: 'n' })
    events.push(nb(1, true, 'position'), nb(1, false, 'symbol'), nb(2, true, 'position'), nb(2, true, 'symbol'))
    const s = taskScores(events)
    // After errors: r1 ok, r3 wrong, r4 ok, n2 ok -> 3 / 4
    expect(s.ErrorRecovery).toEqual({ score: 75, trials: 4 })
  })
})
