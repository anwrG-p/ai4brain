import { getUserId, usingMocks } from '../assessment/tasks/taskSource'
import type { PillarId, PillarScore } from './pillars'
import { PILLAR_IDS } from './pillars'

export type ServerPillarData = {
  latest: number
  uncertainty: number
  average: number
  sessions: number
}

export type WhyThisDecision = {
  kind: 'harder' | 'easier' | 'style'
  reason: string
  at: string
}

export type ProfileResponse = {
  user_id: string
  status: 'ok' | 'not_enough_data'
  sessions: number
  min_sessions: number
  pillars?: Partial<Record<PillarId, ServerPillarData | null>>
  archetype?: { name: string; confidence: number; model_id: string } | null
  archetype_reason?: string | null
  forecast?: { status: string; validated: boolean; mode: string; [key: string]: unknown } | null
  forecast_reason?: string | null
  collaboration?: { status: string } | null
  why_this?: WhyThisDecision[]
}

export async function fetchProfile(
  userId = getUserId(),
  h = 1,
  fetchFn: (url: string) => Promise<Response> = fetch,
): Promise<ProfileResponse | null> {
  if (usingMocks()) return null
  try {
    const res = await fetchFn(`/v1/dashboard/profile?user_id=${encodeURIComponent(userId)}&h=${h}`)
    if (!res.ok) return null
    return (await res.json()) as ProfileResponse
  } catch {
    return null
  }
}

export function profileToPillars(profile: ProfileResponse): Record<PillarId, PillarScore> | null {
  if (profile.status !== 'ok' || !profile.pillars) return null
  const out = {} as Record<PillarId, PillarScore>
  for (const id of PILLAR_IDS) {
    const p = profile.pillars[id]
    if (p) {
      out[id] = { score: p.latest, uncertainty: p.uncertainty, coverage: 1, proxies: [] }
    } else {
      out[id] = { score: null, uncertainty: 50, coverage: 0, proxies: [] }
    }
  }
  return out
}
