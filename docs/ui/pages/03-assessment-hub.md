# 03. Assessment Hub (`/assessment`)

> **Superseded (history).** This spec describes the page before brand v2. Now: `/assessment` redirects to **Train** (`/train`). Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

## Purpose, user moment, rubric criteria
- **Purpose**: The **Layer A Assessment & Psychometric Calibration Center** of **SynapseTwin**, allowing learners and evaluators to inspect and launch adaptive micro-task blocks across all configured cognitive dimensions (`3 | 6 | 7 | 8 | 10`), review each dimension's **QUEST+ / 85%-accuracy staircase level**, see why low-confidence hatched dimensions (`< 60%` confidence) are prioritized in the queue, and verify our **mandatory non-biometric telemetry contract** (`GET /v1/tasks/next` & `POST /v1/telemetry/event`).
- **User / Evaluator Moment**: Reached when clicking **"Start Next 2-Min Block"** from the Dashboard or navigating to `/assessment` to launch a specific cognitive task (`/task/:dimId`).
- **Rubric Criteria Served**:
  - **Relevance (Phase 1 — 12%)**: Showcases Layer A's 8 psychometric task schemas (`n_back`, `stroop`, `ufov`, `mst`, `matrix`, `relational`, `tower`, `mental_rotation`), adaptive staircase levels, and non-biometric telemetry guarantees.
  - **Explainability & Profile Quality (Phase 1 — 9% & Phase 2 — 8%)**: Explains *why* a specific micro-block is queued first (e.g., narrowing a hatched $\pm 16\%$ confidence interval or initializing an unassessed dimension) using `<WhyThisPanel />`.
  - **Generalisation & Robustness (Phase 2 — 20%)**: Dynamically generates the assessment queue for `3 | 6 | 7 | 8 | 10` dimensions and previews offline event buffering (`up to 500 events`) + tab-blur auto-pause safeguards.
- **Time Budget**: `2 hours` (+50% alert threshold: `3 hours`).

---

## Wireframes: desktop, mobile

