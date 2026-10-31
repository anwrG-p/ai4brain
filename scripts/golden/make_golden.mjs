// Golden vectors for session scoring: events -> taskScores() -> pillarScores() -> unifiedScore(),
// computed by the frontend's own TypeScript, so the Python port (brain_twin_jepa/features.py) and
// the frontend can both be tested against one file (data/fixtures/golden_sessions.json).
//
// Regenerate (repo root; needs network once for tsx):
//   npx --yes tsx@4.19.2 scripts/golden/make_golden.mjs --frontend <frontend dir>
// Check a frontend against the committed file without writing (exit 1 on any drift > 1e-6):
//   npx --yes tsx@4.19.2 scripts/golden/make_golden.mjs --frontend <frontend dir> --check
//
// <frontend dir> holds src/features/insights/{taskScores,pillars}.ts; it defaults to ./frontend.
// The event sets below are fixed (seeded), so a regeneration only changes when the TS scorers do.
//
// The committed file was generated from wave-integration 8b8c859's frontend/src with taskScores.ts
// replaced by the R16 version (rule-stream-only n-back: ErrorRecovery reads the rule stream, and
// ruleStream keeps stream === RULE_STREAM[rule], parity -> symbol). The LF sha256 of both TS files
// is under `source`. Once R16 is merged, `--check` against frontend/ must pass unchanged.
//
// Dedupe: the server stores events at least once (the client retries a batch), so each case is
// scored after dropping repeats of (session_id, trial_meta.item_id, trial_meta.stream), first one
// kept. `dedupe()` below is that contract; brain_twin_jepa/telemetry_io.py implements the same.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const frontend = resolve(flag('--frontend', join(ROOT, 'frontend')))
const out = resolve(flag('--out', join(ROOT, 'data', 'fixtures', 'golden_sessions.json')))
const check = args.includes('--check')

const insights = join(frontend, 'src', 'features', 'insights')
if (!existsSync(join(insights, 'taskScores.ts')) || !existsSync(join(insights, 'pillars.ts'))) {
  console.error('Usage: npx --yes tsx@4.19.2 scripts/golden/make_golden.mjs [--frontend <dir>] [--out <file>] [--check]')
  console.error(`  no src/features/insights/{taskScores,pillars}.ts under ${frontend}`)
  process.exit(2)
}
const { taskScores } = await import(pathToFileURL(join(insights, 'taskScores.ts')).href)
const { pillarScores, unifiedScore } = await import(pathToFileURL(join(insights, 'pillars.ts')).href)
// LF-normalised, so a CRLF checkout hashes the same.
const sha = (f) => createHash('sha256').update(readFileSync(join(insights, f), 'utf8').replace(/\r\n/g, '\n')).digest('hex')

/** The dedupe contract (see the header). Events without item_id fall back to task_id:trial_index,
    which is how the client builds item_id. */
