import type { DifficultyLevel } from '../../../state/devicePrefs'
import type {
  FlankerParams,
  MatrixParams,
  MstParams,
  NBackParams,
  PalParams,
  Poly,
  RelationalParams,
  RotationParams,
  StopSignalParams,
  StroopParams,
  TaskPayload,
  TowerParams,
  UfovParams,
} from '../telemetry/types'
import { isValidTrial } from './Ufov'

// 1-back gentle sequence with clear rule and achievable targets
const GENTLE_1BACK_TRIALS: NBackParams['trials'] = [
  { pos: [0, 0], symbol: 'A', rule: 'position', trial_type: 'standard', answer: { position: false, symbol: false } },
  { pos: [1, 2], symbol: 'B', rule: 'position', trial_type: 'standard', answer: { position: false, symbol: false } },
  { pos: [1, 2], symbol: 'C', rule: 'position', trial_type: 'target', answer: { position: true, symbol: false } },
  { pos: [2, 0], symbol: 'D', rule: 'position', trial_type: 'standard', answer: { position: false, symbol: false } },
  { pos: [0, 1], symbol: 'A', rule: 'position', trial_type: 'standard', answer: { position: false, symbol: false } },
  { pos: [0, 1], symbol: 'B', rule: 'position', trial_type: 'target', answer: { position: true, symbol: false } },
  { pos: [1, 1], symbol: 'E', rule: 'position', trial_type: 'standard', answer: { position: false, symbol: false } },
  { pos: [2, 2], symbol: 'F', rule: 'position', trial_type: 'standard', answer: { position: false, symbol: false } },
  { pos: [2, 2], symbol: 'G', rule: 'position', trial_type: 'target', answer: { position: true, symbol: false } },
  { pos: [0, 0], symbol: 'H', rule: 'position', trial_type: 'standard', answer: { position: false, symbol: false } },
]

function normalizeEdges(edges: [number, number][]): Set<string> {
  return new Set(edges.map(([u, v]) => (u < v ? `${u}-${v}` : `${v}-${u}`)))
}

function areEdgesEqual(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false
  const setA = normalizeEdges(a)
  const setB = normalizeEdges(b)
  if (setA.size !== setB.size) return false
  for (const edge of setA) {
    if (!setB.has(edge)) return false
  }
  return true
}

function isSamePoly(a: Poly, b: Poly): boolean {
  if (a.points.length !== b.points.length) return false
  if (!areEdgesEqual(a.edges, b.edges)) return false
  for (let i = 0; i < a.points.length; i++) {
    const ptA = a.points[i]
    const ptB = b.points[i]
    if (!ptA || !ptB) return false
    const [ax, ay] = ptA
    const [bx, by] = ptB
    if (Math.abs(ax - bx) > 1e-3 || Math.abs(ay - by) > 1e-3) return false
  }
  return true
}

function isLureOf(lure: Poly, base: Poly): boolean {
  if (lure.points.length !== base.points.length) return false
  if (!areEdgesEqual(lure.edges, base.edges)) return false
  let diffs = 0
  for (let i = 0; i < lure.points.length; i++) {
    const ptL = lure.points[i]
    const ptB = base.points[i]
    if (!ptL || !ptB) return false
    const [lx, ly] = ptL
    const [bx, by] = ptB
    if (Math.abs(lx - bx) > 1e-3 || Math.abs(ly - by) > 1e-3) {
      diffs++
    }
  }
  return diffs === 1
}

