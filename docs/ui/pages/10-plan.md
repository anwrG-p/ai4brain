# Page 10 — Plan & Adaptive Exercises (`/plan`) Specification

> **Superseded (history).** This spec describes the page before brand v2. Now: `/plan` redirects to **Train**. Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

- **Page Name & Route**: Plan & Adaptive Exercises (`/plan`)
- **Wave & Priority**: Wave 2 · **Must** (`P1` Adaptive Training & Staircase Derivation)
- **Branch**: `ui/page-10-plan`

---

## 1. Purpose, Audience & Primary Job
- **Purpose**: Bridge the cognitive profile assessment (Layer A) and Brain Twin historical trajectory (Layer C) into an actionable, adaptive weekly training plan (Layer B) grounded in SAT-JEPA differential vectors ($\Delta c$) and Bayesian QUEST+ staircase calibration.
- **Audience**:
  - **Jury (Phase 1 & Phase 2)**: Evaluates **Plan Relevance (6%)**, **Explainability (9%)**, **Robustness (10%)**, and **Generalisation (10%)** by verifying that weekly sessions, task paradigms, and staircase levels (1–5) are mathematically derived from dimension uncertainty bands and fatigue signals, not arbitrary hardcoded schedules.
  - **Learner / Participant**: Receives a balanced, zero-guilt weekly routine (typically 3–4 micro-sessions of 3–5 minutes each) with proactive rest days, circadian-matched time windows, and instant 1-click launching into micro-blocks (`/task/:dimId`).
- **Primary Job**: Let the user view their current weekly adaptive schedule, filter by day or dimension, adjust difficulty staircase levels with instant counterfactual feedback, inspect the $\Delta c$ derivation matrix, and launch scheduled exercises.

---

## 2. Rubric Criteria Served
- **Plan Relevance (6% final)** — Demonstrates that every scheduled exercise directly addresses the learner's greatest information-gain dimension or maintenance target derived from $\Delta c$.
- **Explainability (9% final)** — Embeds Signature #3 `<WhyThisPanel />` detailing the 5-part rationale (*Observed Telemetry*, *SAT-JEPA Inference*, *Adaptive Advice*, *Confidence*, *Counterfactual*) for the weekly plan.
- **Robustness (10% final)** — Includes the **Rest-First Pacing Guard**: automatically flags high-fatigue states and suggests active recovery instead of punitive streak maintenance.
- **Generalisation (10% final)** — Adapts exercise distribution across `3, 6, 7, 8, or 10` dimensions from `DimensionRegistry` without layout clipping.
- **Safety & Ethics (6% final)** — Enforces non-clinical copy guidelines: no "prescriptions", no medical therapy claims, no guilt-driven streak warnings.

---

## 3. ASCII Wireframe (`1440 px` Desktop & `375 px` Mobile)

