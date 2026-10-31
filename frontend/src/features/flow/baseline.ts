import { usingMocks } from '../assessment/tasks/taskSource'
import { isValidTrial } from '../assessment/tasks/Ufov'
import type { MstParams, NBackParams, SchemaType, TaskPayload, UfovParams } from '../assessment/telemetry/types'

/** The five baseline exercises, in order (spec IA): Logic Web, Memory Gauntlet, Strategic Blueprint,
    Perceptual Radar, Precision Archive. */
export const BASELINE_SCHEMAS: readonly SchemaType[] = ['relational', 'n_back', 'tower', 'ufov', 'mst']

/** Test hook (e2e): `?fast=1` shortens every baseline exercise so a full run takes seconds. Mock
    tasks only, so it can never touch a real task from the server (VITE_USE_MOCKS=false). */
export function isFastRun(search: string): boolean {
  return usingMocks() && new URLSearchParams(search).get('fast') === '1'
}

/** Fewer trials and short time limits; trials still run and record real events. Tower needs a
    prediction before its limit starts, and UFOV and the MST test wait for answers, so a fast run
    still answers those (see e2e/flow.spec.ts). */
export function fastTask(task: TaskPayload): TaskPayload {
  const p = task.params as Record<string, unknown>
  switch (task.schema_type) {
    case 'relational':
      return { ...task, params: { ...p, n_trials: 2, time_limit_ms: 800 } }
    case 'n_back': {
      const q = p as unknown as NBackParams
      return { ...task, params: { ...q, stimulus_ms: 100, interval_ms: 300, trials: q.trials.slice(0, 6) } }
    }
    case 'tower':
      return { ...task, params: { ...p, time_limit_ms: 500 } }
    case 'ufov': {
      const q = p as unknown as UfovParams
      return { ...task, params: { ...q, trials: q.trials.filter(isValidTrial).slice(0, 1) } }
    }
    case 'mst': {
      const q = p as unknown as MstParams
      return { ...task, params: { ...q, encode_ms: 200, test: q.test.slice(0, 2) } }
    }
    default:
      return task
  }
}
