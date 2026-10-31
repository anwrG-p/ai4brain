# 04. Task Runner (`/task/:dimId`) · HERO PAGE

> **Superseded (history).** This spec describes the page before brand v2. Now: `/task/:dimId` runs one exercise in `ExerciseFrame` (instruction, fixation, trials, end card). Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

## Purpose, user moment, rubric criteria
- **Purpose**: The **Layer A Interactive Psychometric Task Runner** where learners complete 90–120 second adaptive micro-blocks (or untimed Evaluator Sandbox previews) across any configured cognitive dimension (`3 | 6 | 7 | 8 | 10`), capturing high-precision client-side behavioral telemetry (`response_time_ms`, `error_flag`, `error_burst`, `hesitation_jitter`, `keystroke_latency_ms`) and streaming it to `POST /v1/telemetry/event` with **zero biometric collection**.
- **User / Evaluator Moment**: Reached when clicking **"▶ Start #1 Priority Block"** or **"Launch Task →"** on `/assessment` or `/dashboard`. Must feel crisp, tactile, and 100% distraction-free during active timed trials while giving evaluators an interactive **8-Schema Switcher (`n_back`, `stroop`, `ufov`, `mst`, `matrix`, `relational`, `tower`, `mental_rotation`)**, **1-Click Simulate Tab-Blur Auto-Pause**, and **Live `TelemetryEvent` JSON Stream Inspector**.
- **Rubric Criteria Served**:
  - **Relevance (Phase 1 — 12%)**: Demonstrates real interactive cognitive tasks with adaptive 85%-accuracy QUEST+ staircase stepping and live `POST /v1/telemetry/event` payloads matching Member 1's FastAPI contract.
  - **Robustness (Phase 2 — 10%)**: Enforces **Tab-Blur / Visibility-Change Auto-Pause** (`document.visibilitychange` + 1-click evaluator trigger), **Zero-Distraction Lock** (`<Mascot />` automatically hidden during active timed trials and re-enabled on the post-block completion screen), and **Offline Ring Buffer** (`up to 500 events`).
  - **Accessibility & UX (Phase 1 — 9%)**: Full keyboard shortcut support (`1 / 2 / 3` or `J / K / L` + `Space` / `Escape` to pause), large $\ge 48\text{ px}$ touch/click response buttons, shape+label+color stimulus encoding (never color alone, even in Stroop!), and zero punitive streak/failure language.
- **Time Budget**: `4 hours` (+50% alert threshold: `6 hours`).

---

## Wireframes: desktop, mobile

