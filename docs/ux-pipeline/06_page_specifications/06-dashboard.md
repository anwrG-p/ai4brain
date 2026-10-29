# 06. Dashboard (`/dashboard`) · HERO PAGE

## Purpose, user moment, rubric criteria
- **Purpose**: The central command center of **SynapseTwin** (Layer C + Brain Twin + Layer B summary + 0–100 Collaboration Score), uniting the `<UncertaintyRadar />`, the longitudinal **Growth & Uncertainty Fan Chart** (`<ProjectionFanChart />`), the **Session Fatigue & Time-of-Day Heatmap**, the **AI Collaboration Score Summary Card**, and today's top **Explainable AI Coach Insight** (`<WhyThisPanel />`) on a disciplined, scannable 12-column grid.
- **User / Evaluator Moment**: The flagship screen of the demo video (`0:45–1:45`) and the primary destination when a judge clicks **"Load Youssef (Calibrated Twin)"** or **"Load Salma (Hatched Twin)"**. Must survive a freeze-frame with zero visual clutter and maximum rubric density.
- **Rubric Criteria Served**:
  - **Relevance (Phase 1 — 12%)**: Shows the multi-dimensional radar, growth/uncertainty fan curves, session fatigue heatmap, active goals, and 0–100 AI Collaboration Score in one coherent view.
  - **Innovation & Profile Quality (Phase 1 — 12% & Phase 2 — 8%)**: Combines **Signature #1 (`<UncertaintyRadar />`)**, **Signature #3 (`<WhyThisPanel />`)**, **Signature #4 (`<ProjectionFanChart />`)**, and **Signature #5 (`<CollaborationScoreCard />` preview)** with honest $\pm\text{CI}$ confidence bands and low-confidence hatching.
  - **Generalisation (Phase 2 — 10%)**: Dimension cards, radar vertices, and growth curves dynamically adapt to `3 | 6 | 7 | 8 | 10` dimensions without layout shifts.
- **Time Budget**: `4 hours` (+50% alert threshold: `6 hours`).

---

## Wireframes: desktop, mobile

