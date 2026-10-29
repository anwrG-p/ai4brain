// Mirrors assessment_engine/api/routes/telemetry.py (TelemetryEvent) exactly.
export type Dimension =
  | 'working_memory'
  | 'pattern_induction'
  | 'executive_function'
  | 'spatial_orientation'
  | 'processing_speed'
  | 'episodic_memory'

const DIMENSIONS: ReadonlySet<string> = new Set<Dimension>([
  'working_memory',
  'pattern_induction',
  'executive_function',
  'spatial_orientation',
  'processing_speed',
  'episodic_memory',
])

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

const EVENT_KEYS: ReadonlySet<string> = new Set<keyof TelemetryEvent>([
  'user_id',
  'session_id',
  'task_id',
  'trial_index',
  'dimension',
  'score_norm',
  'response_time_ms',
  'error_flag',
  'error_burst',
  'hesitation_jitter',
  'keystroke_latency_ms',
  'trial_meta',
  'voice_opt_in',
  'voice_latency_ms',
  'vocal_pace_hz',
  'client_ts',
])

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isOptNum = (v: unknown) => v === undefined || v === null || isNum(v)

// Shape check for events read back from storage (types only; the server still checks ranges).
export function isTelemetryEvent(x: unknown): x is TelemetryEvent {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const e = x as Record<string, unknown>
  const meta = e.trial_meta
  return (
    Object.keys(e).every((k) => EVENT_KEYS.has(k)) &&
    ['user_id', 'session_id', 'task_id', 'client_ts'].every((k) => typeof e[k] === 'string') &&
    ['trial_index', 'score_norm', 'response_time_ms', 'error_burst', 'hesitation_jitter'].every((k) =>
      isNum(e[k]),
    ) &&
    typeof e.error_flag === 'boolean' &&
    typeof e.dimension === 'string' &&
    DIMENSIONS.has(e.dimension) &&
    isOptNum(e.keystroke_latency_ms) &&
    isOptNum(e.voice_latency_ms) &&
    isOptNum(e.vocal_pace_hz) &&
    (e.voice_opt_in === undefined || typeof e.voice_opt_in === 'boolean') &&
    (meta === undefined || (typeof meta === 'object' && meta !== null && !Array.isArray(meta)))
  )
}

export type SchemaType =
  | 'n_back'
  | 'stroop'
  | 'matrix'
  | 'mental_rotation'
  | 'relational'
  | 'tower'
  | 'ufov'
  | 'mst'

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
    trial_type: 'target' | 'standard' | 'lure_minus' | 'lure_plus' | 'switch'
    answer: { position?: boolean; symbol?: boolean }
  }[]
}

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
