import { useDevicePrefs } from '../../../state/devicePrefs'
import type { Dimension, SchemaType, StroopParams, TaskPayload } from '../telemetry/types'
import fixtures from './fixtures.json'
import { toCvdSafe } from './Stroop'

type FetchFn = (url: string) => Promise<Response>

const FIXTURES = fixtures as TaskPayload[]
const SCHEMA_TYPES: readonly SchemaType[] = ['n_back', 'stroop', 'matrix', 'mental_rotation', 'relational', 'tower', 'ufov', 'mst']
const DIMENSIONS: readonly Dimension[] = [
  'working_memory',
  'pattern_induction',
  'executive_function',
  'spatial_orientation',
  'processing_speed',
  'episodic_memory',
]
// 48 so `${task_id}:${trial_index}` (trial_meta.item_id) fits the server's 64-char meta string limit.
const TASK_ID = /^[\w:.-]{1,48}$/
const UID = /^[A-Za-z0-9_-]{1,64}$/

// Envelope check only: a payload the telemetry server would reject never starts a task.
// ponytail: params is only checked to be an object; a malformed shape is caught by SkipOnError.
function validTask(x: unknown): x is TaskPayload {
  if (typeof x !== 'object' || x === null) return false
  const t = x as Record<string, unknown>
  return (
    SCHEMA_TYPES.includes(t.schema_type as SchemaType) &&
    DIMENSIONS.includes(t.dimension as Dimension) &&
    typeof t.task_id === 'string' &&
    TASK_ID.test(t.task_id) &&
    typeof t.params === 'object' &&
    t.params !== null
  )
}

// Read per call (not at module load) so tests can stubEnv; mocks are on unless explicitly 'false'.
export const usingMocks = () => import.meta.env.VITE_USE_MOCKS !== 'false'

// GET /v1/tasks/next (Member 5). In mock mode it returns the fixture for `schemaType`, else
// fixtures[seq % length]; `seq` is the caller's task counter, so in mock mode a repeated call
// (StrictMode's double effect) gets the same task. Real mode ignores `schemaType`: the generator
// decides (R2). Real mode has no such guarantee: in dev, StrictMode's double effect sends two GETs
// and the caller keeps only the second, so the server may hand out (and count) a task nobody sees.
// Note for Member 5: make /v1/tasks/next idempotent per (user, seq) or tolerate unplayed tasks.
// `inks: 'cvd_safe'` (default: Settings' "Colour-blind friendly colours") asks for the colour-blind
// friendly Stroop inks: real mode sends inks=cvd_safe, and a classic Stroop block that still comes
// back (mock mode, or a server that ignored it) is converted on the device (toCvdSafe).
export async function fetchNextTask(
  userId: string,
  seq = 0,
  opts: { schemaType?: SchemaType; fetchFn?: FetchFn; inks?: 'cvd_safe' | 'classic' } = {},
): Promise<TaskPayload> {
  const cvd = (opts.inks ?? (useDevicePrefs.getState().cvdSafe ? 'cvd_safe' : 'classic')) === 'cvd_safe'
  const inks = (task: TaskPayload): TaskPayload =>
    cvd && task.schema_type === 'stroop' ? { ...task, params: toCvdSafe(task.params as StroopParams) } : task
  if (usingMocks()) {
    const task =
      FIXTURES.find((f) => f.schema_type === opts.schemaType) ?? FIXTURES[seq % FIXTURES.length]
    if (!task) throw new Error(`no task fixture for seq ${seq}`)
    return inks(task)
  }
  const fetchFn = opts.fetchFn ?? ((url: string) => fetch(url))
  const res = await fetchFn(`/v1/tasks/next?user_id=${encodeURIComponent(userId)}${cvd ? '&inks=cvd_safe' : ''}`)
  if (!res.ok) throw new Error(`GET /v1/tasks/next failed: HTTP ${res.status}`)
  const task: unknown = await res.json()
  if (!validTask(task)) throw new Error('GET /v1/tasks/next returned an invalid task payload')
  return inks(task)
}

// crypto.randomUUID only exists in secure contexts (https, localhost); a plain-http LAN demo lacks it.
export function newId(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes)
  // ponytail: Math.random ids are predictable; only reached with no Web Crypto at all.
  else for (let k = 0; k < bytes.length; k++) bytes[k] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const UID_KEY = 'aura_uid'
// Used only when storage is unavailable, so the id is still stable for the page load.
let memoryUserId: string | null = null

// Anonymous per-browser id.
export function getUserId(): string {
  try {
    const existing = localStorage.getItem(UID_KEY)
    // A tampered or legacy value would get every telemetry event rejected, so replace it.
    if (existing && UID.test(existing)) return existing
    const id = newId()
    localStorage.setItem(UID_KEY, id)
    return id
  } catch {
    return (memoryUserId ??= newId())
  }
}

// Privacy purge: later telemetry gets a new anonymous id, unlinked from the purged one.
export function forgetUserId(): void {
  memoryUserId = null
  try {
    localStorage.removeItem(UID_KEY)
  } catch {
    // storage blocked: nothing was stored
  }
}