### Desktop (`1440 px` — Distraction-Free Trial Stage + Evaluator Telemetry Rail)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · CISTAC 1.0     [Simulated Data]    [3|6|7|10 Dims] [Dark/Light] [Style Guide] |
+--------------------------------------------------------------------------------------------------+
| TASK RUNNER HEADER + DIMENSION / SCHEMA SWITCHER +STAGE CONTROLS                                 |
| [★ Layer A Task Runner · ⬢ EP Episodic Pattern Separation] [QUEST+ Lvl 3 (85% Target)]           |
| [Stage: Pre-Block Briefing | ▶ Active Trial (Mascot Locked OFF) | ⏸ Tab-Blur Paused | ✓ Summary] |
| [Dimension Switcher: ● WM | ■ IC | ▲ CF | ◆ AN | ⬠ PS | ⬢ EP | ★ VP ...]                         |
+-------------------------------------------------------+------------------------------------------+
| LEFT (8 cols): INTERACTIVE STIMULUS & RESPONSE STAGE  | RIGHT (4 cols): REAL-TIME PSYCHOMETRIC   |
| +---------------------------------------------------+ | TELEMETRY & STAIRCASE INSPECTOR          |
| | [Trial 2 of 4] [Staircase Lvl 3] [⏸ Pause (Esc)]  | | +--------------------------------------+ |
| | [Zero-Distraction Lock: Mascot Hidden During Run] | | | Live Staircase & RT Telemetry        | |
| |                                                   | | | • Mean RT (Normalized): 562 ms       | |
| |        +---------------------------------+        | | | • Hesitation Jitter:    48 ms        | |
| |        |     STIMULUS CANVAS (SVG)       |        | | | • Error Burst Count:    0            | |
| |        |   (N-Back / Stroop / UFOV /     |        | | | • Posterior Confidence: 48% → 66%    | |
| |        |    MST Lure / Matrix Pattern)   |        | | +--------------------------------------+ |
| |        +---------------------------------+        | | +--------------------------------------+ |
| |                                                   | | | Robustness & Fault Simulator         | |
| |  [ (1) EXACT OLD ] [ (2) SIMILAR LURE ] [ (3) NEW]| | | [⚡ Simulate Tab-Blur Auto-Pause]    | |
| |   Keyboard: 1 / J    Keyboard: 2 / K     Key: 3/L | | | [⏭ Fast-Forward Block to Summary]   | |
| +---------------------------------------------------+ | +--------------------------------------+ |
|                                                       | +--------------------------------------+ |
|                                                       | | Live POST /v1/telemetry/event Stream | |
|                                                       | | { "task_id": "mst_l3", "rt_ms": 540 }| |
|                                                       | +--------------------------------------+ |
+-------------------------------------------------------+------------------------------------------+
```

### Mobile (`375 px` — Single-Column Ergonomic Trial Stage)
```text
+---------------------------------------+
| [ST] SynapseTwin   [7 Dims] [Theme]   |
+---------------------------------------+
| TASK RUNNER HEADER & DIM SWITCHER     |
+---------------------------------------+
| 1. INTERACTIVE STIMULUS STAGE         |
|    • Trial Progress Bar + Pause Btn   |
|    • High-Contrast SVG Stimulus       |
|    • Large >=48px Response Buttons    |
+---------------------------------------+
| 2. ROBUSTNESS & TELEMETRY INSPECTOR   |
|    • Simulate Tab-Blur / Fast-Forward |
|    • POST /v1/telemetry/event JSON    |
+---------------------------------------+
```

---

## Content and copy deck
- **Stage 1 — Pre-Block Briefing**:
  - Headline: `Ready for your 90-second calibration block`
  - Subcopy: `Respond comfortably and accurately. The QUEST+ staircase automatically adapts to your pace—there are no penalties, timers that shame you, or biometric sensors.`
- **Stage 2 — Active Timed Trial (Zero-Distraction Mode)**:
  - Banner: `● Zero-Distraction Trial Lock Active: Companion mascot and decorative motion are disabled while reaction-time telemetry is recorded.`
- **Stage 3 — Tab-Blur / Window-Hide Auto-Pause Modal**:
  - Headline: `⏸ Trial Auto-Paused — Focus Left Window`
  - Subcopy: `To protect your reaction-time distribution and confidence interval (±CI), we paused the clock when the tab lost focus. The interrupted item was discarded cleanly.`
  - CTA: `Resume Calibration Block →`
- **Stage 4 — Post-Block Completion & Confidence Update**:
  - Headline: `✓ Micro-Block Complete — Confidence Band Narrowed!`
  - Subcopy: `Your 95% confidence interval narrowed from ±16% to ±7% (48% → 72% confidence), graduating this dimension from diagonally hatched to solid!`

---

## States: loading, empty, partial, error, offline, low confidence
- **Pre-Block Briefing (`briefing`)**: Shows task instructions, keyboard bindings (`1/2/3`), and `<Mascot state="thinking" />`.
- **Active Timed Trial (`running`)**: Renders interactive multi-trial psychometric stimuli across all configured dimensions (`n_back`, `stroop`, `ufov`, `mst`, `matrix`, `relational`, `tower`, `mental_rotation`). **Strictly hides `<Mascot />`** to guarantee zero visual distraction during reaction-time measurement.
- **Tab-Blur Auto-Pause (`paused-blur`)**: Triggered automatically on `document.visibilitychange` or via the 1-click **"Simulate Tab-Blur Auto-Pause"** button for evaluators.
- **Post-Block Summary (`completed`)**: Shows before/after $\pm\text{CI}$ confidence band graduation (`Hatched 48% → Solid 72%`), `<Mascot state="celebrate" />`, `<WhyThisPanel />` explaining the staircase adjustment, and direct CTAs to `/profile-reveal` or `/dashboard`.
- **Loading (`loading`)**, **Error (`error` — simulated `POST /v1/telemetry/event` HTTP 503 with local ring-buffer fallback)**, and **Extreme Values (`extreme-text`)** all accessible from the state switcher bar.

---

## Interactions and motion (with the reduced-motion variant)
- **Interactive 4-Trial Micro-Block**: Users can click the response buttons (or press keys `1`, `2`, `3`) through 4 adaptive trials, watching the staircase level, normalized RT (`ms`), hesitation jitter (`ms`), and `POST /v1/telemetry/event` JSON log update in real time.
- **1-Click Evaluator Fast-Forward**: Includes `"Fast-Forward to Post-Block Summary"` so judges can inspect the completion state and confidence graduation immediately.
- **Dimension & Schema Switcher**: Switch live between any dimension in the active `DimensionRegistry` (`3/6/7/8/10` dimensions) right on `/task/:dimId`.

---

## Data contract (types) and the mock fixtures used
- **`TelemetryEventPayload`** matching `backend/app/api/routes/v1_telemetry.py`:
  - `user_id`, `session_id`, `task_id`, `trial_index`, `dimension`, `score_norm`, `response_time_ms`, `error_flag`, `error_burst`, `hesitation_jitter`, `keystroke_latency_ms`, `trial_meta`, `voice_opt_in: false`, `client_ts`.

---

## Accessibility notes: focus order, labels, chart table alternative
- **Stroop & Color-Stimulus Accessibility**: Even in the Color-Word Stroop task (`IC`), every response option and stimulus pairs its color with a high-contrast geometric glyph (`●`, `■`, `▲`) and explicit key label (`[1]`, `[2]`, `[3]`) so colorblind users are never disadvantaged.
- **Accessible Trial Log Table Toggle**: Includes a 1-click **"View Trial Telemetry as Table"** toggle so screen-reader users can inspect every recorded trial's stimulus, response, RT (`ms`), jitter (`ms`), and staircase delta as a semantic `<table>`.

---

## Acceptance checklist (from the Definition of Done)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (`running`, `briefing`, `paused-blur`, `completed`, `loading`, `error`, `extreme-text`) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs` ($\ge 4.5:1$ text, $\ge 3.0:1$ UI/marks).
- [x] Complete keyboard navigation (`1/2/3`, `Escape`), `3px` focus ring, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected; `<Mascot />` locked off during `running` state.
- [x] Color never carries meaning alone.
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy` — `31.18 kB` chunk, `7.98 kB` gzipped).
- [x] Unit/component tests + Playwright `axe-core` check (`0` violations).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions.
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Decisions and known issues
- **Decisions**: Default `/task/:dimId` to the `running` (active trial) view with 1 pre-logged trial in the live telemetry stream so evaluators and screenshots immediately see the interactive stimulus canvas + live `POST /v1/telemetry/event` JSON payload, while offering 1-click tabs for `Pre-Block Briefing`, `⏸ Tab-Blur Auto-Pause`, and `✓ Post-Block Summary`.
- **Critique Round 1 & 2 Polish**:
  - Replaced literal markdown backticks in UI badges and headings with clean typography (`Micro-Block Complete · Telemetry Synced (202 Accepted)` and `POST /v1/telemetry/event Log`).
  - Synchronized the pre-seeded telemetry JSON log (`recordedEvents[0]`) when switching dimensions via the Dimension Switcher bar so `task_id`, `dimension`, and `schema_type` immediately match the active dimension.
  - Added a **QUEST+ Posterior & Hysteresis Update** summary card below `<WhyThisPanel />` in the Stage 4 (`completed`) 5-column stack so both columns align cleanly.
- **Known Issues**: None.

---

## Screenshots (paths) and commit hashes
- `docs/ui/screenshots/04-task-runner-1440.png`
- `docs/ui/screenshots/04-task-runner-768.png`
- `docs/ui/screenshots/04-task-runner-375.png`
- `docs/ui/screenshots/04-task-runner-completed-10dims-1440.png`
- `docs/ui/screenshots/04-task-runner-dark-1440.png`