### Desktop (`1440 px` — 12-Column Assessment Command Layout)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · CISTAC 1.0     [Simulated Data]    [3|6|7|10 Dims] [Dark/Light] [Style Guide] |
+--------------------------------------------------------------------------------------------------+
| ASSESSMENT HUB HEADER + SESSION MODE SELECTOR + PERSONA / STATE SWITCHER                         |
| [★ Layer A · Psychometric Assessment Hub] [QUEST+ 85% Staircase] [Non-Biometric Lock: ON]        |
| [Session Mode: Priority Queue (2 Min) | Full Calibration (5 Min) | Single-Dimension Sandbox]     |
+-------------------------------------------------------+------------------------------------------+
| LEFT (7 cols): RECOMMENDED PRIORITY CALIBRATION QUEUE | RIGHT (5 cols): ENGINE READINESS,        |
| +---------------------------------------------------+ | TELEMETRY CONTRACT & WHY THIS QUEUE      |
| | #1 PRIORITY BLOCK · NARROW HATCHED BAND (2 MIN)   | | +--------------------------------------+ |
| | ⬢ EP · Episodic Pattern Separation (48% Conf ▨)   | | | Psychometric Engine & Safeguards     | |
| | Task: Mnemonic Similarity (Old / Lure / New)      | | | • Staircase Target: 85% Accuracy     | |
| | Current: 81% ± 16% · Staircase Lvl 2 → Lvl 3      | | | • Tab-Blur Auto-Pause: Armed         | |
| | [ ▶ Launch 2-Min Block (/task/episodic...) ]      | | | • Input Latency Offset: 138 ms       | |
| +---------------------------------------------------+ | | • Offline Queue: 0 / 500 Buffered    | |
|                                                       | +--------------------------------------+ |
| +---------------------------------------------------+ | +--------------------------------------+ |
| | <WhyThisPanel /> — Why is Episodic Separation #1? | | | Live Contract Preview                | |
| | 5-Part Reasoning Trail + Counterfactual Guarantee | | | GET /v1/tasks/next                   | |
| +---------------------------------------------------+ | | [Inspect Next-Task Payload JSON ▼]   | |
|                                                       | +--------------------------------------+ |
+-------------------------------------------------------+------------------------------------------+
| BOTTOM ROW: ALL CONFIGURED COGNITIVE TASK MODULES (Adapts to 3 / 6 / 7 / 8 / 10 Dimensions)      |
| [Filter: All (7) | Priority Hatched / Unassessed | Solid Calibrated (≥60%)]                      |
| +-----------------------+ +-----------------------+ +-----------------------+ +----------------+ |
| | ● WM · Working Memory | | ■ IC · Inhibition     | | ▲ CF · Set-Shifting   | | ◆ AN · Attent. | |
| | Dual-Stream N-Back    | | Color-Word Stroop     | | Rule-Switch N-Back    | | Peripheral Cue | |
| | Lvl 3 · 68% ± 5%      | | Lvl 3 · 75% ± 6%      | | Lvl 4 · 82% ± 7%      | | Lvl 4 · 89%±5% | |
| | [Launch Task →]       | | [Launch Task →]       | | [Launch Task →]       | | [Launch Task →]| |
| +-----------------------+ +-----------------------+ +-----------------------+ +----------------+ |
+--------------------------------------------------------------------------------------------------+
```

### Mobile (`375 px` — Single-Column Priority Stack)
```text
+---------------------------------------+
| [ST] SynapseTwin   [7 Dims] [Theme]   |
+---------------------------------------+
| ASSESSMENT HUB HEADER & MODE SWITCHER |
+---------------------------------------+
| 1. #1 PRIORITY CALIBRATION BLOCK      |
|    (+ Launch CTA to /task/:dimId)     |
+---------------------------------------+
| 2. WHY THIS QUEUE? (<WhyThisPanel />) |
+---------------------------------------+
| 3. ENGINE SAFEGUARDS & CONTRACT CARD  |
+---------------------------------------+
| 4. FILTERABLE DIMENSION TASK CARDS    |
|    (3 / 6 / 7 / 8 / 10 Dimensions)    |
+---------------------------------------+
```

---

## Content and copy deck
- **Hero Eyebrow**: `★ Layer A · Adaptive Psychometric Assessment Hub`
- **Hero Headline (`<h1>`)**: `Calibrate your cognitive twin—2-minute adaptive micro-tasks with zero biometric tracking.`
- **Hero Subcopy**: `Every micro-block uses Bayesian QUEST+ and 85%-accuracy staircase scheduling to narrow your 95% confidence intervals (±CI) in under 120 seconds—using only reaction timing, error-burst recovery, and hesitation jitter.`
- **Session Mode Selector**:
  1. `Priority Calibration Queue (2 Min · Recommended)`: Targets the lowest-confidence hatched or unassessed dimension first.
  2. `Full 360° Sweep (5 Min · 3 Trials / Dim)`: Sweeps across all active dimensions in `DimensionRegistry`.
  3. `Evaluator Sandbox (Untimed Task Preview)`: Lets judges inspect any task schema (`n_back`, `stroop`, `ufov`, `mst`, `matrix`, `relational`, `tower`, `mental_rotation`) directly.

---

## States: loading, empty, partial, error, offline, low confidence
- **Calibrated (`steady-improver`)**: Prioritizes Youssef's 1 remaining hatched dimension (`Episodic Pattern Separation · 48% Conf`) while allowing maintenance blocks on the 6 solid dimensions.
- **Low Confidence (`noisy-low-confidence`)**: Prioritizes Salma's 4 hatched dimensions with a **Rest-First Pacing** recommendation and `<Mascot state="rest" />`.
- **Partial (`edge-missing-dim`)**: Places the unassessed dimension (`Divided Perceptual Speed · 0 trials`) at `#1` in the calibration queue (`"Unassessed — 90s block required"`).
- **Empty (`new-user`)**: Shows Nour's fresh 0-trial baseline queue across all configured dimensions.
- **Loading (`loading`)**: Accessible skeleton (`role="status"`, `aria-label="Loading assessment task queue"`).
- **Error (`error`)**: Simulated `GET /v1/tasks/next` timeout (`role="alert"`) with 1-click deterministic local queue fallback.
- **Extreme Values (`extreme-text`)**: Stress-tests 10 dimensions and high-trial counts at `375 px` with zero horizontal overflow.

