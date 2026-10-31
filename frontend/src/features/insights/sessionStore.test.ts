import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSessions, MAX_SESSIONS, SESSIONS_KEY, useSessionStore, type SessionRecord } from './sessionStore'

const record = (id: string, score = 60): SessionRecord => ({
  id,
  at: '2026-10-31T10:00:00.000Z',
  inputs: { MST_LDI: { score, trials: 20 }, SST_SSRT: { score: 70, trials: 12, proxy: true } },
})

afterEach(() => {
  vi.restoreAllMocks()
  useSessionStore.getState().clearSessions()
  localStorage.clear()
})

describe('session store', () => {
  it('round-trips through localStorage with a version', () => {
    useSessionStore.getState().addSession(record('a'))
    useSessionStore.getState().addSession(record('b', 65))
    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(JSON.parse(localStorage.getItem(SESSIONS_KEY)!)).toMatchObject({ version: 1 })
    expect(loadSessions()).toEqual([record('a'), record('b', 65)])
  })

  it('replaces a session saved twice under the same id', () => {
    useSessionStore.getState().addSession(record('a', 10))
    useSessionStore.getState().addSession(record('a', 20))
    expect(loadSessions()).toEqual([record('a', 20)])
  })

  it('ignores corrupt or foreign data', () => {
    for (const raw of ['{not json', '[]', 'null', '{"version":2,"sessions":[]}', '{"version":1,"sessions":{}}']) {
      localStorage.setItem(SESSIONS_KEY, raw)
      expect(loadSessions()).toEqual([])
    }
  })

  it('drops bad records and bad inputs one by one', () => {
    localStorage.setItem(
      SESSIONS_KEY,
      JSON.stringify({
        version: 1,
        sessions: [
          record('ok'),
          { id: 'no-date', at: 'yesterday', inputs: {} },
          { id: 7, at: '2026-10-31T10:00:00Z', inputs: {} },
          'junk',
          {
            id: 'mixed',
            at: '2026-10-30T10:00:00Z',
            inputs: {
              OSPAN: { score: 50, trials: 10 },
              Bogus: { score: 50, trials: 10 },
              UFOV_SOA: { score: 150, trials: 10 },
              MST_LDI: { score: 40, trials: -1 },
              FluidMatrices: { score: 40, trials: 2, proxy: 'yes' },
            },
          },
        ],
      }),
    )
    expect(loadSessions()).toEqual([
      record('ok'),
      { id: 'mixed', at: '2026-10-30T10:00:00Z', inputs: { OSPAN: { score: 50, trials: 10 } } },
    ])
  })

  it(`keeps the newest ${MAX_SESSIONS} sessions`, () => {
    for (let k = 0; k < MAX_SESSIONS + 3; k++) useSessionStore.getState().addSession(record(`s${k}`))
    const ids = loadSessions().map((s) => s.id)
    expect(ids).toHaveLength(MAX_SESSIONS)
    expect(ids[0]).toBe('s3')
  })

  it('still works for the visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    useSessionStore.getState().addSession(record('a'))
    expect(useSessionStore.getState().sessions).toHaveLength(1)
  })

  it('is empty after clear', () => {
    useSessionStore.getState().addSession(record('a'))
    useSessionStore.getState().clearSessions()
    expect(useSessionStore.getState().sessions).toEqual([])
    expect(localStorage.getItem(SESSIONS_KEY)).toBeNull()
    expect(loadSessions()).toEqual([])
  })
})
