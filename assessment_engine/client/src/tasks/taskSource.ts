import type { TaskPayload } from '../telemetry/types'
import fixtures from './fixtures.json'

type FetchFn = (url: string) => Promise<Response>

let mockIndex = 0

// GET /v1/tasks/next (Member 5). With VITE_MOCK_TASKS=1 it cycles through local fixtures instead.
export async function fetchNextTask(
  userId: string,
  fetchFn: FetchFn = (url) => fetch(url),
  mock = import.meta.env.VITE_MOCK_TASKS === '1',
): Promise<TaskPayload> {
  if (mock) {
    const task = fixtures[mockIndex % fixtures.length] as TaskPayload
    mockIndex++
    return task
  }
  const res = await fetchFn(`/v1/tasks/next?user_id=${encodeURIComponent(userId)}`)
  if (!res.ok) throw new Error(`GET /v1/tasks/next failed: HTTP ${res.status}`)
  // ponytail: payload shape is trusted as-is; add runtime validation if Member 5's API drifts.
  return (await res.json()) as TaskPayload
}

// Anonymous per-browser id. A fresh one per call if storage is unavailable.
export function getUserId(): string {
  try {
    const existing = localStorage.getItem('aura_uid')
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem('aura_uid', id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}
