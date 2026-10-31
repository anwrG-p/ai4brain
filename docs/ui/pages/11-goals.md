# Page 11 — Goals & Habit Contracts (`/goals`) Specification

> **Superseded (history).** This spec describes the page before brand v2. Now: `/goals` redirects to Home; goals sit under "Further explore". Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

- **Page Name & Route**: Goals & Habit Contracts (`/goals`)
- **Wave & Priority**: Wave 3 · **Must** (`P1` Layer C Goal Tracking & Uncertainty-Aware Habit Scaffolding)
- **Branch**: `ui/page-11-goals`

---

## 1. Purpose, Audience & Primary Job
- **Purpose**: Transform longitudinal cognitive assessment (Layer A) and adaptive training (Layer B) into structured, realistic, and self-directed personal development contracts (Layer C). Unlike legacy brain apps that make ungrounded promises ("Boost your memory by 30% in 10 days"), SynapseTwin calculates **Bayesian Epistemic ETA Intervals** ($\hat{\tau} \pm \sigma_{\tau}$) grounded in empirical $\Delta c$ learning rates, and enforces **Zero-Guilt Habit Protection** where rest days are celebrated as neural consolidation rather than penalized as broken streaks.
- **Audience**:
  - **Jury (Phase 1 & Phase 2)**: Evaluates **Relevance (12%)**, **Innovation (12%)**, **Safety & Ethics (6%)**, and **Plan Relevance (6%)** by verifying:
    1. Goal targets are honest: ETAs are expressed as Bayesian credible intervals (e.g., `18–26 days · 80% CI`), explicitly derived from trial variance.
    2. Zero-Guilt Habit Contracts: Taking a rest day preserves streak continuity with zero penalty.
    3. Dimension Generalisation: Allows configuring and tracking goals across any dimension preset (`3, 6, 7, 8, or 10` dimensions) from `DimensionRegistry`.
    4. Explains the Bayesian ETA model via embedded Signature #3 `<WhyThisPanel />`.
  - **Learner / Participant**: Sets feasible micro-commitments (3–5 minutes, 3x weekly) with clear visual milestones, stability objectives, and circadian-matched time windows.
- **Primary Job**: Let the user inspect active habit contracts, track milestone progress and confidence narrowing, simulate target delta changes with instant counterfactual ETA calculation, and create new dimension goals.

---

## 2. Rubric Criteria Served
- **Relevance (12% final)** — Fulfills Layer C Goal Tracking explicitly required by the competition brief.
- **Innovation (12% final)** — Replaces deterministic completion dates with Bayesian Credible ETA Intervals ($\hat{\tau} \pm \sigma_{\tau}$) and proactive rest streak protection.
- **Plan Relevance (6% final)** — Connects habit commitments directly to weekly adaptive micro-blocks (`/plan`) and difficulty staircase parameters.
- **Safety & Ethics (6% final)** — Enforces non-clinical copy guidelines: no promises of "curing deficits", no punitive streak loss, and full autonomy in adjusting or pausing contracts without guilt.
- **Generalisation (10% final)** — Supports goals across `3, 6, 7, 8, or 10` dimensions with colorblind-safe Okabe-Ito badges and unique marker glyphs.

---

## 3. ASCII Wireframe (`1440 px` Desktop & `375 px` Mobile)

