import { describe, expect, it, vi } from 'vitest'
import { fetchProfile, profileToPillars, type ProfileResponse } from './profileApi'

describe('profileApi', () => {
  it('returns null in mock mode (default)', async () => {
    const profile = await fetchProfile('u1')
    expect(profile).toBeNull()
  })

  it('fetches profile in real mode', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    const mockData: ProfileResponse = {
      user_id: 'u1',
      status: 'ok',
      sessions: 4,
      min_sessions: 1,
      pillars: {
        focus: { latest: 70, uncertainty: 10, average: 65, sessions: 4 },
        agility: null,
      },
      why_this: [
        { kind: 'harder', reason: 'Made harder based on performance', at: '2026-11-01T12:00:00Z' },
      ],
    }
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(mockData), { status: 200 }))
    const res = await fetchProfile('u1', 1, fetchFn)
    expect(fetchFn).toHaveBeenCalledWith('/v1/dashboard/profile?user_id=u1&h=1')
    expect(res).toEqual(mockData)

    const pillars = profileToPillars(res!)!
    expect(pillars.focus.score).toBe(70)
    expect(pillars.focus.uncertainty).toBe(10)
    expect(pillars.agility.score).toBeNull()
    vi.unstubAllEnvs()
  })

  it('handles server error gracefully', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    const fetchFn = vi.fn(async () => new Response('error', { status: 503 }))
    const res = await fetchProfile('u1', 1, fetchFn)
    expect(res).toBeNull()
    vi.unstubAllEnvs()
  })
})

