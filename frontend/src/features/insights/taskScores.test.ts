import { describe, expect, it } from 'vitest'
import type { Dimension, TelemetryEvent, TrialMeta } from '../assessment/telemetry/types'
import { pillarScores } from './pillars'
import { dPrime, ezDiffusionBoundary, isLowEffort, ldi, probit, schemaOf, taskScores } from './taskScores'

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

  it("scores the n-back switch cost against the rule stream's noise trials, counting trials", () => {
    const rule = 'symbol'
    const nb = (trial_type: string, ok: boolean, stream = rule) => ev({ trial_type, rule, stream }, { ok })
    const events = [
      ...repeat(10, (k) => nb('target', k < 9)),
      ...repeat(30, (k) => nb(k % 2 ? 'standard' : 'lure_plus', k !== 0)),
      ...repeat(4, (k) => nb('switch', k !== 0)),
      // The other stream is ignored, even when it is wrong.
      ...repeat(20, () => nb('standard', false, 'position')),
    ]
    // cost = 29/30 - 3/4; 0 -> 100, 0.5 -> 0; d' > 1 so the engagement gate is open
    const s = taskScores(events).DCCS_SwitchCost
    expect(s?.score).toBeCloseTo(100 * (1 - (29 / 30 - 0.75) / 0.5), 6)
    expect(s?.trials).toBe(34)
  })

  it("counts a press on an other-stream match (a lure for the rule) as a false alarm in d' and the switch cost", () => {
    // R16, as NBack logs it: rule symbol; on 5 noise trials and 1 switch trial the place matched 2 back and
    // A was pressed. The rule event carries the false alarm; the position event is the lure itself.
    const rule = 'symbol'
    const trial = (trial_type: string, ok: boolean, lure = false) => {
      const trialIndex = seq++
      return [
        ev({ trial_type: lure ? 'lure_stream' : 'standard', rule, stream: 'position' }, { ok: !lure || ok, trial: trialIndex }),
        ev({ trial_type, rule, stream: rule }, { ok, trial: trialIndex }),
      ]
    }
    const events = [
      ...repeat(10, (k) => trial('target', k < 9)).flat(),
      ...repeat(25, () => trial('standard', true)).flat(),
      ...repeat(5, () => trial('standard', false, true)).flat(), // pressed A on a place match
      ...repeat(3, () => trial('switch', true, true)).flat(), // withheld on a place match
      ...trial('switch', false, true), // pressed A on a place match
    ]
    const s = taskScores(events)
    expect(s.OSPAN?.trials).toBe(40)
    expect(s.OSPAN?.score).toBeCloseTo((100 * dPrime(9, 10, 5, 30)) / 4, 6)
    expect(s.DCCS_SwitchCost?.score).toBeCloseTo(100 * (1 - (25 / 30 - 3 / 4) / 0.5), 6)
  })

  it('scores parity-rule trials on the symbol stream (L = even), not on the position stream', () => {
    const rule = 'parity'
    const trial = (trial_type: string, ok: boolean, posOk = true) => {
      const t = seq++
      return [
        ev({ trial_type: 'standard', rule, stream: 'position' }, { ok: posOk, trial: t }),
        ev({ trial_type, rule, stream: 'symbol' }, { ok, trial: t }),
      ]
    }
    const events = [
      ...repeat(10, (k) => trial('target', k < 8)).flat(),
      ...repeat(30, (k) => trial('standard', k >= 3, k >= 3)).flat(), // 3 false alarms, each an A press
    ]
    const s = taskScores(events)
    expect(s.OSPAN?.trials).toBe(40)
    expect(s.OSPAN?.score).toBeCloseTo(25 * dPrime(8, 10, 3, 30), 6)
  })

  it("leaves switch trials out of d'", () => {
    const rule = 'position'
    const base = [
      ...repeat(10, (k) => ev({ trial_type: 'target', rule, stream: rule }, { ok: k < 9 })),
      ...repeat(30, (k) => ev({ trial_type: 'standard', rule, stream: rule }, { ok: k !== 0 })),
    ]
    const withSwitches = [...base, ...repeat(6, () => ev({ trial_type: 'switch', rule, stream: rule }, { ok: false }))]
    expect(taskScores(withSwitches).OSPAN).toEqual(taskScores(base).OSPAN)
  })

  it("floors d' at 0 when the hit rate is not above the false-alarm rate", () => {
    const rule = 'position'
    // A non-responder: misses every target, "correct" on every noise trial.
    const silent = [
      ...repeat(10, () => ev({ trial_type: 'target', rule, stream: rule }, { ok: false })),
      ...repeat(30, () => ev({ trial_type: 'standard', rule, stream: rule })),
    ]
    expect(taskScores(silent).OSPAN?.score).toBe(0)
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
    // cost = 700 - 550 = 150 ms; 0 ms -> 100, 300 ms -> 0; times the accuracy gate (4/5 - 0.25) / 0.75
    expect(s.ANT_Conflict?.score).toBeCloseTo(50 * (0.8 - 0.25) / 0.75, 6)
    expect(s.ANT_Conflict?.trials).toBe(4)
    expect(s.SST_SSRT?.score).toBeCloseTo(200 / 3, 6)
    expect(s.SST_SSRT).toMatchObject({ trials: 3, proxy: true })
  })

  it('caps a negative Stroop cost at 100 before the accuracy gate', () => {
    const dim = 'executive_function'
    // Incongruent faster than congruent (cost -300 ms): the RT term is 1 at most, so the gate still
    // scales it: (4/5 - 0.25) / 0.75 x 100, never 1 - (-300 / 300) = 2 times the gate.
    const events = [
      ev({ congruent: true }, { dim, rt: 900 }),
      ev({ congruent: true }, { dim, rt: 900 }),
      ev({ congruent: false }, { dim, rt: 600 }),
      ev({ congruent: false }, { dim, rt: 600 }),
      ev({ congruent: false }, { dim, rt: 2000, ok: false }),
    ]
    expect(taskScores(events).ANT_Conflict?.score).toBeCloseTo((100 * (0.8 - 0.25)) / 0.75, 6)
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
    // N-back reads the rule stream only (R16): trial 1 is wrong only off-rule (symbol), so it is not an
    // error; trial 3 is wrong on the rule stream (position), so trial 4 follows an error.
    const nb = (trial: number, ok: boolean, stream: string) =>
      ev({ trial_type: 'standard', rule: 'position', stream }, { trial, ok, task: 'n' })
    events.push(
      ...[nb(1, true, 'position'), nb(1, false, 'symbol'), nb(2, true, 'position'), nb(2, true, 'symbol')],
      ...[nb(3, false, 'position'), nb(3, false, 'symbol'), nb(4, true, 'position'), nb(4, true, 'symbol')],
    )
    const s = taskScores(events)
    // After errors: r1 ok, r3 wrong, r4 ok, n4 ok -> 3 / 4
    expect(s.ErrorRecovery).toEqual({ score: 75, trials: 4 })
  })
})