### Desktop (`1440 px`, 12-Column Grid)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · Simulated Data   [3 Dims][6 Dims][7 Dims][10 Dims]  [Theme] [Motion] [Nav...] |
+--------------------------------------------------------------------------------------------------+
| [★ Layer C Personal Growth] [● 3 Active Contracts] [Zero-Guilt Habit Engine · Rest Protected]     |
| Goals & Habit Contracts Studio                                                                   |
| Filter: [All Goals][In Progress][Consolidation / Rest][Completed] | Preset: [7 Dims (Default)]   |
+---------------------------------------------------------+----------------------------------------+
| LEFT 7 COLUMNS: Active Habit Contracts                  | RIGHT 5 COLUMNS: Goal Tuner & Model    |
| +-----------------------------------------------------+ | +------------------------------------+ |
| | Hero: Habit Protection & Rest-First Philosophy      | | | Interactive Goal & ETA Simulator   | |
| | "Rest days protect neural memory consolidation"     | | | Target Dimension: [Working Memory] | |
| | Current Streak: 18 Days (3 Rest Days Included)       | | | Goal Type: [Capacity][Stability]   | |
| +-----------------------------------------------------+ | | Target Delta: [+10% θ]             | |
| | Active Contract 1: Working Memory Expansion         | | | Expected ETA: [18 – 24 Days (80%)] | |
| | • Target: +10% θ (Current: +6.2% · 62% Done)        | | | [Commit to Contract ->]            | |
| | • Bayesian ETA: 18 – 24 Days (80% Credible Interval)| +------------------------------------+ |
| | • Commitment: 3x / week · Morning Peak (90s block)  | +------------------------------------+ |
| | • Pacing: On Track · Sunday Rest Scheduled          | | Bayesian ETA Estimation Model      | |
| +-----------------------------------------------------+ | | Formula: τ = Δθ / (Δc · η)         | |
| | Active Contract 2: Cognitive Flexibility Set-Shift  | | | Considers measurement jitter       | |
| | • Target: Latency Stability (<120ms Jitter)         | +------------------------------------+ |
| | • Bayesian ETA: 12 – 16 Days · Sunday Rest Protected| +------------------------------------+ |
| +-----------------------------------------------------+ | | Companion Mascot Reaction          | |
| | Embedded Signature #3 <WhyThisPanel />              | | | [Mascot: Celebrate / Rest Mode]  | |
| | Rationale: Bayesian posterior convergence ETA       | +------------------------------------+ |
+---------------------------------------------------------+----------------------------------------+
```

### Mobile (`375 px`, Single-Column Stack)
```text
+-----------------------------------------+
| [ST] SynapseTwin · Simulated Data  [☰]  |
+-----------------------------------------+
| Goals & Habit Contracts                 |
| Zero-Guilt Streak Protection            |
+-----------------------------------------+
| [Habit Streak Hero: 18 Days]            |
| 3 Rest Days Honored · Zero Penalty      |
+-----------------------------------------+
| [Filter Pills: All / In Progress / Done]|
+-----------------------------------------+
| [Contract 1: Working Memory +10%]       |
| Progress: 62% · ETA: 18–24 Days (80% CI)|
| Commitment: 3x/wk · Morning Peak        |
+-----------------------------------------+
| [Contract 2: Flexibility Stability]     |
| Progress: 80% · ETA: 12–16 Days         |
+-----------------------------------------+
| [Interactive Goal Simulator]            |
| Dim Selector + Delta Slider + Live ETA  |
+-----------------------------------------+
| [Accessible Contracts Table Region]     |
| [Toggle Full Table Region]              |
+-----------------------------------------+
| [<WhyThisPanel /> Bayesian ETA Rationale|
+-----------------------------------------+
```

---

## 4. Component Hierarchy & Token Usage
- **Route**: `/goals`
- **Page Component**: `frontend/src/pages/GoalsPage.tsx`
- **Contracts Component**: `frontend/src/components/goals/HabitContractCard.tsx`
- **Sub-components**:
  - `<Badge />`: Semantic tones (`brand`, `reward`, `warning`, `neutral`).
  - `<Button />`: Tactile interactive buttons with min-h-11 touch targets and focus rings.
  - `<Card />`: Structured containers with 2px borders.
  - `<WhyThisPanel />`: Reusable 5-part explainability trail explaining the Bayesian ETA formula.
  - `<Mascot />`: Interactive companion in state `"celebrate"` (goal milestone), `"rest"` (pacing consolidation), or `"idle"`.
- **Design Token Discipline**:
  - Colors: `bg-canvas`, `bg-surface`, `bg-surface-raised`, `text-ink`, `text-ink-muted`, `border-border-strong`.
  - Dimensions: Okabe-Ito colorblind-safe badges from `DimensionRegistry`.
  - Typography: `font-display` (Fredoka), `font-body` (Lexend), `font-mono` (JetBrains Mono).
  - Strictly tokenized classes; zero arbitrary pixel brackets (`text-[10px]`, `w-[300px]`).

---

## 5. State Machine & Interactive Behaviors

### States:
1. **Contract Filter State**:
   - `all`: Displays all 3 seeded contracts.
   - `in-progress`: Displays active training commitments.
   - `recovery`: Displays pacing/consolidation contracts with streak protection.
   - `completed`: Displays achieved milestones.
2. **Interactive Goal Creator / Simulator**:
   - Dimension selector: Switches across active dimensions in `DimensionRegistry`.
   - Target Delta stepper / slider: Adjusts desired latent gain $\Delta\theta$ from $+4\%$ to $+20\%$.
   - Objective type: *Capacity Expansion*, *Response Stability*, or *Variance Reduction*.
   - Live Bayesian ETA recalculation:
     $$\hat{\tau} = \frac{\Delta\theta}{\overline{\Delta c} \cdot \eta_{\text{session}}}, \quad \text{CI}_{80} = [\hat{\tau} - 1.28 \sigma_{\tau}, \, \hat{\tau} + 1.28 \sigma_{\tau}]$$
   - Form submission: Adds simulated contract to user's active contracts list with instant feedback.
3. **Pacing Action Toggle**:
   - Allows marking today as a "Scheduled Neural Consolidation Rest Day" and confirms that the streak counter advances without penalty.
4. **Accessible Table Region**:
   - Toggle button: `Show Accessible Contracts Table` revealing all numerical targets, completion percentages, and ETAs in a structured `<table>` with `tabIndex={0}` and `role="region"`.

---

## 6. Contracts & API Surface

### Types (`frontend/src/contracts/index.ts`):
```ts
export type GoalObjectiveType = 'capacity' | 'stability' | 'maintenance'

export interface HabitContract {
  id: string
  dimensionId: string
  dimensionName: string
  objectiveType: GoalObjectiveType
  title: string
  targetDeltaPct: number
  currentProgressPct: number
  baselineScorePct: number
  currentScorePct: number
  etaDaysRange: [number, number]
  confidencePct: number
  weeklyCommitment: string
  scheduledRestDay: string
  streakDays: number
  status: 'active' | 'pacing_rest' | 'completed'
  rationale: string
}
```

---

## 7. Non-Clinical Copy Guardrails & Accessibility
- **Guardrail Rule 1**: Never promise clinical recovery, disease prevention, or IQ jumps.
- **Guardrail Rule 2**: Use "Bayesian learning trajectory", "epistemic credible interval", "habit scaffolding", "neural consolidation rest".
- **Guardrail Rule 3**: Guarantee non-punitive rest: "Rest days protect your habit streak (zero penalty)".
- **Accessibility (WCAG 2.1 AA)**:
  - Contrast ratios $\ge 4.5:1$ on all text and badges.
  - Visible button labels identical to accessible names (WCAG 2.5.3).
  - Table containers with `role="region"`, `aria-label`, and `tabIndex={0}`.
  - Zero `axe-core` violations across Desktop, Tablet, and Mobile.

---

## 8. Verification Checklist & Screenshots Plan
- Five screenshots to capture via Playwright:
  1. `11-goals-1440.png`: Desktop 1440px with active habit contracts and Bayesian ETA simulator.
  2. `11-goals-rest-protected-1440.png`: Desktop 1440px with proactive rest day streak preservation engaged.
  3. `11-goals-dark-10dims-1440.png`: Night Lab dark mode with 10-dimension preset active and accessible table region expanded.
  4. `11-goals-768.png`: Tablet 768px layout.
  5. `11-goals-375.png`: Mobile 375px layout.

---

## 9. Two Rounds of Design Critique Plan & Outcome
- **Round 1 (Mobile Card Stacking & Touch Targets)**:
  - *Critique*: On 375px viewports, the streak counter pill and Bayesian ETA interval cards required wrapped flex structures to prevent horizontal clipping.
  - *Fix*: Structured `HabitContractCard.tsx` with responsive `flex-col sm:flex-row` and `min-h-11` touch targets, verifying 0 horizontal overflow across 375px, 768px, and 1440px.
- **Round 2 (Jury & Metacognitive Defensibility)**:
  - *Critique*: The mathematical formula card and Bayesian credible interval badge required explicit clarification that measurement noise ($\sigma_{\tau}$) expands ETAs during high-fatigue sessions.
  - *Fix*: Added the **Bayesian Epistemic ETA Model** math card ($\hat{\tau} = \Delta\theta / (\Delta c \cdot \eta_{\text{session}})$) and paired it with `<WhyThisPanel />` counterfactual reasoning and zero-penalty streak protection.

---

## 10. DoD (Definition of Done) Checklist
- [x] Spec approved at **Gate 1**.
- [x] Author `frontend/src/components/goals/HabitContractCard.tsx`.
- [x] Build `frontend/src/pages/GoalsPage.tsx` with habit contracts, ETA simulator, rest protection toggle, and accessible table region.
- [x] Wire `/goals` route into `App.tsx` and navigation in `AppShell.tsx`.
- [x] Add unit tests in `frontend/src/tests/designSystem.test.tsx` (16/16 passing).
- [x] Author Playwright E2E test in `frontend/e2e/goals.spec.ts`.
- [x] Run `npm run qa:checks` (lint tokens, lint copy, check contrast, unit tests, build) $\rightarrow$ 0 errors.
- [x] Run Playwright suite and generate 5 screenshots with 0 `axe-core` violations and 0 horizontal overflow.
- [x] Log critiques in `docs/ui/QA-log.md` and update `STATE.md`, `CHANGELOG.md`, `JUDGES-UI.md`.
- [x] Present **Gate 2** to the user.
