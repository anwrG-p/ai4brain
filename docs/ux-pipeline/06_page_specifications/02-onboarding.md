# 02. Onboarding & Consent (`/onboarding`)

## Purpose, user moment, rubric criteria
- **Purpose**: 3-step progressive onboarding flow (**Step 1: Goal & Study Context** $\rightarrow$ **Step 2: Granular Telemetry Consent & Non-Biometric Lock** $\rightarrow$ **Step 3: 30-Second Input & Baseline Calibration Mode**) that establishes informed consent, proves privacy-by-default before a single keystroke is logged, and gets the user into their first assessment block in under 60 seconds.
- **User / Evaluator Moment**: Triggered when a user or evaluator clicks **"Start 2-Minute Baseline →"** or **"Onboarding"** in the header. Evaluators inspect this page specifically for the **Safety & Ethics (6%)** and **UX (9%)** rubric criteria.
- **Rubric Criteria Served**:
  - **Safety, Privacy & Ethics (Phase 1 — 6%)**: Granular per-category opt-in toggles, mandatory **Non-Biometric Mode ON by default** (zero camera/microphone/raw keystroke content), explicit "What the AI Sees vs. Never Sees" live payload preview, and non-clinical disclaimer acknowledgment.
  - **UX & Accessibility (Phase 1 — 9%)**: Fast 3-step stepper with keyboard/touch parity check, zero dark patterns (`Reject All Optional (Minimal Mode)` is as prominent as `Accept Recommended Defaults`), and 1-click **"⚡ Judge Fast-Track: Safe Defaults & Go →"** button.
  - **Relevance (Phase 1 — 12%)**: Connects learner goals and schedule windows directly to Layer A (Task Runner) and Layer C (Goals & Plan).
- **Time Budget**: `1.5 hours` (+50% alert threshold: `2.25 hours`).

---

## Wireframes: desktop, mobile

### Desktop (`1440 px` — 8:4 Split: Interactive 3-Step Wizard + Live Consent & Payload Inspector)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · CISTAC 1.0     [Simulated Data]    [3|6|7|10 Dims] [Dark/Light] [Style Guide] |
+--------------------------------------------------------------------------------------------------+
| STEPPER BAR:  [ 1. Learning Context ] [ 2. Granular Consent ] [ 3. Input Check & Baseline Mode ] |
|               [ ⚡ Judge Fast-Track: Safe Defaults & Go → ]  [Step Wizard] [View All 3 Steps]    |
+--------------------------------------------------------------------------------------------------+
| LEFT COLUMN (8 cols): ACTIVE ONBOARDING STEP CARD    | RIGHT COLUMN (4 cols): LIVE AI INSPECTOR  |
| +--------------------------------------------------+ | +---------------------------------------+ |
| | Step 1/2/3 or All 3 Steps Expanded               | | | 🔒 What SynapseTwin Sees (Live JSON)  | |
| |                                                  | | | {                                     | |
| | - Step 1: Primary Goal & Peak Window             | | |   "consentReceiptId": "CONSENT-...",  | |
| | - Step 2: 5 Granular Consent Switches +          | | |   "nonBiometricMode": true,           | |
| |           Non-Clinical Acknowledgment            | | |   "cameraMicAccess": "NEVER_REQUESTED"| |
| | - Step 3: Input Latency Check (138 ms) +         | | | }                                     | |
| |           2-Min Quick vs 5-Min Standard Mode     | | | Bound Backend Contracts:              | |
| |                                                  | | | POST /v1/telemetry/event · DELETE ... | |
| +--------------------------------------------------+ | +---------------------------------------+ |
+--------------------------------------------------------------------------------------------------+
```

### Mobile (`375 px` — Single-Column Step Stack)
```text
+---------------------------------------+
| [ST] SynapseTwin   [7 Dims] [Theme]   |
+---------------------------------------+
| STEP 1 · 2 · 3   [⚡ Judge Fast-Track] |
+---------------------------------------+
| ACTIVE STEP CARD                      |
| - Step 1: Primary Goal & Peak Window  |
| - Step 2: Granular Consent Toggles    |
| - Step 3: 2-Min Quick Baseline vs     |
|           Full 8-Task Calibration     |
+---------------------------------------+
| 🔒 WHAT SYNAPSETWIN SEES (LIVE JSON)  |
| Live redaction & non-biometric proof  |
+---------------------------------------+
```

---

## Content and copy deck
- **Page Header**:
  - Eyebrow: `🔒 Privacy-First Onboarding · Step ${step} of 3`
  - Headline (`<h1>`): `Configure your cognitive twin on your own terms.`
  - Subcopy: `Before a single trial begins, choose your focus goal, inspect the exact telemetry fields SynapseTwin logs, and verify our non-biometric guarantee.`
- **Step 1 — Learning Focus & Schedule Context**:
  - Focus Goal Options: `Balanced 360° Cognitive Twin` (Default), `Deep Focus & Working Memory`, `Fast Set-Shifting & Exam Agility`
  - Preferred Study Window: `Morning Peak (08:00 – 12:00)`, `Afternoon Window (13:00 – 17:00)`, `Evening Session (18:00 – 22:00)`
- **Step 2 — Granular Telemetry Consent & Non-Biometric Lock**:
  - Equal-prominence preset bar: `Reject All Optional (Minimal Mode)` vs `Accept Recommended Defaults`
  - 5 granular consent items: `Core Task Timing & Accuracy Telemetry (Required · Always ON)`, `Mandatory Non-Biometric Mode (Hardware Lock · Locked ON)`, `Historised Brain Twin Snapshots (Optional · Default ON)`, `Explainable AI Coach & 0–100 Collaboration Score (Optional · Default ON)`, `Anonymized Aggregate Benchmark Export (Opt-In · Default OFF)`
  - Required non-clinical educational acknowledgment checkbox.
- **Step 3 — 30-Second Input Timer Check & Baseline Depth Selection**:
  - Hardware input latency micro-test (`⚡ Tap / Space to Test Timer (138 ms)`)
  - Baseline mode cards: `⚡ 2-Minute Quick Baseline (3 trials/dim)` vs `🎯 Standard 5-Minute Calibration (8 trials/dim)`
  - Dynamic dimension queue badges for `3 | 6 | 7 | 8 | 10` dimensions.

---

## States: loading, empty, partial, error, offline, low confidence
- **Step Wizard (`wizard`)**: Interactive Step 1 $\rightarrow$ Step 2 $\rightarrow$ Step 3 navigation.
- **All 3 Steps Expanded (`all-steps`)**: Displays all 3 steps simultaneously for full-canvas inspection.
- **Validation Alert (`validation-error`)**: Displays accessible `role="alert"` banner if non-clinical acknowledgment is unchecked.
- **Saving State (`loading`)**: Skeleton confirmation state (`role="status"`).
- **Extreme Values (`extreme-text`)**: Long receipt hash & title overflow check (`RECEIPT_HASH=CONSENT-ST-2026-999999999999...`).
- **Offline State**: Automatically switches `"storageMode"` in the live JSON inspector to `"local_indexed_queue"`.

---

## Interactions and motion (with the reduced-motion variant)
- **Live JSON Consent Inspector**: Toggling any switch in Step 2 immediately updates `liveWhatAiSeesJson` (`aria-live="polite"`) and `consentReceiptId`.
- **Hardware Input Timer Test**: Clicking/pressing Space on the timer test button updates `inputLatencyMs` (`132–155 ms`) and displays a confirmation toast.
- **Judge Fast-Track**: 1-click button locks safe defaults (`CONSENT-ST-2026-FAST`) and advances directly to Step 3 launch.
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` and header toggle.

