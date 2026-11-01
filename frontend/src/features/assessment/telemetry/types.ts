import type { TaskSchemaType } from '../../../types'

// Mirrors assessment_engine/api/routes/telemetry.py (TelemetryEvent) exactly.
export type Dimension =
  | 'working_memory'
  | 'pattern_induction'
  | 'executive_function'
  | 'spatial_orientation'
  | 'processing_speed'
  | 'episodic_memory'

// `satisfies Record<Dimension, true>` makes a dimension added to the type fail to compile until listed here.
const DIMENSIONS: ReadonlySet<string> = new Set(
  Object.keys({
    working_memory: true,
    pattern_induction: true,
    executive_function: true,
    spatial_orientation: true,
    processing_speed: true,
    episodic_memory: true,
  } satisfies Record<Dimension, true>),
)

export type TrialMeta = Record<string, string | number | boolean>

export type TelemetryEvent = {
  user_id: string
  session_id: string
  task_id: string
  trial_index: number
  dimension: Dimension
  score_norm: number
  response_time_ms: number
  error_flag: boolean
  error_burst: number
  hesitation_jitter: number
  keystroke_latency_ms?: number | null
  trial_meta?: TrialMeta
  voice_opt_in?: boolean
  voice_latency_ms?: number | null
  vocal_pace_hz?: number | null
  client_ts: string // ISO 8601
}

// Same trick: a field added to TelemetryEvent fails to compile until the guard knows it.
const EVENT_KEYS: ReadonlySet<string> = new Set(
  Object.keys({
    user_id: true,
    session_id: true,
    task_id: true,
    trial_index: true,
    dimension: true,
    score_norm: true,
    response_time_ms: true,
    error_flag: true,
    error_burst: true,
    hesitation_jitter: true,
    keystroke_latency_ms: true,
    trial_meta: true,
    voice_opt_in: true,
    voice_latency_ms: true,
    vocal_pace_hz: true,
    client_ts: true,
  } satisfies Record<keyof TelemetryEvent, true>),
)

// The server's rules (allow_inf_nan=False, so every number must be finite).
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const inRange = (v: unknown, min: number, max = Infinity) => isNum(v) && v >= min && v <= max
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0
const isOptNonNeg = (v: unknown) => v === undefined || v === null || inRange(v, 0)
const ID = /^[A-Za-z0-9_-]{1,64}$/
const META_KEY = /^[a-z0-9_]{1,32}$/
// ISO 8601 as Date.toISOString writes it (offset optional); Date.parse alone accepts far more.
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/
// The server's MetaValue: a string of at most 64 chars, int, float or bool.
const isMetaValue = (v: unknown) =>
  (typeof v === 'string' && v.length <= 64) || typeof v === 'boolean' || isNum(v)
const isId = (v: unknown) => typeof v === 'string' && ID.test(v)

function isMeta(meta: unknown): boolean {
  if (meta === undefined) return true
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return false
  const entries = Object.entries(meta)
  return entries.length <= 16 && entries.every(([k, v]) => META_KEY.test(k) && isMetaValue(v))
}

