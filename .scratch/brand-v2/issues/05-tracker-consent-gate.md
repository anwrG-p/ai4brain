# 05: Tracker consent gate (hold until accept)

Status: resolved
Blocked by: —
Spec: `../spec.md` (R3, U4)

## Changes (`frontend/src/features/assessment/telemetry/tracker.ts`)

- **Consent states:** `consent: 'pending' | 'granted' | 'denied'`.
  - Persisted in `localStorage['synapsetwin_consent_v1']`, with try/catch.
  - A new user starts at `pending`.
  - A returning user who already granted consent keeps `granted`.
- **`pending`:**
  - Events are buffered and persisted locally.
  - **Nothing is ever sent**: no `flush`, no beacon, no `online` flush.
  - `getStatus()` exposes `consent`.
- **`denied`:** buffered events are cleared. Later pushes are dropped and counted (document the behaviour).
- **Methods:**
  - `grantConsent()`: set `granted`, notify listeners, flush immediately.
  - `denyConsent()`: set `denied`, then `clear()`.
  - `resetConsent()`: back to `pending`.
- **Privacy purge:** `tracker.clear()`, `resetConsent()` and `clearSessions()` (from ticket 04, once it lands).
- **Privacy page:** show the consent status in plain words.
- **AppShell:** while consent is `pending`, show no "will sync automatically" banner.

## Tests

- **Pending:** a push followed by the timer sends no fetch and no beacon, and a reload restores the buffer.
- **Grant:** buffered events are sent in batches of ≤ 100.
- **Deny:** the buffer and storage are cleared, and later pushes are not sent.
- **Returning granted user:** events are sent normally.
- **Existing tracker tests:** they set `granted` in their setup, so their meaning is unchanged.

## Done when

`qa:checks` is green, and the commit has no AI attribution.

## Comments

- 2026-10-31 (TD-03 tracker hygiene): Done in e2f4835..3d2b34b, review clean (brand-v2 ledger).