### Desktop (`1440 px` — 12-Column Asymmetric Command Grid)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · CISTAC 1.0     [Simulated Data]    [3|6|7|10 Dims] [Dark/Light] [Style Guide] |
+--------------------------------------------------------------------------------------------------+
| DASHBOARD HEADER BAR + PERSONA / STATE SWITCHER                                                  |
| [★ Active Twin: Youssef · Steady Improver] [Overall Confidence: 84%] [Collab Score: 82 ± 4]      |
| [Persona: Steady Improver | Noisy Hatched | Partial | New User | Loading | Error | Extreme]      |
+---------------------------------------------------+----------------------------------------------+
| LEFT (5 cols): SIGNATURE #1 UNCERTAINTY RADAR     | RIGHT (7 cols): SIGNATURE #4 GROWTH &        |
| +-----------------------------------------------+ | UNCERTAINTY FAN CHART + COACH SPOTLIGHT      |
| | Multi-Dimensional Brain Twin Radar            | | +------------------------------------------+ |
| | [Hatched = Conf < 60%]        [View as Table] | | | 6-Week Trajectory & 2-Week Projection    | |
| |                                               | | | [Dim Filter: All / WM / IC / CF...]      | |
| |              ( Uncertainty Radar )            | | |   90% |          ..../======\            | |
| |         ● WM 68%±5%      ■ IC 75%±6%          | | |   75% |    o---o-----o (Observed + CI)   | |
| |         ⬢ EP 81%±16% (Hatched)                | | |   60% |_________________________________ | |
| |                                               | | |       W1   W2   W3   W4   W5   W6  +2Wk  | |
| +-----------------------------------------------+ | | [View Trajectory Table]                  | |
|                                                   | +------------------------------------------+ |
| +-----------------------------------------------+ | +------------------------------------------+ |
| | Companion Guide Slot (data-mascot-slot)       | | | Today's Priority AI Coach Insight        | |
| | Contextual encouragement + next micro-block   | | | <WhyThisPanel /> (5-Part Reasoning Trail)| |
| +-----------------------------------------------+ | +------------------------------------------+ |
+---------------------------------------------------+----------------------------------------------+
| MIDDLE ROW: DIMENSION CARDS GRID (Adapts dynamically to 3 / 6 / 7 / 8 / 10 Dimensions)           |
| +-----------------------+ +-----------------------+ +-----------------------+ +----------------+ |
| | ● WM · Working Memory | | ■ IC · Inhibition     | | ▲ CF · Set-Shifting   | | ◆ AN · Attent. | |
| | 68% ± 5%  [↑ Rising]  | | 75% ± 6%  [→ Stable]  | | 82% ± 7%  [↑ Rising]  | | 89% ± 5%       | |
| | Conf: 86% (Solid)     | | Conf: 82% (Solid)     | | Conf: 79% (Solid)     | | Conf: 88%      | |
| +-----------------------+ +-----------------------+ +-----------------------+ +----------------+ |
+---------------------------------------------------+----------------------------------------------+
| BOTTOM ROW (7 cols): SESSION FATIGUE &            | BOTTOM RIGHT (5 cols): 0–100 COLLABORATION   |
| TIME-OF-DAY PERFORMANCE HEATMAP                   | SCORE RUBRIC & ACTIVE WEEKLY GOAL            |
| +-----------------------------------------------+ | +------------------------------------------+ |
| | Alertness & RT Stability by Window × Day      | | | AI Collaboration Score: 82 / 100 (± 4)   | |
| |          Mon  Tue  Wed  Thu  Fri  Sat  Sun    | | | • Clarification (20%): 86                | |
| | Morning  [88] [91] [89] [92] [87] [90] [—]    | | | • Verification  (25%): 84                | |
| | Afternoon[76] [79] [74] [81] [77] [—]  [—]    | | | • Iteration     (20%): 78                | |
| | Evening  [62] [58] [64] [55] [60] [72] [75]   | | | • Autonomy      (20%): 80                | |
| | [View Heatmap as Table]                       | | | • Resp. Use     (15%): 81                | |
| +-----------------------------------------------+ | +------------------------------------------+ |
+---------------------------------------------------+----------------------------------------------+
```

### Mobile (`375 px` — Single-Column Priority Stack)
```text
+---------------------------------------+
| [ST] SynapseTwin   [7 Dims] [Theme]   |
+---------------------------------------+
| ACTIVE TWIN SUMMARY & PERSONA BAR     |
| [Youssef · 84% Conf] [Collab: 82 ± 4] |
+---------------------------------------+
| 1. UNCERTAINTY RADAR (+ Table Toggle) |
+---------------------------------------+
| 2. TODAY'S PRIORITY AI COACH INSIGHT  |
|    (<WhyThisPanel /> expandable)      |
+---------------------------------------+
| 3. 6-WEEK GROWTH & FAN PROJECTION     |
|    (+ Table Toggle)                   |
+---------------------------------------+
| 4. DIMENSION CARDS (3/6/7/8/10 Dims)  |
+---------------------------------------+
| 5. SESSION FATIGUE HEATMAP (+ Table)  |
+---------------------------------------+
| 6. 0–100 AI COLLABORATION SCORE CARD  |
+---------------------------------------+
```

---

## Content and copy deck
- **Page Header**:
  - Eyebrow: `★ Cognitive Growth Command Center · Layer C + Brain Twin`
  - Headline (`<h1>`): `Your evolving cognitive twin—live confidence bands, trajectory fan, and explainable coaching.`
  - Subcopy: `Every score is an evolving percentage estimate with a 95% confidence interval (±CI). Dimensions below 60% confidence are diagonally hatched until 2 more micro-blocks are logged.`
- **KPI Summary Pills**:
  - `Overall Twin Confidence: 84% (Calibrated)` (or `52% (Preliminary · Hatched)` for Salma)
  - `AI Collaboration Score: 82 ± 4 / 100`
  - `SAT-JEPA Archetype: Analytical Synthesizer (Stable 4 Weeks)`
  - `Peak Cognitive Window: Morning (08:00–12:00 · -48 ms RT advantage)`

---

## States: loading, empty, partial, error, offline, low confidence
- **Calibrated (`steady-improver`)**: Youssef's 6-week calibrated profile (6 solid dimensions + 1 hatched Episodic Pattern Separation dimension).
- **Low Confidence (`noisy-low-confidence`)**: Salma's irregular-schedule profile with 4 hatched dimensions (`< 60%` confidence) and rest-first coaching recommendation.
- **Partial (`edge-missing-dim`)**: Profile where Divided Perceptual Speed (`PS`) has `0` trials (`scorePct: null`), demonstrating graceful unassessed-dimension handling across the radar, dimension cards, and growth chart.
- **Empty (`new-user`)**: Nour's 0-trial empty state with a clear CTA to start the 2-Minute Quick Baseline (`/onboarding`).
- **Loading (`loading`)**: Accessible skeleton placeholders (`role="status"`, `aria-label="Loading dashboard telemetry"`).
- **Error (`error`)**: Simulated `/v1/dashboard/profile` fetch error (`role="alert"`) with 1-click retry recovery.
- **Extreme Values (`extreme-text`)**: High-magnitude telemetry stress test (`99.9% ± 0.1%`, `14,280 trials`, long dimension labels) verifying zero horizontal overflow at `375 px`.
- **Offline & LLM-Down**: Respects global `<AppShell />` banners and badges cached local twin snapshots.

---

## Interactions and motion (with the reduced-motion variant)
- **Persona & State Switcher Bar**: Evaluators can switch instantaneously between `Steady Improver (Youssef)`, `Low-Conf Hatched (Salma)`, `Partial (1 Missing Dim)`, `Empty (New Learner)`, `Loading`, `Error`, and `Extreme Values` right from the Dashboard header.
- **Signature #4 `<ProjectionFanChart />` Dimension Selector & Table Toggle**: Users can switch the 6-week historical + 2-week projected fan chart across any active dimension (or view the composite twin index) and toggle `"View Trajectory as Table"`.
- **Session Fatigue Heatmap Table Toggle**: Includes a 1-click `"View Heatmap as Table"` button so screen-reader and keyboard users can inspect Morning/Afternoon/Evening alertness and reaction-time stability as a semantic `<table>`.
- **Mascot Slot**: Includes `data-mascot-slot="dashboard-companion"` ready for the Mascot Sprint immediately after Page 05 (`Profile Reveal`).

---

## Data contract (types) and the mock fixtures used
- **`DimensionConfig[]`** & **`DimensionEstimate[]`** from `getDimensionsByPreset(dimensionPreset)` and `buildEstimatesForDimensions(activeDimensions, activePersona)`.
- **`HistoricalTrajectoryPoint[]`**: 6 observed weekly snapshots (`W1`–`W6`) + 2 projected future weeks (`+1 Wk`, `+2 Wk`) with widened uncertainty fan (`lowerCiPct`, `upperCiPct`, `isProjected`).
- **`FatigueHeatmapCell[]`**: `3 windows (Morning, Afternoon, Evening) × 7 days (Mon–Sun)` with `readinessPct`, `meanRtMs`, `errorBurstRate`, and non-color status glyph (`● Optimal`, `◐ Moderate`, `▲ High Fatigue`).
- **`CollaborationScorePayload`** (`SAMPLE_COLLABORATION_SCORE`) & **`WhyThisTrail`** (`SAMPLE_WHY_THIS_TRAIL`).

---

## Accessibility notes: focus order, labels, chart table alternative
- **Accessible Table Alternatives for Every Chart**:
  1. `<UncertaintyRadar />`: `"View as Table"` toggle.
  2. `<ProjectionFanChart />`: `"View Trajectory as Table"` toggle.
  3. `<FatigueHeatmap />`: `"View Heatmap as Table"` toggle.
- **Color Independence**:
  - Dimension cards use geometric vertex glyphs (`●`, `■`, `▲`, `◆`, `⬠`, `⬢`, `★`, `✚`, `◎`, `⧗`) + explicit trend arrows (`↑ Rising`, `→ Stable`, `↓ Needs Rest`) + confidence badges (`Solid` vs `▨ Hatched <60%`).
  - Fatigue heatmap cells print the exact numerical readiness score (`e.g., 91%`) AND status symbol (`●`, `◐`, `▲`) inside every cell so color never carries meaning alone.

---

## Acceptance checklist (from the Definition of Done)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (`steady-improver`, `noisy-low-confidence`, `edge-missing-dim`, `new-user`, `loading`, `error`, `extreme-text`, `offline`) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs` ($\ge 4.5:1$ text, $\ge 3.0:1$ UI/marks).
- [x] Complete keyboard navigation, `3px` focus ring, logical tab order, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected.
- [x] Color never carries meaning alone (vertex glyphs, trend arrows, cell numbers/glyphs, table toggles).
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy` — `DashboardPage` chunk `26.20 kB`, `7.20 kB` gzipped).
- [x] Unit/component tests (`7/7` pass in `designSystem.test.tsx`) + Playwright `axe-core` check (`0` violations in Light and Dark themes).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions.
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Decisions and known issues
- **Decisions**: Built **Signature #4 (`<ProjectionFanChart />`)** and **`<FatigueHeatmap />`** as reusable, accessible components in `frontend/src/components/signature/` so they can also be embedded on Page 07 (`Dimension Detail`) and Page 08 (`Brain Twin Timeline`).
- **Critique Round 1 (Picky Designer)**:
  1. Added the **SAT-JEPA Latent Twin State & Hysteresis** card (`Cluster C5 · 3/3 Sessions Stable`, `Prototype Δc`, `Hysteresis Lock Confirmed`) in the left column of Row 1 so the 5-column left stack and 7-column right stack align cleanly at the bottom edge on `1440 px`.
  2. Updated `Badge.tsx` (`max-w-full whitespace-normal sm:whitespace-nowrap text-start leading-snug sm:leading-none`) and added `min-w-0` on `<main>` and header wrappers so long badges wrap gracefully at `375 px` without clipping.
- **Critique Round 2 (Hostile Juror)**:
  1. Verified that every chart on `/dashboard` (`<UncertaintyRadar />`, `<ProjectionFanChart />`, and `<FatigueHeatmap />`) has a 1-click accessible semantic `<table>` toggle (`"View as Table"`, `"View Trajectory as Table"`, `"View Heatmap as Table"`).
  2. Verified explicit `"Design proposal, not validated"` badge and formula printout (`S_collab = 0.20·Clarification + 0.25·Verification + 0.20·Iteration + 0.20·Autonomy + 0.15·ResponsibleUse`) on the 0–100 AI Collaboration Score card.
- **Known Issues**: None.

---

## Screenshots (paths) and commit hashes
- `docs/ui/screenshots/06-dashboard-1440.png`
- `docs/ui/screenshots/06-dashboard-768.png`
- `docs/ui/screenshots/06-dashboard-375.png`
- `docs/ui/screenshots/06-dashboard-tables-partial-1440.png`
- `docs/ui/screenshots/06-dashboard-dark-1440.png`
