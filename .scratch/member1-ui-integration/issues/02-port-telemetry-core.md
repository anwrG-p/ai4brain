# 02: Port the telemetry core and adaptive engines; add Tracker extras

Status: ready-for-agent
Blocked by: 01
Spec: `../spec.md` (D2, D3, Constraints)

## Goal

Create `frontend/src/features/assessment/` with the non-UI core. It must compile under the frontend's TS config (`noUncheckedIndexedAccess`) and pass its lint scripts.

## Files

Copy from `assessment_engine/client/src/`, then adapt:

| Source | Destination |
|---|---|
| `telemetry/{types,metrics,tracker,useInputCapture,useTimedTrials}.ts` | `frontend/src/features/assessment/telemetry/` |
| `adaptive/{staircase,quest}.ts` | `frontend/src/features/assessment/adaptive/` |
| `tasks/frames.ts` | `frontend/src/features/assessment/tasks/frames.ts` |

Port their `*.test.ts` files alongside. Vitest 3 with `globals: true` works; keep the explicit imports.

**Voice (D1):**
- Strip the voice probe argument and plumbing from `useTimedTrials`.
- Keep the `voice` field on `TrialRecorder.finish`. It never fires, because `voice_opt_in` is always `false`.
- Do not port `voice/`.

## Tracker extras (D3)

These are new on `Tracker`; everything existing stays:

- `subscribe(listener: () => void): () => void`. Notify on push, flush result, online/offline change and clear.
- `getStatus(): { isOnline: boolean; queuedCount: number; droppedCount: number; maxCapacity: number }`. Same shape as the old `telemetryQueue.getStatus()`, so `AppShell` can switch over unchanged.
- `clear(): number`. Empties the buffer and the persisted copy, resets `droppedCount`, and returns how many were cleared.
- **Persistence:**
  - Mirror the buffer to `localStorage['synapsetwin_telemetry_queue_v2']` (try/catch on every access) and restore it in the constructor.
  - Restored events go through the same path as new ones.
  - Use a new key so old-shape events from `telemetryQueue` are never resent. Remove the old key `synapsetwin_telemetry_queue` once on init.
- **`online`/`offline` listeners:** update `isOnline`, and flush on `online`. `destroy()` removes them.
- `droppedCount` increments on overflow and on a dropped 4xx batch.
- **Events subscription for the page table:** `onEvent(listener: (e: TelemetryEvent) => void): () => void`. Called on every `push`.

## Type fixes

- Fix all `noUncheckedIndexedAccess` errors without `!` assertions where a real guard is cheap. Inside tight numeric loops with proven bounds (`quest.ts`), a local `?? 0` is acceptable.
- No `any`.

## Tests (write first)

Existing tracker, metrics, staircase, quest, frames and useInputCapture tests port unchanged in meaning. Add:

- **Persistence:** push 2 events while offline (`fetchFn` rejects), create a new `Tracker` with the same storage stub, and its `getStatus().queuedCount === 2`. If storage throws, nothing crashes.
- **Subscribe/getStatus:** a listener is called after `push` and after `clear`. `clear()` returns 2, then `queuedCount` is 0 and storage is empty.
- **Offline/online:** dispatching `offline` makes `isOnline` false; dispatching `online` triggers a flush.
- **Old queue key:** it is removed on init.
- **onEvent:** it receives each pushed event.

## Done when

From `frontend/`: `npx vitest run src/features/assessment`, `npm run typecheck`, `npm run lint:tokens` and `npm run lint:copy` are all clean. Commit with no AI attribution.
