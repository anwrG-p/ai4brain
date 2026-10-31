import { afterEach, describe, expect, it, vi } from 'vitest'
import fixtures from '../assessment/tasks/fixtures.json'
import { trialCount } from '../assessment/exercises'
import type { TaskPayload } from '../assessment/telemetry/types'
import { BASELINE_SCHEMAS, fastTask, isFastRun } from './baseline'

const fixture = (s: string) => (fixtures as TaskPayload[]).find((t) => t.schema_type === s)!

afterEach(() => vi.unstubAllEnvs())

describe('the ?fast=1 test hook', () => {
  it('is on only with ?fast=1 and mock tasks', () => {
    expect(isFastRun('?fast=1')).toBe(true)
    expect(isFastRun('')).toBe(false)
    expect(isFastRun('?fast=0')).toBe(false)
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    expect(isFastRun('?fast=1')).toBe(false)
  })

  it('needs a test build too: off in a normal build with mocks, on in an e2e build (VITE_E2E=1)', () => {
    vi.stubEnv('MODE', 'production')
    expect(isFastRun('?fast=1')).toBe(false)
    vi.stubEnv('VITE_E2E', '1')
    expect(isFastRun('?fast=1')).toBe(true)
    vi.stubEnv('VITE_USE_MOCKS', 'false') // never against the real server, even in an e2e build
    expect(isFastRun('?fast=1')).toBe(false)
  })

  it('shortens every baseline exercise and keeps at least one trial', () => {
    for (const s of BASELINE_SCHEMAS) {
      const full = fixture(s)
      const fast = fastTask(full)
      expect(fast.task_id).toBe(full.task_id)
      expect(trialCount(fast)).toBeGreaterThan(0)
      expect(trialCount(fast)).toBeLessThanOrEqual(trialCount(full))
    }
    expect(fastTask(fixture('tower')).params).toMatchObject({ time_limit_ms: 500 })
    expect(fastTask(fixture('relational')).params).toMatchObject({ n_trials: 2, time_limit_ms: 800 })
    expect(fastTask(fixture('stroop')).params).toMatchObject({ time_limit_ms: 800 })
  })

  it('has six exercises, Color Clash 4th (Impulse Control gets a first score)', () => {
    expect(BASELINE_SCHEMAS).toEqual(['relational', 'n_back', 'tower', 'stroop', 'ufov', 'mst'])
  })

  it('leaves other exercises alone', () => {
    const matrix = fixture('matrix')
    expect(fastTask(matrix)).toBe(matrix)
  })
})
