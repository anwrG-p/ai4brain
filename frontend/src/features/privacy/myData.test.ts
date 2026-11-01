import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { deleteMyData, downloadServerData } from './myData'
import { tracker } from '../assessment/telemetry/tracker'

describe('myData server privacy operations', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    localStorage.setItem('aura_uid', 'test-user-123')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('deleteMyData triggers server-side deletion when mocks are disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"telemetry_removed": 1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteMyData()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/user/telemetry?user_id=test-user-123'),
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(tracker.getStatus().consent).toBe('pending')
  })

  it('downloadServerData fetches /v1/user/export', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"user_id": "test-user-123"}\n', {
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const success = await downloadServerData('test-user-123')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/user/export?user_id=test-user-123'),
    )
    expect(success).toBe(true)
  })
})

