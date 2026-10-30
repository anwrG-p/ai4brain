# 04: Onboarding (`/onboarding`)

Status: ready-for-agent
Blocked by: 02
Spec: `../spec.md` (Goal, R1, R2, R5). Evidence: UI simplification review §1.5 (no tutorial decks) and §1.6 (fair consent).

## Target

Three steps stay, but each is lighter.

**Header:** h1 (keep the exact text "Configure your cognitive twin on your own terms."), a 3-step progress indicator, and the "Quick setup" button.
- The Quick setup button keeps its `aria-label`, which contains "Judge Fast-Track: Safe Defaults & Go".
- The "← Back to Welcome" link stays secondary.

**Step 1:** focus goal and peak window as two compact radio groups, then one "Continue" primary. Keep the button name /Continue to Step 2: Granular Consent/. The "Calibration Blueprint" box moves into a drawer.

**Step 2, consent:**
- **First layer, side by side and equally visible:** "Accept recommended" and "Reject all optional". Keep the pinned name /Reject All Optional \(Minimal Mode\)/ exactly. Both buttons get the same size and the same variant (secondary) (§1.6).
- **Details:** the per-purpose switches and locked items sit under "Customise" (a `<details>`, open by default only if the user has already changed something). Each row is a flat list item: label, one line, switch. No nested bordered boxes.
- Keep the step heading pinned by tests: /Granular Telemetry Consent & Mandatory Non-Biometric Lock/.
- Keep the ack checkbox, Previous and Continue.

**Step 3:** baseline mode as a compact radio pair. The latency tap test moves into a drawer ("Optional: check your input timing"). Keep the save/launch primary, its name, and the receipt behaviour.

**Right column "What SynapseTwin Sees":** replace it with a single short line under the steps, "We record answer timing and accuracy only.", plus a `<details data-technical-drawer>` "See exactly what is recorded". The drawer holds:
- the live JSON
- the endpoint list
- the never-collected list
- the receipt ID

**Inspector switcher** (Step Wizard, View All 3 Steps, Missing Ack Alert, Saving State, Extreme Values): move it into a `<details data-technical-drawer>` "Evaluator controls". Keep the button text 'View All 3 Steps' exactly.

**Copy:** visible technical terms (QUEST+, `rt_ms`, `performance.now()`, Layer C, staircase, CISTAC, ±CI) appear only inside drawers.

## Tests

- `designSystem.test.tsx`'s Onboarding test passes unchanged, including CONSENT-ST-2026-MINIMAL and CONSENT-ST-2026-FAST.
- `e2e/onboarding.spec.ts` passes on Edge: axe light and dark, 375, 768 and 1440 px, and 'View All 3 Steps' after `openJudgeMode`.
- **New tests:**
  - On Step 2, the accept and reject buttons are both rendered before any `<details>`, with the same variant class.
  - No visible "QUEST" text outside `details`.

## Done when

`qa:checks` is green, the onboarding e2e passes, and the commit has no AI attribution.