function adaptMst(q: MstParams, level: DifficultyLevel): MstParams {
  const targetK = level === 'gentle' ? 2 : level === 'balanced' ? 3 : 4
  const targetEncode = targetK * 2
  const targetTest = targetK * 3

  const encodeMs =
    level === 'gentle'
      ? Math.max(2500, (q.encode_ms ?? 2000) + 500)
      : q.encode_ms ?? 2000

  // If already small enough, retain
  if (q.encode.length <= targetEncode && q.test.length <= targetTest) {
    return {
      ...q,
      encode_ms: encodeMs,
    }
  }

  const oldTest = q.test.filter((t) => t.kind === 'old')
  const lureTest = q.test.filter((t) => t.kind === 'lure')
  const newTest = q.test.filter((t) => t.kind === 'new')

  const oldBases: Poly[] = []
  const selectedOld: typeof q.test = []
  for (const t of oldTest) {
    const base = q.encode.find((e) => isSamePoly(t.item, e))
    if (base && selectedOld.length < targetK) {
      oldBases.push(base)
      selectedOld.push(t)
    }
  }

  const lureBases: Poly[] = []
  const selectedLures: typeof q.test = []
  for (const t of lureTest) {
    const base = q.encode.find((e) => isLureOf(t.item, e))
    if (base && selectedLures.length < targetK) {
      lureBases.push(base)
      selectedLures.push(t)
    }
  }

  const selectedNews = newTest.slice(0, targetK)

  if (oldBases.length === 0 && lureBases.length === 0) {
    // Fallback if matching could not find bases
    return {
      ...q,
      encode_ms: encodeMs,
      encode: q.encode.slice(0, targetEncode),
      test: q.test.slice(0, targetTest),
    }
  }

  // Interleave bases in encode: [old0, lure0, old1, lure1, ...]
  const newEncode: Poly[] = []
  const maxBases = Math.max(oldBases.length, lureBases.length)
  for (let i = 0; i < maxBases; i++) {
    const o = oldBases[i]
    const l = lureBases[i]
    if (o) newEncode.push(o)
    if (l) newEncode.push(l)
  }

  // Interleave test: [old0, new0, lure0, old1, new1, lure1, ...]
  const newTestList: typeof q.test = []
  const maxTest = Math.max(selectedOld.length, selectedLures.length, selectedNews.length)
  for (let i = 0; i < maxTest; i++) {
    const o = selectedOld[i]
    const n = selectedNews[i]
    const l = selectedLures[i]
    if (o) newTestList.push(o)
    if (n) newTestList.push(n)
    if (l) newTestList.push(l)
  }

  return {
    ...q,
    encode_ms: encodeMs,
    encode: newEncode,
    test: newTestList,
  }
}

/**
 * Adapts a task for the user's difficulty preference.
 * Defaults to 'gentle' after assessment so tasks start at an approachable level (1-back, relaxed
 * timers, shorter blocks, 2-move puzzles) before the adaptive 85% staircase gradually scales challenge.
 */
