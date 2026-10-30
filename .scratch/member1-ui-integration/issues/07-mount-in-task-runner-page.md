# 07: Mount the real exercises in `TaskRunnerPage`

Status: ready-for-agent
Blocked by: 03, 05, 06
Spec: `../spec.md` (R1–R7, DEC-007 selectors)

## Goal

At `/task/:dimId` the running stage shows a real exercise from `features/assessment`, not the scripted mock. Every UI element that tests depend on survives.

## New file

`frontend/src/features/assessment/ExerciseHost.tsx`:

```ts
type ExerciseHostProps = {
  schemaType: TaskSchemaType   // chosen by the page (R2)
  attempt: number              // bump to start a fresh task (R3)
  onDone: () => void
  onError: (msg: string) => void
}
```

What it does:
- Fetches through `fetchNextTask(getUserId(), attempt, { schemaType })`.
- Creates one `TrialRecorder` per task with:
  - `{ user_id: getUserId(), session_id, task_id: task.task_id, dimension: task.dimension, voice_opt_in: false }` (R1)
  - `session_id` created once per page load and kept in a module-level variable.
- Renders `<SkipOnError><TaskRunner …/></SkipOnError>` inside a container with `data-timed-trial="true"` (R7).

## `TaskRunnerPage.tsx` changes

**Mounting the exercise:**
- In the `stage==='running'` branch, replace the mock stimulus block and the 3-button response grid (around lines 910–981) with `<ExerciseHost>`.
- Keep the `h1` (`currentDim.taskName`), the progress bar, the pause pill, the exit link and the sr-only "Zero-Distraction Lock: Mascot Hidden".

**Schema selection (R2):**
- Use `?schema=` when it is in `currentDim.schemaTypes`, else `schemaTypes[0]`.
- In the Evaluator Controls, add one button per schema type of the current dimension, e.g. "Exercise: tower". Each sets `?schema=` and bumps `attempt`.

**Keyboard (R4):** while `ExerciseHost` is mounted, the page `keydown` handler only handles Escape → pause. The 1/2/3 and J/K/L handling is removed for the real-exercise path.

**Pause and blur (R3):**
- Any transition to `paused-blur` or pause unmounts the host, which is already the case.
- **Resume** increments `attempt`, so a new task is fetched.
- "Simulate Tab-Blur Pause" and the heading /Trial Auto-Paused — Focus Left Window/ stay.

**Telemetry table and progress (R5):**
- Replace the page's fabricated `RecordedTrialEvent[]` with real events. Subscribe with `tracker.onEvent` while mounted and keep the last 50.
- The table "Recorded trial telemetry events table" and the "View Telemetry as Table" button stay, with real columns: trial, dimension, score, RT, error, jitter.
- The completed screen's metrics (mean RT, accuracy, jitter) are computed from these real events.
- **Honest status:**
  - Remove the unconditional "Telemetry Synced (202 Accepted)" text.
  - Show `tracker.getStatus()`: queued or synced counts.
  - The "via POST /v1/telemetry/event" line may stay, because events really are sent there now.

**Completion:**
- `onDone` → `setStage('completed')`.
- "Fast-Forward to Summary", "4 · ✓ Block Summary", the dimension switcher ("■ IC", "⬢ EP") and the theme buttons stay and keep working.
- The heading "Episodic Pattern Separation confidence interval narrowed!" stays on the completed screen for that dimension.

**Leftovers:**
- Leave the static demo stages (`loading`, `error`, `extreme-text`) untouched.
- Wire `onError` to the real `error` stage with the real message and a retry that bumps `attempt`.

## Declutter (from `docs/research/2026-10-30-ui-simplification-review.md`)

The user asked for a less bulky design. Within this page, apply the following; each rule cites its evidence section.

**Running stage: only what the trial needs (§1.1, §1.2; a validity judgement too).** Visible:
- the `h1`
- one progress indicator
- the pause control
- the exit link
- the exercise itself
- the existing sr-only mascot-lock text

Not visible while a trial runs:
- EMILY mood banners
- extra cards around the stimulus
- decorative doodles
- explanatory paragraphs

The instruction is the exercise's own single line.

**Briefing: no tutorial deck (§1.5).** At most one short screen: one line saying what to do, the key hints, and Start. No multi-tile explanation.

**Completed screen: lead with the result (§1.3).**
- One headline line, e.g. "Accuracy 85% · 642 ms", front-loaded.
- Metrics, the telemetry table and technical cards (QUEST+, confidence detail) go inside one collapsed `<details>` ("Show details"), in line with ADR 0001.
- Mascot celebrate stays, because it carries state (§1.4).
- Nothing on this screen is a card inside a card.

**Evaluator / judge controls.** They must not add weight for real users.
- If a judge-mode toggle already exists (`e2e/testUtils.openJudgeMode`), keep the panel behind it.
- Otherwise collapse it into a `<details>`.
- All DEC-007 buttons must stay reachable by the existing tests. Check how `designSystem.test.tsx` reaches them before changing visibility.

**Copy (§1.3):**
- Cut page copy you touch by about half.
- Start every line with the information-carrying word.
- Use an objective tone.

## Tests

- **`src/tests/designSystem.test.tsx`:** the Page 04 test must pass unchanged. If a mock-specific assertion breaks, update only that assertion, and note it in Comments with the DEC-007 rationale.
- **New** `features/assessment/ExerciseHost.test.tsx`:
  - In mock mode with `schemaType 'stroop'`, the Stroop exercise renders.
  - Answering pushes an event whose `dimension` comes from the payload.
  - Bumping `attempt` re-fetches with a new `task_id`.
- **New page test:** pressing "1" while N-back is mounted does not trigger the old mock handler. Escape still pauses.

## Done when

- From `frontend/`, `npm run qa:checks` is green.
- Manual: `npm run dev` with the API running. Play one exercise of each schema type, using the evaluator buttons for tower, relational and rotation. The API log shows only 202 responses.
- Commit with no AI attribution.