// The first rule of assessment_engine/api/routes/telemetry.py that `x` breaks, or null when the
// server would accept it. Checked on push and on restore, because the server rejects a whole
// batch over one bad event.
// ponytail: JS string length counts UTF-16 units, Python counts code points, so astral characters
// make the 48/64-char checks a little stricter than the server; never looser.
export function eventProblem(x: unknown): string | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return 'not an object'
  const e = x as Record<string, unknown>
  const extra = Object.keys(e).find((k) => !EVENT_KEYS.has(k))
  if (extra !== undefined) return `unknown field ${extra}`
  if (!isId(e.user_id)) return 'user_id'
  if (!isId(e.session_id)) return 'session_id'
  if (typeof e.task_id !== 'string' || e.task_id.length < 1 || e.task_id.length > 48) return 'task_id'
  if (!isCount(e.trial_index)) return 'trial_index'
  if (typeof e.dimension !== 'string' || !DIMENSIONS.has(e.dimension)) return 'dimension'
  if (!inRange(e.score_norm, 0, 1)) return 'score_norm'
  if (!inRange(e.response_time_ms, 0, 600_000)) return 'response_time_ms'
  if (typeof e.error_flag !== 'boolean') return 'error_flag'
  if (!isCount(e.error_burst)) return 'error_burst'
  if (!inRange(e.hesitation_jitter, 0)) return 'hesitation_jitter'
  if (!isOptNonNeg(e.keystroke_latency_ms)) return 'keystroke_latency_ms'
  if (!isMeta(e.trial_meta)) return 'trial_meta'
  if (e.voice_opt_in !== undefined && typeof e.voice_opt_in !== 'boolean') return 'voice_opt_in'
  if (!isOptNonNeg(e.voice_latency_ms)) return 'voice_latency_ms'
  if (!isOptNonNeg(e.vocal_pace_hz)) return 'vocal_pace_hz'
  const hasVoice = (e.voice_latency_ms ?? null) !== null || (e.vocal_pace_hz ?? null) !== null
  if (hasVoice && e.voice_opt_in !== true) return 'voice fields require voice_opt_in'
  if (typeof e.client_ts !== 'string' || !ISO_TS.test(e.client_ts) || Number.isNaN(Date.parse(e.client_ts)))
    return 'client_ts'
  return null
}

export const isTelemetryEvent = (x: unknown): x is TelemetryEvent => eventProblem(x) === null

// One union for the whole app: the UI's registry type has the same literals.
export type SchemaType = TaskSchemaType

export type TaskPayload = {
  task_id: string
  dimension: Dimension
  schema_type: SchemaType
  params: unknown
  surface_seed: number
}

// Payload params, one per row of the contract table (contracts.md).
export type Glyph = {
  shape: 'circle' | 'square' | 'triangle' | 'diamond'
  count: 1 | 2 | 3
  color: string
  rotation_deg: number
}

export type Poly = { points: [number, number][]; edges: [number, number][] }

export type NBackParams = {
  n: number
  stimulus_ms: number
  interval_ms: number
  streams: ('position' | 'symbol')[]
  trials: {
    pos: [number, number] | null
    symbol: string | null
    rule: 'position' | 'symbol' | 'parity'
    // The trial's kind on the rule's stream (RULE_STREAM below). Under a parity rule a 'target' is a
    // trial whose symbol is even, the trial that expects L.
    trial_type: 'target' | 'standard' | 'lure_minus' | 'lure_plus' | 'switch'
    // Per-stream data: the true n-back match on each stream (parity: "the symbol is even"). Only the
    // rule's stream expects a press (R16, as the hint says); a true answer on the other stream is a lure.
    answer: { position?: boolean; symbol?: boolean }
  }[]
}

type NBackStream = NBackParams['streams'][number]
type NBackRule = NBackParams['trials'][number]['rule']

/** The stream whose key the on-screen hint names for each rule: the rule's own stream, and L (the
    symbol stream) for parity ("L = even number"). NBack.tsx scores and taskScores reads by it. */
export const NBACK_RULE_STREAM: Readonly<Record<NBackRule, NBackStream>> = {
  position: 'position',
  symbol: 'symbol',
  parity: 'symbol',
}

/* N-back events (NBack.tsx), one per stream per trial; trial_meta keys unchanged: trial_type, rule,
   stream. Meaning since R16 (scoring follows the on-screen hint):
   - Rule-stream event (stream = NBACK_RULE_STREAM[rule]): trial_type is the payload's. error_flag is
     the trial's verdict: false only when the rule key's press-or-withhold matches answer[rule stream]
     and the off-rule key was not pressed. So an off-rule press makes a noise trial a false alarm and
     a target trial a miss (never a hit plus a false alarm). response_time_ms is the rule key's press,
     else the off-rule press, else interval_ms.
   - Off-rule event: expects no press. trial_type is 'lure_stream' when that stream matched n back
     (an other-stream lure), else 'standard'; error_flag means its key was pressed.
   Before R16 every event was scored against answer[stream] and carried the payload's trial_type. */
export type NBackEventTrialType = NBackParams['trials'][number]['trial_type'] | 'lure_stream'

export type StroopParams = {
  colors: string[]
  trials: { word: string; ink: string; answer: string }[]
  time_limit_ms: number
}