describe('Mental Agility does not reward doing nothing', () => {
  // One task per exercise, trials in order, so ErrorRecovery sees real sequences.
  function session(o: {
    nback: (kind: 'target' | 'noise' | 'switch', j: number) => boolean // j counts within the kind
    stroop: (congruent: boolean, k: number) => { ok: boolean; rt: number }
  }) {
    const rule = 'position'
    const kinds = repeat(48, (k) => (k % 4 === 2 ? 'target' : k % 8 === 5 ? 'switch' : 'noise') as 'target' | 'noise' | 'switch')
    const seen = { target: 0, noise: 0, switch: 0 }
    const nb = kinds.map((kind, trial) =>
      ev({ trial_type: kind === 'noise' ? 'standard' : kind, rule, stream: rule }, { ok: o.nback(kind, seen[kind]++), trial, task: 'nb' }),
    )
    const st = repeat(40, (trial) => {
      const congruent = trial % 2 === 0
      const r = o.stroop(congruent, trial)
      return ev({ congruent }, { dim: 'executive_function', ok: r.ok, rt: r.rt, trial, task: 'st' })
    })
    return pillarScores(taskScores([...nb, ...st])).agility
  }

  it('gives a non-responder a low score', () => {
    const agility = session({
      nback: (kind) => kind !== 'target', // never presses
      stroop: () => ({ ok: false, rt: 3000 }), // every trial times out
    })
    expect(agility.score ?? 0).toBeLessThan(10)
  })

  it('gives a random presser a low score', () => {
    const agility = session({
      nback: (_kind, j) => j % 2 === 0, // presses on every other trial of each kind: hit rate = FA rate
      stroop: (_c, k) => ({ ok: k % 4 === 0, rt: 450 }), // 1 in 4 by chance, same speed both ways
    })
    expect(agility.score ?? 0).toBeLessThan(10)
  })

  it('gives an engaged user with a realistic effect a mid-range score', () => {
    const agility = session({
      nback: (kind, j) => (kind === 'switch' ? j % 3 !== 0 : j % 13 !== 12),
      stroop: (congruent, k) => ({ ok: k % 17 !== 0, rt: congruent ? 600 : 700 }),
    })
    expect(agility.score).toBeGreaterThan(40)
    expect(agility.score).toBeLessThan(85)
  })
})