### Desktop (`1440 px`, 12-Column Grid)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · Simulated Data   [3 Dims][6 Dims][7 Dims][10 Dims]  [Theme] [Motion] [Nav...] |
+--------------------------------------------------------------------------------------------------+
| [★ Layer B Adaptive Curriculum] [● Active Plan: Week 7] [Δc Optimization: High Information Gain] |
| Adaptive Training Plan & Staircase Curriculum                                                    |
| Persona: [Youssef][Salma][Rami][Partial][10-Dim] | State: [1·Active Plan][2·Rest Pacing][Load..] |
+---------------------------------------------------------+----------------------------------------+
| LEFT 7 COLUMNS: Weekly Schedule & Exercise Cards        | RIGHT 5 COLUMNS: Staircase & Delta-c   |
| +-----------------------------------------------------+ | +------------------------------------+ |
| | Weekly Schedule Matrix (Mon - Sun Calendar Bar)     | | | SAT-JEPA Δc Priority Matrix        | |
| | [Mon ●] [Tue ◐] [Wed ☾] [Thu ●] [Fri ●] [Sat ☾] [Sun]| | | Dimension | Δc Need | Suggested Lvl| |
| | Active Day: Thursday (Focus: Working Memory)        | | | • EP (Hatched) : +16% Δc -> Lvl 2  | |
| +-----------------------------------------------------+ | | • WM (Focus)   : +8% Δc  -> Lvl 4  | |
| +-----------------------------------------------------+ | | • IC (Steady)  : +2% Δc  -> Lvl 3  | |
| | Prescribed Micro-Blocks for Thursday (2 Blocks)     | | +------------------------------------+ |
| | 1. Dual-Stream N-Back Updating                      | | +------------------------------------+ |
| |    Slot: Morning Peak (09:30) · Staircase Lvl 4     | | | Interactive Staircase Simulator    | |
| |    [Launch Micro-Block (90s) ->] [Inspect Dim]      | | | Level 1 [  ] Level 2 [  ] Lvl 4 [●]| |
| | 2. Color-Word Stroop Interference Cost              | | | Step Rule: 85% Acc + <110ms Jitter | |
| |    Slot: Afternoon Maintenance · Staircase Lvl 3    | | +------------------------------------+ |
| |    [Launch Micro-Block (90s) ->] [Inspect Dim]      | | +------------------------------------+ |
| +-----------------------------------------------------+ | | ? 5-Part Plan Reasoning (<WhyThis>)| |
|                                                         | +------------------------------------+ |
+---------------------------------------------------------+----------------------------------------+
```

### Mobile (`375 px`, Single-Column Stack)
```text
+---------------------------------------+
| [ST] SynapseTwin        [Theme][Menu] |
+---------------------------------------+
| [★ Layer B Adaptive Curriculum]       |
| Weekly Adaptive Plan                  |
| Switch Day: [Mon][Tue][Wed][Thu][Fri] |
+---------------------------------------+
| Prescribed Exercise Cards             |
| 1. Dual-Stream N-Back (Lvl 4)         |
|    [Launch Block ->]                  |
| 2. Stroop Conflict (Lvl 3)            |
|    [Launch Block ->]                  |
+---------------------------------------+
| SAT-JEPA Δc Priority Matrix (Table)   |
+---------------------------------------+
| Interactive Staircase Simulator       |
+---------------------------------------+
| ? 5-Part Plan Reasoning (<WhyThis />) |
+---------------------------------------+
```

---

## 4. Component Tree & Props
- **`PlanPage`** (`frontend/src/pages/PlanPage.tsx`)
  - **Header & Plan Overview (`Card`)**:
    - Meta badges (`Layer B Adaptive Curriculum`, `SAT-JEPA Δc Derivation`, `Rest-First Pacing Active`).
    - Quick actions: `Launch Today's Focus Block →`, `Ask AI Coach →`.
    - Persona & preview state bar (`active-plan`, `rest-pacing-engaged`, `loading`, `empty`, `error`, `extreme-text`).
  - **Left 7-Column Stack**:
    - **Card L1 — Weekly Schedule Ribbon & Day Selector**:
      - 7-day pill selector (Monday through Sunday) with visual status indicators (Target Session `●`, Maintenance `◐`, Rest/Recovery Day `☾`).
      - Circadian matching note (e.g., "Optimal window: 09:00–11:30 based on your fatigue heatmap").
    - **Card L2 — Prescribed Daily Exercise Cards**:
      - Active day exercise list showing Task Paradigm, Target Dimension badge, Staircase Level badge (Lvl 1–5), Duration (90s / 3min), and direct launch CTAs (`/task/:dimId`).
      - Proactive rest card when viewing a recovery day (e.g., Wednesday / Saturday), celebrating restorative pacing with zero guilt.
  - **Right 5-Column Stack**:
    - **Card R1 — SAT-JEPA Δc Allocation Matrix**:
      - Table showing how differential vectors ($\Delta c$) allocate weekly session slots across registered dimensions (`3/6/7/8/10`).
      - Highlights high-information-gain axes (e.g. Hatched confidence $<60\%$ receiving priority calibration).
    - **Card R2 — Interactive Staircase Level Simulator**:
      - Interactive 1–5 staircase slider/stepper showing how parameter difficulty (stimulus presentation time, lure similarity, rule switches) adjusts dynamically.
    - **Card R3 — Embedded Signature #3 `<WhyThisPanel />`**:
      - 5-part explanation of why this specific weekly schedule and difficulty staircase was synthesized.

---

## 5. Tokens Used
- **Surfaces & Canvas**: `bg-canvas`, `bg-surface`, `bg-surface-raised`, `bg-brand-subtle`, `bg-reward-subtle`, `bg-warning-subtle`, `bg-danger-subtle`.
- **Ink & Borders**: `text-ink`, `text-ink-muted`, `border-border`, `border-border-strong`.
- **Dimension Colors**: Token variables `--dim-1` through `--dim-10` paired with marker glyphs.
- **Typography**: `font-display` (`Fredoka`), `font-sans` (`Lexend`), `font-mono-tabular` (`JetBrains Mono`).