---

## Data contract (types) and the mock fixtures used
- **Store Contract (`frontend/src/store/useAppStore.ts`)**:
  - `ConsentPreferences`: `{ focusGoal, peakWindow, coreTelemetry: true, nonBiometricMode: true, historicalSnapshots, coachAndCollab, researchExport, nonClinicalAck, baselineMode, inputLatencyMs, consentReceiptId, updatedAtIso }`
- **Dimension Generalisation**: Dynamically computes `totalBaselineTrials = activeDimensions.length * trialsPerDim` across `3 | 6 | 7 | 8 | 10` dimensions.

---

## Accessibility notes: focus order, labels, chart table alternative
- **Stepper Semantics**: `<ol role="list">` with `aria-current="step"`.
- **Switch & Radio Semantics**: `role="radiogroup"` + `role="radio"` (`aria-checked`) for Step 1 goals/windows and Step 3 baseline modes; `role="switch"` (`aria-checked`, `aria-labelledby`) for Step 2 optional consent toggles.
- **Touch Targets**: All buttons, switches, and radio cards meet $\ge 44\text{ px}$ (`min-h-11`).

---

## Step 7 Critique Log (Picky Designer & Hostile Juror)
1. **Round 1 — Picky Designer Critique**:
   - *Finding 1*: In `02-onboarding-1440.png` (Step 1 Wizard view), the left 8-column card was shorter than the right 4-column JSON inspector card.
   - *Fix Applied*: Added the **Active Calibration Blueprint** summary box inside Step 1 so the 8-column and 4-column cards align cleanly at `1440px`.
   - *Finding 2*: At `375px` mobile (`02-onboarding-375.png`), the long dimension badge `▲ CF · Cognitive Flexibility (Set-Shifting) (3 trials)` did not wrap inside its card because `Badge.tsx` enforced `whitespace-nowrap`.
   - *Fix Applied*: Updated `Badge.tsx` to support `whitespace-normal max-w-full` when requested, and wrapped the JSON `<pre>` block with `whitespace-pre-wrap break-words` so `375px` has zero badge or text clipping.
2. **Round 2 — Hostile Juror Critique**:
   - *Finding*: *"Which exact backend routes enforce this consent receipt?"*
   - *Fix Applied*: Added the **Bound Backend Contracts** block (`POST /v1/telemetry/event · GET /v1/tasks/next · DELETE /v1/user/telemetry`) directly below the live JSON payload inspector.

---

## Acceptance checklist (from the Definition of Done)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (Step 1/2/3 wizard, all-steps expanded, missing-ack alert, saving skeleton, extreme text, offline) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs` ($\ge 4.5:1$ text, $\ge 3.0:1$ UI/marks).
- [x] Complete keyboard navigation, `3px` focus ring, logical tab order, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected.
- [x] Color never carries meaning alone (`✓`/`○`/`🔒`/`✕` glyphs + explicit `ON`/`OFF` text on every switch).
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy` — `OnboardingPage` chunk `25.37 kB` / `6.77 kB` gzipped).
- [x] Unit/component tests (`6/6` pass) + Playwright axe-core check (`0` violations in Light & Dark).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions (`3×10 = 30 trials` verified in screenshot).
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Decisions and known issues
- **Decisions**: Included both `Step Wizard` (default) and `View All 3 Steps` mode so evaluators can either step through sequentially or inspect all 3 onboarding steps on a single canvas.
- **Known Issues**: None.

---

## Screenshots (paths) and commit hashes
- `docs/ui/screenshots/02-onboarding-1440.png`
- `docs/ui/screenshots/02-onboarding-all-steps-1440.png`
- `docs/ui/screenshots/02-onboarding-dark-1440.png`
- `docs/ui/screenshots/02-onboarding-768.png`
- `docs/ui/screenshots/02-onboarding-375.png`