describe('isLowEffort', () => {
  it('does not flag normal engaged runs', () => {
    const normal = Array.from({ length: 10 }, (_, k) =>
      ev({ congruent: k % 2 === 0, response: k % 2 === 0 ? 'left' : 'right' }, { ok: true, rt: 450 + k * 10, dim: 'executive_function' })
    )
    expect(isLowEffort(normal)).toBe(false)
  })

  it('flags runs with implausibly fast reaction times (<150ms)', () => {
    const tooFast = Array.from({ length: 10 }, () =>
      ev({ congruent: true, response: 'red' }, { ok: true, rt: 90, dim: 'executive_function' })
    )
    expect(isLowEffort(tooFast)).toBe(true)
  })

  it('flags runs with high timeout rates (>50%)', () => {
    const timeouts = Array.from({ length: 10 }, (_, k) =>
      ev({ congruent: true, response: k < 6 ? 'none' : 'blue' }, { ok: k >= 6, rt: k < 6 ? 5000 : 600, dim: 'executive_function' })
    )
    expect(isLowEffort(timeouts)).toBe(true)
  })

  it('flags runs with repetitive button mashing (>90% same response)', () => {
    const repetitive = Array.from({ length: 10 }, () =>
      ev({ flanker: 'congruent', response: 'left' }, { ok: true, rt: 400, dim: 'executive_function' })
    )
    expect(isLowEffort(repetitive)).toBe(true)
  })
})

describe('ezDiffusionBoundary', () => {
  it('returns boundary separation a for 2AFC speeded trials', () => {
    const trials = Array.from({ length: 20 }, (_, k) =>
      ev({ flanker: 'congruent', response: 'left' }, { ok: k < 18, rt: 500 + (k % 4) * 40, dim: 'executive_function' })
    )
    const a = ezDiffusionBoundary(trials)
    expect(a).not.toBeNull()
    expect(a!).toBeGreaterThan(0.05)
    expect(a!).toBeLessThan(0.35)
  })

  it('returns higher caution boundary for slower and more accurate responding', () => {
    const cautious = Array.from({ length: 20 }, (_, k) =>
      ev({ flanker: 'congruent', response: 'left' }, { ok: true, rt: 800 + (k % 5) * 60, dim: 'executive_function' })
    )
    const hurried = Array.from({ length: 20 }, (_, k) =>
      ev({ flanker: 'congruent', response: 'left' }, { ok: k < 14, rt: 350 + (k % 3) * 20, dim: 'executive_function' })
    )
    const aCautious = ezDiffusionBoundary(cautious)!
    const aHurried = ezDiffusionBoundary(hurried)!
    expect(aCautious).toBeGreaterThan(aHurried)
  })
})
