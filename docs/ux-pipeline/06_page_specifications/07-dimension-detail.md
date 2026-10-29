# Page 07 — Dimension Detail (`/dimensions/:dimId`) Specification

- **Page Name & Route**: Dimension Detail (`/dimensions/:dimId`, defaulting to `/dimensions/working-memory` or any active `DimensionRegistry` ID)
- **Wave & Priority**: Wave 2 · **Must** (`P1` Deep-Dive & Scientific Transparency Proof)
- **Branch**: `ui/page-07-dimension-detail`

---

## 1. Purpose, Audience & Primary Job
- **Purpose**: Provide a complete scientific, psychometric, and telemetry deep dive for any single cognitive dimension `:dimId` across all `3/6/7/8/10` registry presets—connecting its behavioral task paradigm, explicit scoring formula, 4-week `<ProjectionFanChart />` trajectory, session-by-session trial log, and known measurement biases.
- **Audience**:
  - **Jury (Phase 1 & Phase 2)**: Evaluates **Profile Quality (8%)**, **Relevance (12%)**, **Explainability (9%)**, **Safety (6%)**, and **Generalisation (10%)** by inspecting the exact psychometric scoring formula, QUEST+ posterior intervals, diagonal SVG hatching when confidence $< 60\%$, and honest ecological validity limits.
  - **Learner / Participant**: Understands *what* a dimension measures in everyday study/work, *why* its confidence interval is wide or narrow, and *how* to calibrate or train it in 90 seconds.
- **Primary Job**: Let the user inspect any of the `3/6/7/8/10` cognitive dimensions via 1-click dimension pills, view its dimension-filtered `<ProjectionFanChart />`, inspect the session-by-session QUEST+ trial log, read its explicit **Known Measurement Biases & Non-Clinical Boundaries**, and launch a targeted micro-block (`/task/:dimId`) or ask the AI Coach (`/coach`).

---

## 2. Rubric Criteria Served
- **Relevance (12% final)** — Connects Layer A behavioral task telemetry (`RT`, `jitter`, `lure_false_alarm`) to Layer C longitudinal curves (`<ProjectionFanChart />`) and Layer B adaptive recommendations.
- **Profile Quality (8% final)** — Displays current percentile estimate (`scorePct`), 95% Bayesian credible interval (`±CI%`), epistemic confidence (`0–100%`), diagonal SVG hatching status (`< 60%` confidence), and QUEST+ posterior entropy.
- **Explainability (9% final)** — Embeds Signature #3 `<WhyThisPanel />` explaining the current dimension estimate, staircase level, and counterfactual calibration path.
- **Safety & Ethics (6% final)** — Dedicates an explicit **Known Measurement Biases & Ecological Validity Limits** card to every dimension (e.g., circadian sleep debt, caffeine, keyboard/touch input latency, practice effects) so learners never confuse task telemetry with clinical diagnosis.
- **Generalisation (10% final)** — Dynamically renders any dimension from `DimensionRegistry` (`3, 6, 7, 8, or 10` dimensions), including stress-test dimensions (`Mental Spatial Rotation`, `Metacognitive Calibration`, `Sustained Vigilance Stability`).

---

## 3. ASCII Wireframe (`1440 px` Desktop & `375 px` Mobile)

