# 03: Replace the UI telemetry queue with the Tracker

Status: resolved
Blocked by: 02
Spec: `../spec.md` (D3, R5)

## Goal

One telemetry path in the app. The offline banner and the privacy purge use the real Tracker.

## Changes

- `components/layout/AppShell.tsx`: import `tracker` from `features/assessment/telemetry/tracker` instead of `telemetryQueue`. `getStatus` and `subscribe` have the same shape, so nothing else changes.
- `pages/PrivacyPage.tsx` `handleConfirmPurge`: call `tracker.clear()` alongside `resetDemoState()`. Do **not** call `deleteUserTelemetry`, because the route doesn't exist yet. Add a one-line code comment that server-side deletion is Member 4's route.
- Delete `services/telemetry/telemetryQueue.ts` and its export in `services/index.ts`. Grep for other imports first; the map found only these two.
- Leave `services/api/apiClient.ts` as it is. Its telemetry and task functions are unused, and it belongs to the UI team. List it in the ticket comments as dead code for the UI owner.

## Tests

- **AppShell** (existing or new test): with `tracker` offline and 3 queued events, the banner text contains "3".
- **PrivacyPage:** confirming the purge calls `tracker.clear` (spy).

## Done when

From `frontend/`, `npm run qa:checks` is green. Commit with no AI attribution.

## Comments

- **Dead code for the UI owner:** `frontend/src/services/api/apiClient.ts` still has `postTelemetryEvent`, `getNextTask` and `deleteUserTelemetry`. Nothing in the app calls them now: telemetry goes through `features/assessment/telemetry/tracker`, and the purge only clears the local Tracker until Member 4's delete route exists. They were left in place as this ticket asked, and the UI team can remove them.

- 2026-10-31 (TD-03 tracker hygiene): Done in ec76596..f6179ac, review clean (member1-ui-integration ledger).
