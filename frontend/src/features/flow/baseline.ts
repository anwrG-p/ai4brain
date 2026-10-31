import { usingMocks } from '../assessment/tasks/taskSource'
import { isValidTrial } from '../assessment/tasks/Ufov'
import type { MstParams, NBackParams, SchemaType, StroopParams, TaskPayload, UfovParams } from '../assessment/telemetry/types'

/** The six baseline exercises, in order: Logic Web, Memory Gauntlet, Color Clash, Strategic
    Blueprint, Perceptual Radar, Precision Archive. Color Clash gives Impulse Control a first score
    (user decision in ticket 07c; ticket 07's brief listed five). It sits 3rd (controller ruling), so
    the two fast visual tasks, Color Clash and Perceptual Radar, are apart. */
export const BASELINE_SCHEMAS: readonly SchemaType[] = ['relational', 'n_back', 'stroop', 'tower', 'ufov', 'mst']

/** Test hook (e2e): `?fast=1` shortens every baseline exercise so a full run takes seconds. It needs
    all three: the query, mock tasks (so it never touches a real task from the server,
    VITE_USE_MOCKS=false) and a test build: Vitest (MODE "test") or a build made with VITE_E2E=1,
    which only Playwright's webServer does (playwright.config.ts, into the sibling folder dist-e2e,
    never dist, so a deploy of dist cannot ship it). A normal build ignores the query. */
export function isFastRun(search: string): boolean {
  const testBuild = import.meta.env.VITE_E2E === '1' || import.meta.env.MODE === 'test'
  return testBuild && usingMocks() && new URLSearchParams(search).get('fast') === '1'
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
    case 'stroop': {
      const q = p as unknown as StroopParams
      return { ...task, params: { ...q, time_limit_ms: 800, trials: q.trials.slice(0, 3) } }
    }
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