### Desktop (`1440 px`, 12-Column Grid)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · Simulated Data   [3 Dims][6 Dims][7 Dims][10 Dims]  [Theme] [Motion] [Nav...] |
+--------------------------------------------------------------------------------------------------+
| [◆ Dimension Deep Dive · Psychometric & Telemetry Inspector] [● Confidence: 84% (Solid Band)]    |
| ● WM · Working Memory (Dual-Stream N-BackUpdating)            [Launch 90s WM Block ->] [Ask Coach]|
| Dimension Switcher (7 Active): [● WM] [■ IC] [▲ CF] [◆ AN] [⬟ PS] [⬢ EP ⚡] [★ VP]               |
| Persona: [Youssef][Salma][Rami][Partial][10-Dim] | State: [1·Converged][2·Hatched (<60%)][Load..] |
+---------------------------------------------------------+----------------------------------------+
| LEFT 7 COLUMNS: Trajectory & Session Calibration Log    | RIGHT 5 COLUMNS: Formula, Biases & Why |
| +-----------------------------------------------------+ | +------------------------------------+ |
| | 4-Week Dimension Trajectory (<ProjectionFanChart />) | | | Psychometric Scoring & QUEST+ Spec | |
| | [ SVG Fan Chart filtered to :dimId + 50/80/95% CI ] | | | Paradigm: Dual-Stream N-Back       | |
| | [ View Trajectory as Table ]                        | | | Formula: θ_i = w_acc·A - w_rt·z_RT | |
| +-----------------------------------------------------+ | | Prior Entropy: 1.42 bits -> 0.38 b | |
| +-----------------------------------------------------+ | +------------------------------------+ |
| | Session-by-Session Trial & Staircase Log (n=6)      | | +------------------------------------+ |
| | [ Semantic <table>: Session | Staircase | RT | CI ] | | | Known Measurement Biases & Limits  | |
| | #06 | Lvl 4 | 548 ms (±38 ms) | 91% acc | ±5% CI    | | | • Sleep debt & circadian trough    | |
| | #05 | Lvl 3 | 562 ms (±42 ms) | 89% acc | ±6% CI    | | | • Input device motor latency       | |
| +-----------------------------------------------------+ | | • Practice familiarity ceiling     | |
|                                                         | +------------------------------------+ |
|                                                         | +------------------------------------+ |
|                                                         | | ? 5-Part Reasoning (<WhyThisPanel>)| |
|                                                         | +------------------------------------+ |
+---------------------------------------------------------+----------------------------------------+
```

### Mobile (`375 px`, Single-Column Stack)
```text
+---------------------------------------+
| [ST] SynapseTwin        [Theme][Menu] |
+---------------------------------------+
| [◆ Dimension Deep Dive]               |
| ● WM · Working Memory                 |
| [Launch 90s Block ->] [Ask Coach ->]  |
| Switcher: [● WM][■ IC][▲ CF][⬢ EP ⚡]  |
+---------------------------------------+
| 4-Week Dimension Trajectory (SVG)     |
| [ View Trajectory as Table ]          |
+---------------------------------------+
| Session-by-Session Trial Log (Table)  |
+---------------------------------------+
| Psychometric Scoring & QUEST+ Spec    |
+---------------------------------------+
| Known Measurement Biases & Limits     |
+---------------------------------------+
| ? 5-Part Reasoning (<WhyThisPanel />) |
+---------------------------------------+
```

---

## 4. Component Tree & Props
- **`DimensionDetailPage`** (`frontend/src/pages/DimensionDetailPage.tsx`)
  - **Dimension Header & 1-Click Registry Switcher (`Card`)**:
    - Active dimension badge (`markerGlyph`, `code`, `name`, `shortLabel`), current score (`scorePct% ± halfCi%`), confidence badge (`Solid Band >=60%` vs `Hatched <60%`), and 1-click dimension pills for all active dimensions in `DimensionRegistry` (`3/6/7/8/10`).
    - Judge persona & state toolbar (`converged`, `low-confidence-hatched`, `loading`, `empty`, `error`, `extreme-text`).
  - **Left 7-Column Stack**:
    - **Card L1 — Dimension-Filtered 4-Week Trajectory (`<ProjectionFanChart />`)**:
      - Renders **Signature #4 `<ProjectionFanChart />`** locked to the active `:dimId` with `50% / 80% / 95%` credible fans, rest-day annotation, and built-in `"View as Table"` toggle.
    - **Card L2 — Session-by-Session Trial & QUEST+ Calibration Log**:
      - Accessible semantic `<table>` showing the last 6 micro-block sessions for `:dimId` (Session ID, Staircase Level `1–5`, Normalized Median RT `ms`, Hesitation Jitter `ms`, Accuracy `%`, and Posterior `±CI%`), plus a `"View Raw Telemetry Summary JSON"` toggle.
  - **Right 5-Column Stack**:
    - **Card R1 — Psychometric Paradigm, Scoring Formula & Everyday Transfer**:
      - Displays the behavioral task paradigm, explicit mathematical scoring equation ($\hat{\theta}_i = \sigma(w_{\text{acc}} \cdot \text{Acc}_i - w_{\text{rt}} \cdot z_{\text{RT},i} - w_{\text{jit}} \cdot \text{Jitter}_i)$), QUEST+ adaptive step rule, and concrete everyday study/work transfer examples.
    - **Card R2 — Known Measurement Biases & Non-Clinical Boundaries**:
      - Lists 3 dimension-specific measurement confounders (e.g., hardware input latency, time-of-day alertness trough, strategy familiarity) and an explicit non-clinical boundary statement.
    - **Card R3 — Embedded Signature #3 `<WhyThisPanel />`**:
      - 5-part reasoning trail (*Observed Telemetry*, *SAT-JEPA Inference*, *Adaptive Advice*, *Confidence*, *Counterfactual*) specific to `:dimId`.

---

## 5. Tokens Used
- **Surfaces & Canvas**: `bg-canvas`, `bg-surface`, `bg-surface-raised`, `bg-brand-subtle`, `bg-reward-subtle`, `bg-warning-subtle`, `bg-danger-subtle`.
- **Ink & Borders**: `text-ink`, `text-ink-muted`, `border-border`, `border-border-strong`.
- **Dimension Accent Tokens**: `--color-dim-1` through `--color-dim-10` via `DimensionConfig.colorToken` + distinct non-color `markerGlyph` (`●`, `■`, `▲`, `◆`, `⬟`, `⬢`, `★`, `✚`, `◐`, `⧗`).
- **Typography**: `font-display` (`Fredoka`), `font-sans` (`Lexend`), `font-mono-tabular` (`JetBrains Mono` for formulas, RT milliseconds, and CI bounds).

---

## 6. Interactive States & Edge States
1. **`converged` (Default)**: Shows the selected dimension (defaulting to `:dimId` URL param or `working-memory`) with solid confidence (`>= 60%`), 4-week `<ProjectionFanChart />`, 6-session trial history, psychometric formula, and `<WhyThisPanel />`.
2. **`low-confidence-hatched` (`2 · ⚡ Hatched (<60% CI)`)**: Switches to a low-confidence dimension (`episodic-pattern` at `48%` confidence, `±16% CI`) or simulates a newly added dimension (`n = 4` trials), displaying an explicit **Epistemic Uncertainty Alert (Diagonal Hatching Active)** banner explaining why 2 more micro-blocks are needed before solid graduation.
3. **`loading`**: Accessible skeleton (`role="status"`) while fetching dimension telemetry and QUEST+ posterior history.
4. **`empty`**: Cold-start uncalibrated dimension state (`0` trials logged for this dimension) with a 1-click CTA to launch its first 90-second baseline block.
5. **`error`**: Recoverable `GET /v1/dashboard/profile?dimension=:dimId` timeout alert (`role="alert"`) with 1-click cached snapshot recovery.
6. **`extreme-text`**: Stress-tests long multi-clause psychometric paradigm titles, formula annotations, and 10-dimension switcher wrapping without horizontal overflow.

---

## 7. Data Contract (`GET /v1/dashboard/profile` + Dimension Metadata)

```json
{
  "dimension_id": "working-memory",
  "code": "WM",
  "name": "Working Memory",
  "paradigm": "Dual-Stream N-Back Updating (2-Back / 3-Back Adaptive)",
  "scoring_formula": "theta_WM = sigmoid(0.55 * d_prime - 0.30 * z_RT - 0.15 * jitter_norm)",
  "estimate": {
    "score_pct": 68,
    "ci_lower_pct": 63,
    "ci_upper_pct": 73,
    "confidence": 0.84,
    "hatched": false,
    "trials_count": 24
  },
  "known_biases": [
    "Keyboard vs. touch-screen motor latency (+18–35 ms shift)",
    "Acute sleep debt or post-lunch circadian dip (14:00–16:00)",
    "Chunking strategy familiarity during initial 3 sessions"
  ]
}
```

---

## 8. Accessibility Plan (WCAG 2.1 AA)
- **Dimension Switcher**: `role="group" aria-label="Select cognitive dimension to inspect"` with `aria-pressed` on each dimension button and non-color glyph prefix (`●`, `■`, `▲`, etc.).
- **Fan Chart & Trial Log Table**: `<ProjectionFanChart />` provides an accessible SVG summary and a 1-click **"View as Table"** semantic `<table>` fallback; the Session-by-Session Trial Log is a native semantic `<table>` with `<th scope="col">`.
- **Keyboard & Focus**: `3px` high-visibility focus rings (`focus-ring`) and $\ge 44 \times 44\text{ px}$ hit targets.
- **Scrollable JSON Inspector**: Includes `tabIndex={0} role="region" aria-label="..."` for keyboard scrollability.

---

## 9. Copy & Tone Table
| Location | Approved Copy | Prohibited Framing Avoided |
| :--- | :--- | :--- |
| **Header Subtitle** | *"Inspect how behavioral task telemetry maps to your QUEST+ confidence interval, 4-week projection fan, and everyday study habits."* | Avoids clinical diagnostic or IQ test language. |
| **Hatched (`<60%`) Banner** | *"Diagonal SVG Hatching Active — Only 4 trials logged so far (48% confidence, ±16% CI). One 90-second calibration block will narrow this band."* | Avoids "Deficit", "Poor score", or "Failed dimension". |
| **Biases Card** | *"Task scores reflect moment-in-time behavioral telemetry—not fixed intelligence or clinical status. Sleep, device latency, and familiarity all shift RT."* | Avoids medical/neurological overclaiming. |

---

## 10. Per-Page Definition of Done (DoD Checklist)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (`converged`, `low-confidence-hatched`, `loading`, `empty`, `error`, `extreme-text`) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs` ($\ge 4.5:1$ text, $\ge 3.0:1$ UI/marks).
- [x] Complete keyboard navigation, `3px` focus ring, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected.
- [x] Color never carries meaning alone.
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy`).
- [x] Unit/component tests + Playwright `axe-core` check (`0` violations).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions.
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Visual Critique Log (Rounds 1 & 2)
- **Round 1 Critique**:
  - *Observation 1*: `<ProjectionFanChart />` subtitle and legend rendered literal markdown backticks around `+1 Wk` and `+2 Wk`, and the `View Trajectory as Table` / `View Telemetry JSON` buttons wrapped onto a second line inside the 7-column card headers.
  - *Fix 1*: Replaced literal backticks in `ProjectionFanChart.tsx` with `<code className="font-mono-tabular">` elements, promoted `<ProjectionFanChart />`'s heading to `<h2>` for strict `h1 -> h2` semantic hierarchy, and added `sm:flex-nowrap` with `shrink-0` on the card header action buttons.
- **Round 2 Critique**:
  - *Observation*: Session-by-Session Trial Log accuracy values (`76%`) were slightly below the `85%` QUEST+ staircase target described in the formula card, and the mobile table wrapper needed keyboard focusability (`tabIndex={0} role="region"`).
  - *Fix*: Calibrated `buildSessionHistory()` accuracy progression (`84%` to `91%`) to match the QUEST+ staircase target and added `tabIndex={0} role="region" aria-label="Session calibration log scrollable container"` to the table scroll wrapper (`0` `axe-core` violations across all viewports).

---

## 11. Decisions, Known Issues & Screenshots
- **Decisions**: Include a 1-click **Dimension Switcher Bar** at the top of `/dimensions/:dimId` so users and judges can switch across all `3/6/7/8/10` active dimensions in place (updating the route parameter and all charts/formulas/tables immediately).
- **Known Issues**: None.
- **Screenshots**:
  - `docs/ui/screenshots/07-dimension-detail-1440.png`
  - `docs/ui/screenshots/07-dimension-detail-hatched-10dims-1440.png`
  - `docs/ui/screenshots/07-dimension-detail-dark-1440.png`
  - `docs/ui/screenshots/07-dimension-detail-768.png`
  - `docs/ui/screenshots/07-dimension-detail-375.png`