export function dedupe(events) {
  const seen = new Set()
  return events.filter((e) => {
    const m = e.trial_meta ?? {}
    const key = JSON.stringify([e.session_id, m.item_id ?? `${e.task_id}:${e.trial_index}`, m.stream ?? null])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---- event builders --------------------------------------------------------------------------

let rngState = 0
function seed(s) {
  rngState = s >>> 0
}
/** mulberry32: a fixed, seedable stream, so the file is stable across runs. */
function rand() {
  rngState = (rngState + 0x6d2b79f5) >>> 0
  let t = rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (xs) => xs[Math.floor(rand() * xs.length)]
const chance = (p) => rand() < p

const T0 = Date.UTC(2026, 9, 30, 9, 0, 0)
let tick = 0

function ev(session, task, index, dimension, meta, { ok = true, rt = 600 } = {}) {
  tick += 1
  return {
    user_id: 'golden_user',
    session_id: session,
    task_id: task,
    trial_index: index,
    dimension,
    score_norm: ok ? 1 : 0,
    response_time_ms: rt,
    error_flag: !ok,
    error_burst: 0,
    hesitation_jitter: 12.5,
    keystroke_latency_ms: null,
    trial_meta: { item_id: `${task}:${index}`, ...meta },
    client_ts: new Date(T0 + tick * 1500).toISOString(),
  }
}

const RULE_STREAM = { position: 'position', symbol: 'symbol', parity: 'symbol' }

/** One n-back trial: one event per stream (R16 layout). `rule` decides the scored stream; the
    other stream's event is 'lure_stream' when it matched, else 'standard'. `ok` is the rule event's
    verdict (an off-rule press makes it wrong); `offOk` the off-rule event's. */
function nbackTrial(session, task, i, { rule, type, ok = true, offOk = true, offMatch = false }) {
  const rs = RULE_STREAM[rule]
  return ['position', 'symbol'].map((s) =>
    s === rs
      ? ev(session, task, i, 'working_memory', { trial_type: type, rule, stream: s }, { ok, rt: type === 'target' && ok ? 520 : 1800 })
      : ev(session, task, i, 'working_memory', { trial_type: offMatch ? 'lure_stream' : 'standard', rule, stream: s }, { ok: offOk, rt: 1800 }),
  )
}

/** A seeded n-back run. pHit / pFa: chance of a hit on targets and of a false alarm elsewhere. */
function nbackRun(session, task, n, { pHit = 0.8, pFa = 0.15, pSwitchOk = 0.7, parity = false } = {}) {
  const rules = parity ? ['position', 'symbol', 'parity'] : ['position', 'symbol']
  let rule = 'position'
  const events = []
  for (let i = 0; i < n; i++) {
    let type
    if (i > 2 && i % 7 === 0) {
      rule = pick(rules.filter((r) => r !== rule))
      type = 'switch'
    } else type = pick(['target', 'standard', 'standard', 'lure_minus', 'lure_plus'])
    const offMatch = type !== 'switch' && chance(0.25)
    const ok = type === 'target' ? chance(pHit) : type === 'switch' ? chance(pSwitchOk) : !chance(pFa)
    events.push(...nbackTrial(session, task, i, { rule, type, ok, offOk: ok || !offMatch, offMatch }))
  }
  return events
}

const COLORS = ['red', 'green', 'blue', 'yellow']
function stroopRun(session, task, n, { pOk = 0.85, conRt = 620, incRt = 710 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const congruent = i % 3 === 0
    const ok = chance(pOk)
    const rt = Math.round((congruent ? conRt : incRt) + (rand() - 0.5) * 120)
    return ev(session, task, i, 'executive_function', { congruent, word: pick(COLORS), ink: pick(COLORS) }, { ok, rt })
  })
}

function towerRun(session, task, problems) {
  return problems.map(([l_min, l_user, solved, planning], i) => {
    const meta = { l_min, l_user, predicted_moves: l_min, conflict_latency_ms: 0, solved }
    if (planning !== undefined) meta.planning_time_ms = planning
    return ev(session, task, i, 'executive_function', meta, { ok: solved && l_user === l_min, rt: 20000 })
  })
}

function matrixRun(session, task, n, pOk) {
  return Array.from({ length: n }, (_, i) => ev(session, task, i, 'pattern_induction', {}, { ok: chance(pOk), rt: 9000 }))
}

function relationalRun(session, task, n, pOk) {
  return Array.from({ length: n }, (_, i) =>
    ev(session, task, i, 'pattern_induction', { hops: 1 + (i % 4), inverted: i % 2 === 1 }, { ok: chance(pOk), rt: 7000 }),
  )
}

function rotationRun(session, task, n, pOk) {
  return Array.from({ length: n }, (_, i) =>
    ev(session, task, i, 'spatial_orientation', { angle_deg: (i * 45) % 360, mirrored: i % 2 === 0 }, { ok: chance(pOk), rt: 2500 }),
  )
}

function mstRun(session, task, n) {
  return Array.from({ length: n }, (_, i) => {
    const kind = pick(['old', 'lure', 'new'])
    const p = { old: [0.75, 0.15, 0.05], lure: [0.2, 0.6, 0.1], new: [0.05, 0.15, 0.75] }[kind]
    const r = rand()
    const response = r < p[0] ? 'old' : r < p[0] + p[1] ? 'similar' : r < p[0] + p[1] + p[2] ? 'new' : 'none'
    const ok = { old: 'old', lure: 'similar', new: 'new' }[kind] === response
    return ev(session, task, i, 'episodic_memory', { kind, delta: kind === 'lure' ? 0.2 : 0, response }, { ok, rt: 1400 })
  })
}

function ufovRun(session, task, n, { pPeripheral = 0.7, threshold = 120.4 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const central_ok = chance(0.9)
    const peripheral_ok = chance(pPeripheral)
    const shown = pick([17, 33, 50, 83, 117, 167, 250, 500])
    const meta = { requested_ms: shown, shown_ms: shown, frames: Math.round(shown / 16.7), similarity: 0.5, mask_noise: 0.4, central_ok, peripheral_ok }
    if (i === n - 1 && threshold !== null) meta.quest_threshold_ms = threshold
    return ev(session, task, i, 'processing_speed', meta, { ok: central_ok && peripheral_ok, rt: 900 })
  })
}

// ---- cases -----------------------------------------------------------------------------------

const cases = []
function add(name, description, build, s = 1) {
  seed(s)
  tick = 0
  cases.push({ name, description, events: build() })
}

add('empty', 'No events: no inputs, every pillar null at coverage 0, unified null.', () => [])

add('nback_r16', 'R16 n-back: rule-stream d prime, switch cost, off-rule lure_stream events ignored.', () =>
  nbackRun('s_nback', 'nb1', 40), 11)

add('nback_parity', 'R16 parity rule: scored on the symbol stream (RULE_STREAM parity -> symbol).', () =>
  nbackRun('s_parity', 'nbp', 42, { parity: true }), 12)

add('nback_offrule_press_on_target', 'Target trials where an off-rule press made the rule event wrong: misses, not hit plus false alarm.', () => [
  ...nbackTrial('s_off', 'nbo', 0, { rule: 'position', type: 'standard' }),
  ...nbackTrial('s_off', 'nbo', 1, { rule: 'position', type: 'target', ok: false, offOk: false, offMatch: true }),
  ...nbackTrial('s_off', 'nbo', 2, { rule: 'position', type: 'target' }),
  ...nbackTrial('s_off', 'nbo', 3, { rule: 'position', type: 'standard' }),
  ...nbackTrial('s_off', 'nbo', 4, { rule: 'position', type: 'target', ok: false, offOk: false, offMatch: true }),
  ...nbackTrial('s_off', 'nbo', 5, { rule: 'position', type: 'lure_minus' }),
  ...nbackTrial('s_off', 'nbo', 6, { rule: 'position', type: 'target' }),
  ...nbackTrial('s_off', 'nbo', 7, { rule: 'symbol', type: 'switch' }),
  ...nbackTrial('s_off', 'nbo', 8, { rule: 'symbol', type: 'target' }),
  ...nbackTrial('s_off', 'nbo', 9, { rule: 'symbol', type: 'standard', offMatch: true }),
])

add('nback_offstream_error_only', 'Off-rule events wrong while rule events are right: ErrorRecovery reads the rule stream only (R16).', () =>
  Array.from({ length: 12 }, (_, i) =>
    nbackTrial('s_offerr', 'nbe', i, { rule: 'symbol', type: i % 3 === 0 ? 'target' : 'standard', ok: i !== 4, offOk: i % 2 === 0, offMatch: i % 2 === 1 }),
  ).flat())

add('nback_chance_nonresponder', 'Never presses: d prime floored at 0, switch cost gated to 0, task left out of ErrorRecovery.', () =>
  Array.from({ length: 20 }, (_, i) => {
    const type = i % 7 === 6 ? 'switch' : i % 4 === 0 ? 'target' : 'standard'
    return nbackTrial('s_nr', 'nbn', i, { rule: i < 7 ? 'position' : 'symbol', type, ok: type !== 'target' })
  }).flat())

add('stroop', 'Stroop RT cost on correct trials, gated by accuracy above chance; SST_SSRT proxy.', () =>
  stroopRun('s_stroop', 'st1', 36), 21)

add('stroop_at_chance', 'Stroop at exactly 1 in 4 accuracy: gate 0, so ANT_Conflict 0 although an RT cost exists.', () =>
  Array.from({ length: 16 }, (_, i) =>
    ev('s_st_ch', 'stc', i, 'executive_function', { congruent: i % 2 === 0 }, { ok: i % 4 === 0 || i === 1 ? i !== 8 : false, rt: i % 2 ? 900 : 500 }),
  ))

add('stroop_all_wrong', 'No correct Stroop trial: no cost to measure, ANT_Conflict 0 over every trial.', () =>
  Array.from({ length: 8 }, (_, i) => ev('s_st_w', 'stw', i, 'executive_function', { congruent: i % 2 === 0 }, { ok: false, rt: 800 })))

add('tower', 'Tower: execution ratio, planning share and speed, a missing planning time, an unsolved problem.', () =>
  towerRun('s_tower', 'tw1', [
    [3, 3, true, 4000],
    [4, 6, true, 9000],
    [5, 5, true],
    [5, 9, false, 15000],
    [2, 2, true, 31000],
  ]))

add('matrix_only_below_coverage', 'Matrix alone: FluidMatrices is 0.25 of focus, below the 0.3 coverage, so focus is null.', () =>
  matrixRun('s_mx', 'mx1', 10, 0.7), 31)

add('fluid_matrix_relational', 'Matrix accuracy averaged with hop-weighted relational accuracy.', () => [
  ...matrixRun('s_fluid', 'mx2', 8, 0.6),
  ...relationalRun('s_fluid', 'rl1', 12, 0.65),
], 32)

add('mst', 'MST LDI: P(similar | lure) - P(similar | new); timeouts count as not similar.', () => mstRun('s_mst', 'ms1', 40), 41)

add('ufov_two_tasks', 'UFOV: two tasks, thresholds averaged; peripheral accuracy for ANT_Orienting.', () => [
  ...ufovRun('s_ufov', 'uf1', 14, { threshold: 120.4 }),
  ...ufovRun('s_ufov', 'uf2', 14, { pPeripheral: 0.5, threshold: 233.3 }),
], 51)

add('rotation_only', 'Mental rotation feeds no pillar input, only ErrorRecovery.', () => rotationRun('s_rot', 'mr1', 16, 0.6), 61)

function fullSession(session, s) {
  seed(s)
  return [
    ...nbackRun(session, `${session}_nb`, 30),
    ...stroopRun(session, `${session}_st`, 24),
    ...rotationRun(session, `${session}_mr`, 12, 0.7),
    ...matrixRun(session, `${session}_mx`, 8, 0.6),
    ...relationalRun(session, `${session}_rl`, 10, 0.6),
    ...towerRun(session, `${session}_tw`, [
      [3, 3, true, 5000],
      [4, 5, true, 12000],
      [5, 5, true, 8000],
    ]),
    ...ufovRun(session, `${session}_uf`, 12),
    ...mstRun(session, `${session}_ms`, 30),
  ]
}

add('full_session', 'All 8 exercises in one session: every sourceable input and all five pillars.', () => fullSession('s_full', 71), 71)

add('duplicates', 'A full session with retried batches (repeated rows): every repeat is counted once.', () => {
  const events = fullSession('s_dup', 72)
  const repeats = events.filter((_, i) => i % 5 === 0).map((e) => ({ ...e, trial_meta: { ...e.trial_meta } }))
  return [...events.slice(0, 40), ...repeats.slice(0, 10), ...events.slice(40), ...repeats.slice(10)]
}, 72)

for (const s of [81, 82, 83]) {
  add(`fuzz_${s}`, 'Seeded mixed session at varied skill levels.', () => {
    const sess = `s_fz${s}`
    const skill = 0.4 + rand() * 0.55
    return [
      ...nbackRun(sess, `${sess}_nb`, 20 + Math.floor(rand() * 20), { pHit: skill, pFa: 1 - skill, pSwitchOk: skill, parity: chance(0.5) }),
      ...stroopRun(sess, `${sess}_st`, 12 + Math.floor(rand() * 20), { pOk: skill, conRt: 600, incRt: 600 + rand() * 300 }),
      ...(chance(0.7) ? mstRun(sess, `${sess}_ms`, 20) : []),
      ...(chance(0.7) ? ufovRun(sess, `${sess}_uf`, 10, { pPeripheral: skill, threshold: chance(0.8) ? 17 + rand() * 483 : null }) : []),
      ...(chance(0.6) ? towerRun(sess, `${sess}_tw`, [[3, 3 + Math.floor(rand() * 3), chance(skill), Math.round(rand() * 40000)]]) : []),
      ...(chance(0.6) ? relationalRun(sess, `${sess}_rl`, 8, skill) : []),
    ]
  }, s)
}

// ---- expected values -------------------------------------------------------------------------

const golden = {
  version: 1,
  generated_by: 'scripts/golden/make_golden.mjs',
  tolerance: 1e-6,
  dedupe_key: ['session_id', 'trial_meta.item_id', 'trial_meta.stream'],
  source: { 'taskScores.ts': sha('taskScores.ts'), 'pillars.ts': sha('pillars.ts') },
  cases: cases.map((c) => {
    const unique = dedupe(c.events)
    const inputs = taskScores(unique)
    const pillars = pillarScores(inputs)
    return { ...c, expected: { unique_events: unique.length, inputs, pillars, unified: unifiedScore(pillars) } }
  }),
}

if (check) {
  const committed = JSON.parse(readFileSync(out, 'utf8'))
  const diffs = []
  const walk = (a, b, path) => {
    if (typeof a === 'number' && typeof b === 'number') {
      if (Math.abs(a - b) > committed.tolerance) diffs.push(`${path}: ${b} != ${a}`)
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}.${k}`)
    } else if (a !== b) diffs.push(`${path}: ${JSON.stringify(b)} != ${JSON.stringify(a)}`)
  }
  committed.cases.forEach((c, i) => walk(c.expected, golden.cases[i]?.expected, c.name))
  if (diffs.length) {
    console.error(diffs.join('\n'))
    process.exit(1)
  }
  console.log(`golden: ${committed.cases.length} cases match`)
} else {
  mkdirSync(dirname(out), { recursive: true })
  // One event per line keeps the file reviewable; everything else is indented.
  const text = JSON.stringify({ ...golden, cases: '@CASES@' }, null, 2).replace(
    '"@CASES@"',
    '[\n' +
      golden.cases
        .map(({ events, ...rest }) => {
          const head = JSON.stringify(rest, null, 2).replace(/\n/g, '\n    ').slice(0, -1).trimEnd()
          const list = events.length ? `[\n        ${events.map((e) => JSON.stringify(e)).join(',\n        ')}\n      ]` : '[]'
          return `    ${head},\n      "events": ${list}\n    }`
        })
        .join(',\n') +
      '\n  ]',
  )
  JSON.parse(text) // the hand layout must still be valid JSON
  writeFileSync(out, text + '\n')
  console.log(`golden: wrote ${golden.cases.length} cases to ${out}`)
}