export type MatrixParams = {
  cells: (Glyph | null)[] // 9 cells, exactly one null
  options: Glyph[]
  answer: number
  time_limit_ms: number
}

export type RotationParams = {
  trials: {
    cells: [number, number][]
    angle_deg: number
    mirrored: boolean
    answer: 'same' | 'different'
  }[]
  time_limit_ms: number
}

export type Relation = 'same' | 'opposite' | 'more' | 'less' | 'before' | 'after' | 'contains'
export type Statement = { a: string; rel: Relation; b: string }

export type RelationalParams = {
  n_trials: number
  time_limit_ms: number
  levels: {
    premises: Statement[]
    question: Statement
    inverted: boolean
    hops: number
    answer: boolean
  }[][]
}

export type TowerParams = {
  capacities: number[]
  start: string[][]
  goal: string[][]
  l_min: number
  optimal_moves: [number, number][]
  counter_intuitive: number[] // indices into optimal_moves
  time_limit_ms?: number // per problem, from the prediction submit; client default 60000 (TOL-F)
}

export type UfovParams = {
  duration_grid_ms: number[]
  similarity: number
  mask_noise: number
  trials: {
    central: 'A' | 'B'
    peripheral_dir: number // 0..7
    distractors: { dir: number; ring: number }[]
  }[]
}

export type MstParams = {
  encode_ms: number
  encode: Poly[]
  test: { item: Poly; kind: 'old' | 'lure' | 'new'; delta: number }[]
}

/* Stop Light (tasks/StopSignal.tsx): a two-choice go task (left/right arrow) with a stop signal on
   some trials, shown after a stop-signal delay (SSD). A one-up/one-down staircase moves the SSD by
   `ssd_step_ms`: later after a stop, earlier after a failed stop (Verbruggen et al. 2019, eLife
   8:e46323, the consensus guide). The go window is `time_limit_ms`: a go trial with no press is an
   omission, a stop trial with no press a successful stop. One event per trial, trial_meta
   { stop_trial, dir, response: 'left' | 'right' | 'none', ssd_ms (stop trials only) }; `stop_trial`
   is the signature schemaOf reads. Trial count and stop share: SST_DESIGN in StopSignal.tsx. */
export type StopSignalParams = {
  time_limit_ms: number
  fixation_ms: number // the cross before every arrow
  ssd_start_ms: number
  ssd_step_ms: number
  trials: { dir: 'left' | 'right'; stop: boolean }[]
}

/* Pair Finder (tasks/PairedAssociates.tsx): paired-associates learning, simplified from CANTAB PAL.
   Each stage shows its patterns one by one in their boxes (`study_ms` each), then shows each pattern
   in `recall` order and asks for its box. A stage with any wrong box is studied and recalled again,
   up to `max_attempts`; failing the last attempt ends the task (later stages are not reached). One
   event per recall choice, trial_meta { pal_level (patterns in the stage), attempt (1-based),
   pattern, box, chosen (-1 on a timeout), pal_total (patterns over all stages), boxes };
   `pal_level` is the signature schemaOf reads. Stage sizes: PAL_DESIGN in PairedAssociates.tsx. */
export type PalParams = {
  boxes: number
  study_ms: number
  time_limit_ms: number // per recall choice
  max_attempts: number
  stages: {
    items: { pattern: number; box: number }[] // in study order; pattern 0..7, box 0..boxes-1
    recall: number[] // indices into items, the recall order
  }[]
}

/* Arrow Focus (tasks/Flanker.tsx): the arrow flanker task (Eriksen & Eriksen 1974), as in the ANT's
   flanker part (Fan et al. 2002). Five arrows; answer the middle one (left/right). Congruent: the
   four flankers point the same way; incongruent: the other way. A cross (`fixation_ms`) before each
   trial; the arrows stay up to `time_limit_ms`. One event per trial, trial_meta { flanker:
   'congruent' | 'incongruent', dir, response: 'left' | 'right' | 'none' }; `flanker` is the
   signature schemaOf reads (never Stroop's `congruent`). Trial counts: FLANKER_DESIGN in Flanker.tsx. */
export type FlankerParams = {
  time_limit_ms: number
  fixation_ms: number
  trials: { dir: 'left' | 'right'; congruent: boolean }[]
}