---

## Interactions and motion (with the reduced-motion variant)
- **Session Mode Switcher**: Switches between `Priority Queue (2 Min)`, `Full 360° Sweep (5 Min)`, and `Evaluator Sandbox`.
- **Dimension Filter Tabs**: Filters the task grid by `All Dimensions`, `▨ Priority Hatched / Unassessed`, or `● Solid Calibrated (≥60%)`.
- **Live `GET /v1/tasks/next` JSON Payload Inspector**: Expands the exact staircase parameter vector (`level`, `targetAccuracy: 0.85`, `schemaType`, `maxTrials`) for the queued task.
- **Direct Launch to `/task/:dimId`**: Every task card links directly to `/task/:dimId` (Page 04 Task Runner).

---

## Data contract (types) and the mock fixtures used
- **`DimensionConfig[]`** & **`DimensionEstimate[]`** from `getDimensionsByPreset(dimensionPreset)` and `buildEstimatesForDimensions(activeDimensions, activePersona)`.
- **`NextTaskRecommendation`** payload mirroring `GET /v1/tasks/next` in `docs/ui/contracts.md`.
- **`WhyThisTrail`** (`SAMPLE_WHY_THIS_TRAIL`).

---

## Accessibility notes: focus order, labels, chart table alternative
- Includes a 1-click **"View Task Queue as Table"** toggle so screen-reader and keyboard users can inspect all configured task modules, their staircase levels, schema types, $\pm\text{CI}$ ranges, and confidence statuses in a semantic `<table>`.
- Every task card pairs its Okabe-Ito color token with its unique geometric vertex glyph (`●`, `■`, `▲`, `◆`, `⬠`, `⬢`, `★`, `✚`, `◎`, `⧗`) and explicit confidence badge.

---

## Acceptance checklist (from the Definition of Done)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (`steady-improver`, `noisy-low-confidence`, `edge-missing-dim`, `new-user`, `loading`, `error`, `extreme-text`) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs` ($\ge 4.5:1$ text, $\ge 3.0:1$ UI/marks).
- [x] Complete keyboard navigation, `3px` focus ring, logical tab order, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected.
- [x] Color never carries meaning alone.
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy` — `AssessmentHubPage` chunk `23.30 kB`, `6.39 kB` gzipped).
- [x] Unit/component tests (`9/9` pass in `designSystem.test.tsx`) + Playwright `axe-core` check (`0` violations across Light, Dark, and 10-Dim Table states).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions.
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Decisions and known issues
- **Decisions**: Link every dimension task card directly to `/task/:dimId` so **Page 04 (`Task Runner · HERO`)** seamlessly receives the selected dimension and staircase parameters.
- **Critique Round 1 (Picky Designer)**:
  1. Added explicit `GET /v1/tasks/next` and `POST /v1/telemetry/event` contract summary boxes inside the **Scheduler & Telemetry Contracts** card so the 7-column left stack and 5-column right stack align cleanly at the bottom edge on `1440 px`.
  2. Verified `0` horizontal overflow at `375 px` and `768 px`.
- **Critique Round 2 (Hostile Juror)**:
  1. Verified the 1-click **"View Task Queue as Table"** semantic `<table>` alternative and explicit **Known Measurement Biases** card per dimension.
- **Known Issues**: None.

---

## Screenshots (paths) and commit hashes
- `docs/ui/screenshots/03-assessment-hub-1440.png`
- `docs/ui/screenshots/03-assessment-hub-768.png`
- `docs/ui/screenshots/03-assessment-hub-375.png`
- `docs/ui/screenshots/03-assessment-hub-10dims-table-1440.png`
- `docs/ui/screenshots/03-assessment-hub-dark-1440.png`