export function adaptTaskForDifficulty(task: TaskPayload, level: DifficultyLevel = 'gentle'): TaskPayload {
  const p = task.params as Record<string, unknown>

  switch (task.schema_type) {
    case 'n_back': {
      const q = p as unknown as NBackParams
      if (level === 'gentle') {
        return {
          ...task,
          params: {
            ...q,
            n: 1,
            interval_ms: Math.max(2200, (q.interval_ms ?? 2000) + 400),
            trials: GENTLE_1BACK_TRIALS,
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            interval_ms: Math.min(1600, q.interval_ms ?? 2000),
          },
        }
      }
      return task
    }

    case 'tower': {
      const q = p as unknown as TowerParams
      if (level === 'gentle') {
        // Approachable 2-move problem within capacities [3, 2, 1] without counter-intuitive traps
        return {
          ...task,
          params: {
            ...q,
            capacities: [3, 2, 1],
            start: [['R', 'G'], ['B'], []],
            goal: [['R'], ['G'], ['B']],
            l_min: 2,
            optimal_moves: [[1, 2], [0, 1]],
            counter_intuitive: [],
            time_limit_ms: Math.max(60000, q.time_limit_ms ?? 60000),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: Math.min(45000, q.time_limit_ms ?? 60000),
          },
        }
      }
      return task
    }

    case 'relational': {
      const q = p as unknown as RelationalParams
      if (level === 'gentle') {
        // Filter to 1-hop and 2-hop levels, omitting multi-hop inverted chains
        const gentleLevels = q.levels.slice(0, 2).map((lv) => lv.filter((item) => item.hops <= 2 && !item.inverted))
        const hasLevels = gentleLevels.some((lv) => lv.length > 0)
        return {
          ...task,
          params: {
            ...q,
            n_trials: Math.min(4, q.n_trials),
            time_limit_ms: Math.max(25000, (q.time_limit_ms ?? 15000) + 10000),
            levels: hasLevels ? gentleLevels : q.levels.slice(0, 2),
          },
        }
      }
      if (level === 'balanced') {
        return {
          ...task,
          params: {
            ...q,
            n_trials: Math.min(6, q.n_trials),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            n_trials: Math.min(8, q.n_trials),
            time_limit_ms: 10000,
          },
        }
      }
      return task
    }

    case 'stroop': {
      const q = p as unknown as StroopParams
      if (level === 'gentle') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: Math.max(4500, (q.time_limit_ms ?? 3000) + 1500),
            trials: q.trials.slice(0, 12),
          },
        }
      }
      if (level === 'balanced') {
        return {
          ...task,
          params: {
            ...q,
            trials: q.trials.slice(0, 24),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: 2000,
            trials: q.trials.slice(0, 32),
          },
        }
      }
      return task
    }

    case 'matrix': {
      const q = p as unknown as MatrixParams
      if (level === 'gentle') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: Math.max(45000, (q.time_limit_ms ?? 30000) + 15000),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: 20000,
          },
        }
      }
      return task
    }

    case 'mental_rotation': {
      const q = p as unknown as RotationParams
      if (level === 'gentle') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: Math.max(12000, (q.time_limit_ms ?? 7000) + 5000),
            trials: q.trials.slice(0, 4),
          },
        }
      }
      if (level === 'balanced') {
        return {
          ...task,
          params: {
            ...q,
            trials: q.trials.slice(0, 6),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: 5000,
            trials: q.trials.slice(0, 8),
          },
        }
      }
      return task
    }

    case 'ufov': {
      const q = p as unknown as UfovParams
      if (level === 'gentle') {
        const valid = q.trials.filter(isValidTrial).slice(0, 8)
        const gentle = valid.map((t) => ({
          ...t,
          distractors: t.distractors.slice(0, 2),
        }))
        return {
          ...task,
          params: {
            ...q,
            trials: gentle.length > 0 ? gentle : valid,
          },
        }
      }
      if (level === 'balanced') {
        const valid = q.trials.filter(isValidTrial).slice(0, 12)
        return {
          ...task,
          params: {
            ...q,
            trials: valid,
          },
        }
      }
      if (level === 'challenge') {
        const valid = q.trials.filter(isValidTrial).slice(0, 16)
        return {
          ...task,
          params: {
            ...q,
            trials: valid,
          },
        }
      }
      return task
    }

    case 'mst': {
      const q = p as unknown as MstParams
      return {
        ...task,
        params: adaptMst(q, level),
      }
    }

    case 'stop_signal': {
      const q = p as unknown as StopSignalParams
      if (level === 'gentle') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: Math.max(2000, (q.time_limit_ms ?? 1250) + 750),
            trials: q.trials.slice(0, 16),
          },
        }
      }
      if (level === 'balanced') {
        return {
          ...task,
          params: {
            ...q,
            trials: q.trials.slice(0, 32),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: 1000,
            trials: q.trials.slice(0, 40),
          },
        }
      }
      return task
    }

    case 'flanker': {
      const q = p as unknown as FlankerParams
      if (level === 'gentle') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: Math.max(2500, (q.time_limit_ms ?? 1700) + 800),
            trials: q.trials.slice(0, 16),
          },
        }
      }
      if (level === 'balanced') {
        return {
          ...task,
          params: {
            ...q,
            trials: q.trials.slice(0, 32),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: 1200,
            trials: q.trials.slice(0, 40),
          },
        }
      }
      return task
    }

    case 'pal': {
      const q = p as unknown as PalParams
      if (level === 'gentle') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: Math.max(30000, q.time_limit_ms ?? 20000),
            stages: q.stages.slice(0, 2),
          },
        }
      }
      if (level === 'balanced') {
        return {
          ...task,
          params: {
            ...q,
            stages: q.stages.slice(0, 3),
          },
        }
      }
      if (level === 'challenge') {
        return {
          ...task,
          params: {
            ...q,
            time_limit_ms: 20000,
            stages: q.stages.slice(0, 4),
          },
        }
      }
      return task
    }

    default:
      return task
  }
}