---

## 6. Interactive States & Edge States
1. **`active-plan` (Default)**: Standard balanced schedule for current persona across active dimensions.
2. **`rest-pacing-engaged`**: Triggers when fatigue score or response jitter is high; replaces intensive high-load blocks with a 5-minute screen break or low-staircase maintenance probe.
3. **`loading`**: Accessible skeleton (`role="status"`) while computing $\Delta c$ allocation.
4. **`empty`**: Cold-start state when no baseline assessment has been completed yet; offers 1-click intake shortcut.
5. **`error`**: Remote sync failure with 1-click fallback to local deterministic rule-engine schedule.
6. **`extreme-text`**: Stress-tests multi-clause exercise descriptions and 10-dimension curriculum allocation.

---

## 7. Data Contract (`GET /v1/plan/weekly`)
```json
{
  "week_number": 7,
  "optimization_target": "epistemic_entropy_reduction",
  "recommended_days": [
    {
      "day": "Thu",
      "is_rest_day": false,
      "circadian_window": "morning_peak",
      "exercises": [
        {
          "dimension_id": "working_memory",
          "task_name": "Dual-Stream Spatial & Symbol N-Back",
          "staircase_level": 4,
          "duration_seconds": 90,
          "delta_c_weight": 0.35
        }
      ]
    }
  ]
}
```

---

## 8. Accessibility Plan (WCAG 2.1 AA)
- Semantic calendar tabs (`role="tablist"` and `role="tab"` or grouped toggle buttons with `aria-pressed`).
- Table markup with proper column scopes (`<th scope="col">`) and focusable scroll regions (`tabIndex={0} role="region"`).
- Keyboard shortcuts and full tab-stop navigation with `3px` focus rings.

---

## 9. Copy & Tone Table
| Location | Approved Copy | Prohibited Framing Avoided |
| :--- | :--- | :--- |
| **Header Subtitle** | *"Personalized, non-clinical training schedule calibrated to your SAT-JEPA profile vectors and natural focus rhythms."* | Avoids medical prescription or cognitive deficit terms. |
| **Rest Day Card** | *"Proactive Recovery Day — Consolidating neural adaptations without screen fatigue. Taking planned rest keeps your measurement bands crisp."* | Avoids "You missed your goal" or punitive streak breaks. |
| **Staircase Card** | *"Adaptive Difficulty Staircase: Auto-adjusts so you train right at your 85% sweet spot."* | Avoids "Pass/Fail" grading language. |

---

## 10. Per-Page Definition of Done (DoD Checklist)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (`active-plan`, `rest-pacing-engaged`, `loading`, `empty`, `error`, `extreme-text`) implemented and screenshotted.
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
  - *Observation*: On `1440 px` desktop, the left column (7 cols: Weekly Ribbon + Daily Prescriptions) and right column (5 cols: SAT-JEPA $\Delta c$ Matrix + Staircase Simulator + `<WhyThisPanel />`) align cleanly at the bottom edge.
  - *Observation*: Toggling `2 · ☾ Rest-First Pacing` immediately swaps the Thursday training blocks with the Wednesday Proactive Recovery card (`Scheduled Recovery & Memory Consolidation Day · Streak Protected`), and `<Mascot />` switches to its serene `rest` state.
- **Round 2 Critique**:
  - *Observation*: The arbitrary `text-[10px]` styling on the 7-day ribbon was flagged by `lint:tokens`.
  - *Fix*: Replaced `text-[10px]` with standard design token `text-xs`.
  - *Observation*: The SAT-JEPA $\Delta c$ priority table required keyboard accessibility on scrollable viewports.
  - *Fix*: Added `tabIndex={0} role="region" aria-label="SAT-JEPA delta c allocation table scrollable container"` to the table container, passing `axe-core` with 0 violations across 375, 768, and 1440 px.

---

## 11. Decisions, Known Issues & Screenshots
- **Decisions**: Provide a 1-click **Rest-First Pacing Toggle** so judges can immediately see how SynapseTwin handles high-fatigue days without guilt.
- **Known Issues**: None.
- **Screenshots**:
  - `docs/ui/screenshots/10-plan-1440.png`
  - `docs/ui/screenshots/10-plan-rest-pacing-1440.png`
  - `docs/ui/screenshots/10-plan-dark-10dims-1440.png`
  - `docs/ui/screenshots/10-plan-768.png`
  - `docs/ui/screenshots/10-plan-375.png`
