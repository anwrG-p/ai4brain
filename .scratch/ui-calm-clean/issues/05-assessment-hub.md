# 05: Assessment hub (`/assessment`)

Status: ready-for-agent
Blocked by: 02
Spec: `../spec.md` (Goal, R1, R2, R5)

## Target, from top to bottom

1. **h1:** keep the pinned text "Calibrate your cognitive twin—2-minute adaptive micro-tasks…". Then one subline in consumer language ("Short games that adapt to you. No camera, no microphone.").
2. **Next up card** (one card):
   - the top-priority dimension's consumer name
   - one line on why
   - duration
   - **one primary CTA**, "Start" (keep its existing link target)
   - "Why this?" as a `<details>` holding the WhyThisPanel content (`defaultExpanded` off)
3. **All exercises:** a flat list. One row per dimension: consumer name, short task name, a confidence chip (Badge) and a "Start" link. No cards nested in cards.
   - Keep the view toggle buttons /View Task Queue as Table/ and /View Modules as Cards/ and the table "Assessment Hub cognitive task queue table".
   - The "Cards" view becomes the flat list.
4. **`<details data-technical-drawer>` "How tasks are chosen"** holds:
   - QUEST+ text and parameter tiles
   - the session-mode cards
   - the persona/state bar (keep labels /Hatched Priority Queue \(Salma/ and /Calibrated Queue \(Youssef/)
   - Psychometric safeguards
   - Known biases
   - Scheduler & Telemetry Contracts, with the /Inspect Payload JSON/ button and the `low_confidence_hatched_band_narrowing` text

## Remove from the visible layer

- QUEST+ / staircase / "Layer A" badges
- the mascot with speech bubble (decorative)
- the 4-tile parameter grid
- the "← Command Dashboard" duplicate CTA (the nav covers it)

## Tests

- `designSystem.test.tsx`'s AssessmentHub test passes unchanged.
- `e2e/assessmentHub.spec.ts` passes on Edge: axe light and dark, sizes, and all pinned controls after `openJudgeMode`.
- **New tests:**
  - at most 1 primary-variant CTA outside `details`
  - no visible "QUEST" text outside `details`
  - no `.tactile-card` inside another `.tactile-card` on this page

## Done when

`qa:checks` is green, the assessmentHub e2e passes, and the commit has no AI attribution.
