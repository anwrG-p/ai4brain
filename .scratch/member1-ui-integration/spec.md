# Spec: integrate Member 1 exercises into the new UI (`frontend/`)

Status: ready-for-agent
Owner: Member 1 (Mazen)
Date: 2026-10-30

## Goal

`frontend/` (SynapseTwin) runs the **real** 8 exercises at `/task/:dimId`. Today it shows a scripted mock. After this work, every trial is captured by Member 1's tracker and accepted by `POST /v1/telemetry/event`, with zero 422s (DEC-002). The frontend's `qa:checks` and Playwright e2e stay green.

## Decisions (made with the user, 2026-10-30)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Port without voice** | `VoiceToggle` / `voiceProbe` are not ported. The UI's "microphone permanently blocked" copy (DEC-008) stays true. `voice_opt_in` is always `false`. |
| D2 | **Move code into `frontend/src/features/assessment/`** | That folder is owned by Member 1 inside the UI app. `assessment_engine/client` becomes a frozen reference: its README points to the new location. `assessment_engine/api` stays where it is. |
| D3 | **Member 1's `Tracker` becomes the single telemetry sink** | It gains the UI queue's extras: localStorage persistence, `subscribe`/`getStatus` for the offline banner, and `clear()` for the privacy purge. `services/telemetry/telemetryQueue.ts` is deleted. |
| D4 | **Research fixes first** | Stroop `congruent`, rotation `angle_deg`/`mirrored`, Tower 60 s limit, and d′/LDI formulas in HANDOVER. Done in `assessment_engine/` before porting, so the port carries them. See `docs/research/2026-10-30-member1-evidence-review.md`. |

## Rulings (controller decisions; flag to the user if wrong)

- **R1. Dimension in events = `task.dimension` from the payload, never `dim.backendDimensionKey`.** The UI registry maps tower and mental_rotation to `pattern_induction`; our contract says otherwise. *Cost if wrong:* re-key with Member 3.
- **R2. Choosing an exercise at `/task/:dimId`.**
  - *Mock mode* (`VITE_USE_MOCKS !== 'false'`, the UI default): `?schema=<schema_type>` picks the fixture when it is in `dim.schemaTypes`; otherwise the first schema type is used. The evaluator panel gets one button per schema type of the current dimension, so tower, relational and mental_rotation are reachable.
  - *Real mode:* the generator decides what comes next, so `dimId` is ignored for selection.
  - Open question for Member 5: should `GET /v1/tasks/next` accept a `schema_type` filter?
  - *Cost if wrong:* small router change.
- **R3. Pause and blur.**
  - Any pause (Escape, pause button, real or simulated blur) **unmounts** the exercise.
  - Resume **starts a fresh task**: new fetch, new `task_id`.
  - Events already sent stay valid. The interrupted trial is never emitted, and `item_id`s never repeat.
  - *Cost if wrong:* a partly played task is restarted.
- **R4. Keyboard.** While an exercise is mounted, the page's own `keydown` handler (keys 1/2/3, J/K/L) is disabled. Escape → pause is kept; no exercise uses Escape.
- **R5. Honest UI (DEC-008).** The completed screen and telemetry table show **real** tracker status: events and pending/sent counts. The hard-coded "Telemetry Synced (202 Accepted)" claim is removed or made conditional on a real 2xx.
- **R6. Copy follows the glossary and ADR 0001.**
  - Exercise instructions use consumer language.
  - Technical terms (QUEST+, staircase, d′) go only in `<details>` drawers.
  - All copy passes `lint:copy`.
  - The `h1` stays `currentDim.taskName`, because DEC-007 selectors depend on it.
- **R7. `data-timed-trial="true"` is set on the trial container while an exercise runs.** The UI's tokens.css already disables animations under that attribute.

## Constraints (verbatim from the UI repo)

- `cd frontend && npm run qa:checks` must stay green: `lint:tokens`, `lint:copy`, `check:contrast`, `test`, `build`.
  - `lint:tokens` bans hex, `rgb()`, `hsl()` and arbitrary Tailwind `p-/m-/gap-/text-/rounded-/duration-[…]`.
  - Canvas colours must come from CSS variables via `getComputedStyle`.
- TypeScript is `strict` + `noUncheckedIndexedAccess`. The port has 39 known indexed-access errors to fix.
- **DEC-007:** keep these selectors.
  - `h1` /Mnemonic Similarity Task/ on `/task/episodic_pattern_separation`
  - sr-only "Zero-Distraction Lock: Mascot Hidden"
  - buttons "View Telemetry as Table", "Simulate Tab-Blur Pause", "Fast-Forward to Summary", "4 · ✓ Block Summary", "■ IC", "⬢ EP", "Dark (Night Lab)", "Light (Playful Lab)"
  - headings /Trial Auto-Paused — Focus Left Window/ and "Episodic Pattern Separation confidence interval narrowed!"
  - table "Recorded trial telemetry events table"
- `e2e/taskRunner.spec.ts`: axe has **zero violations** in light and dark themes, and there is no horizontal overflow at 375 and 768 px.
- Toolchain: React 18.3, Vite 6, Vitest 3, TS 5.9. Ported tests must run under Vitest 3.
- Use the UI primitives: `components/ui/Button`, `Card`, `Badge`, `.tactile-btn`, `.focus-ring`, the `--color-*` tokens, and `var(--dim-n)`.
- The server contract is unchanged: `assessment_engine/api/routes/telemetry.py`.

## Coordination (human, not agent)

- **DEC-001:** the UI team owns `frontend/**`. Tell the UI owner before merging. The changes outside `features/assessment/` are small: `TaskRunnerPage`, `AppShell`, `PrivacyPage`, and deleting `telemetryQueue.ts`.
- **Member 5:** ask about a `schema_type` filter on `/v1/tasks/next` (R2), `time_limit_ms` for tower and mst, and the block designs from the research (Stroop congruent plus incongruent, oMST mix, blocked rotation, TOL-F series).

## Tickets

| # | Ticket | Blocked by |
|---|---|---|
| 01 | Research logging fixes in `assessment_engine/` | — |
| 02 | Port telemetry core + adaptive engines; Tracker extras | 01 |
| 03 | Replace the UI telemetry queue with the Tracker | 02 |
| 04 | Port task source, fixtures, SVG and the TaskRunner switch | 02 |
| 05 | Port exercises A: N-back, Stroop, Matrix, Mental rotation | 04 |
| 06 | Port exercises B: Relational, Tower, UFOV, MST | 04 |
| 07 | Mount the exercises in `TaskRunnerPage` | 03, 05, 06 |
| 08 | Verify end to end + docs + freeze the old client | 07 |

## Done when

- `npm run qa:checks` is green. Playwright `taskRunner.spec.ts` is green, including axe in light and dark.
- With the API running, playing each schema type at `/task/...` writes accepted events to `data/raw/telemetry/<uid>.jsonl`. No 422s in the API log.
- The privacy purge clears pending telemetry, and the offline banner shows the real pending count.
