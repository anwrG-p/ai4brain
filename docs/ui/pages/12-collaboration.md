# Page 12 — AI Collaboration Score (`/collaboration`) Specification

> **Superseded (history).** This spec describes the page before brand v2. Now: `/collaboration` redirects to Home; the Collaboration Score appears under "Further explore" only with enough chat data. Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

- **Page Name & Route**: AI Collaboration Score Deep-Dive (`/collaboration`)
- **Wave & Priority**: Wave 2 · **Must** (`P1` AI Collaboration Score & Signature #5 `<CollaborationScoreCard />`)
- **Branch**: `ui/page-12-collaboration`

---

## 1. Purpose, Audience & Primary Job
- **Purpose**: Provide a rigorous, transparent, and metacognitively grounded exploration of human-AI collaboration during cognitive assessment and adaptive training. Rather than treating AI as an oracle, SynapseTwin quantifies and rewards critical verification, self-direction, thoughtful inquiry, and ethical restraint.
- **Audience**:
  - **Jury (Phase 1 & Phase 2)**: Evaluates **Relevance (12%)**, **Innovation (12%)**, **Explainability (9%)**, **Safety & Ethics (6%)**, and **Defense (6%)** by verifying:
    1. Signature #5 `<CollaborationScoreCard />` is prominently featured with the mandatory badge: `"Design proposal, not validated"`.
    2. Explicit psychometric formula: $S_{\text{collab}} = \sum_{i=1}^5 w_i(s_t) \cdot V_i$ with visible baseline and dynamic archetype-tuned weights.
    3. The 5 sub-dimensions (Clarification 20%, Critical Verification 25%, Iteration 20%, Autonomy 20%, Responsible Use 15%) are grounded in tangible user telemetry events, not arbitrary vibes.
    4. An interactive simulator proves how specific user actions (e.g. inspecting `<WhyThisPanel />`, setting an autonomous goal, adhering to rest days) actively move the score.
  - **Learner / Participant**: Learns how to interact constructively with AI coaching without over-relying on automated recommendations (preventing cognitive offloading and sycophancy).
- **Primary Job**: Let the user inspect their 0–100 AI Collaboration Score (`82 ± 4`), drill down into each sub-dimension's evidence trail, experiment with dynamic archetype weightings, view longitudinal metacognitive growth, and simulate action-driven score shifts.

---

## 2. Rubric Criteria Served
- **Relevance (12% final)** — Delivers the mandatory 0–100 AI Collaboration Score specified in the challenge brief with clear sub-score breakdowns and evidence.
- **Innovation (12% final)** — Implements **Signature #5 `<CollaborationScoreCard />`** with dynamic archetype weights $w_i(s_t)$ derived from Member 2's AI Coach architecture.
- **Explainability (9% final)** — Connects every sub-score point to concrete telemetry timestamps and embeds Signature #3 `<WhyThisPanel />` explaining the composite inference.
- **Safety & Ethics (6% final)** — Bears the prominent `"Design proposal, not validated"` badge, rewards privacy center engagement and rest-day compliance in *Responsible Use*, and enforces strict non-clinical language.
- **Defense (6% final)** — Provides seeded persona fixtures (`steady-improver` `82 ± 4`, `noisy-low-confidence` `61 ± 9`, `fast-skeptic` `91 ± 3`, `passive-accepter` `48 ± 7`) enabling judges to evaluate extreme collaborative profiles instantly.

---

## 3. ASCII Wireframe (`1440 px` Desktop & `375 px` Mobile)

### Desktop (`1440 px`, 12-Column Grid)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · Simulated Data   [3 Dims][6 Dims][7 Dims][10 Dims]  [Theme] [Motion] [Nav...] |
+--------------------------------------------------------------------------------------------------+
| [★ Layer B Metacognition] [● Composite: 82 ± 4 / 100] [Badge: Design proposal, not validated]    |
| AI Collaboration Score & Human-AI Synergy Deep-Dive                                              |
| Persona: [Youssef (Steady)][Salma (Skeptic)][Rami (Passive)][Noisy] | Preset: [Default][Dynamic] |
+---------------------------------------------------------+----------------------------------------+
| LEFT 7 COLUMNS: Signature #5 <CollaborationScoreCard /> | RIGHT 5 COLUMNS: Simulator & History   |
| +-----------------------------------------------------+ | +------------------------------------+ |
| | Composite Score Hero & Confidence Band              | | | Interactive Telemetry Simulator    | |
| | [ 82 ± 4 / 100 ] [ Archetype Weighting: Active ]    | | | Test how actions shift your score: | |
| | Formula: S_collab = Σ w_i(s_t) · V_i                | | | [+1 Audit Why-This] (+2 Verif)     | |
| +-----------------------------------------------------+ | | [+1 Ask Clarification] (+2 Clarif) | |
| | Sub-Dimension Breakdown (5 Dimension Cards)         | | | [+1 Set Custom Goal] (+2 Auton)    | |
| | 1. Critical Verification (25% weight · Score: 88)   | | | [+1 Honor Rest Day] (+3 RespUse)   | |
| |    Evidence: 8 inspections of <WhyThisPanel />      | | | [Reset Simulator to Persona Base]  | |
| |    Tip: Keep questioning counterfactual bounds.     | | +------------------------------------+ |
| | 2. Clarification (20% weight · Score: 85)           | | +------------------------------------+ |
| |    Evidence: 6 targeted uncertainty queries         | | | Longitudinal Trajectory (W1 → W6)  | |
| | 3. Iteration (20% weight · Score: 79)               | | | W1: 64 ± 8 -> W6: 82 ± 4           | |
| | 4. Autonomy (20% weight · Score: 76)                | | | [Toggle Tabular History Region]    | |
| | 5. Responsible Use (15% weight · Score: 92)         | | +------------------------------------+ |
| |    Evidence: Non-biometric lock & rest respect      | | +------------------------------------+ |
| +-----------------------------------------------------+ | | Dynamic Archetype Weight Matrix    | |
| +-----------------------------------------------------+ | | Baseline vs Current Archetype      | |
| | Embedded Signature #3 <WhyThisPanel />              | | | Sum: 100.0% (Normalized)           | |
| | Rationale: Metacognitive agency calibration         | | +------------------------------------+ |
+---------------------------------------------------------+----------------------------------------+
```

### Mobile (`375 px`, Single-Column Stack)
```text
+-----------------------------------------+
| [ST] SynapseTwin · Simulated Data  [☰]  |
+-----------------------------------------+
| [Badge: Design proposal, not validated] |
| AI Collaboration Score                  |
| 82 ± 4 / 100                            |
+-----------------------------------------+
| [Composite Hero Card with CI Band]      |
| S_collab = Σ w_i(s_t) · V_i             |
+-----------------------------------------+
| [Weight Mode: Baseline vs Archetype]    |
+-----------------------------------------+
| [5 Sub-Dimension Cards Stacked]         |
| 1. Critical Verification (25% | 88/100) |
| 2. Clarification (20% | 85/100)         |
| 3. Iteration (20% | 79/100)             |
| 4. Autonomy (20% | 76/100)              |
| 5. Responsible Use (15% | 92/100)       |
+-----------------------------------------+
| [Action Simulator Buttons]              |
| [+1 Audit] [+1 Clarify] [+1 Rest]       |
+-----------------------------------------+
| [Longitudinal Metacognitive Curve]      |
| [Toggle Accessible Table]               |
+-----------------------------------------+
| [<WhyThisPanel /> Embedded Rationale]   |
+-----------------------------------------+
```

---

## 4. Component Hierarchy & Token Usage
- **Route**: `/collaboration`
- **Page Component**: `frontend/src/pages/CollaborationScorePage.tsx`
- **Signature Component**: `frontend/src/components/signature/CollaborationScoreCard.tsx` (Signature #5)
- **Sub-components**:
  - `<Badge />`: Semantic status badges (`bg-warning-light text-warning-dark` for `"Design proposal, not validated"`, `bg-brand-teal/15 text-brand-teal` for active weights).
  - `<Card />`: Structured containers using `var(--color-surface)` and `var(--radius-card)`.
  - `<WhyThisPanel />`: Reusable 5-part explainability card explaining the composite collaboration rating.
  - `<Mascot />`: Interactive companion in state `"steady"` (high score), `"curious"` (active verification), or `"rest"` (responsible rest).
- **Design Token Discipline**:
  - Backgrounds: `bg-canvas`, `bg-surface`, `bg-surface-elevated`
  - Text: `text-ink`, `text-ink-muted`, `text-ink-faint`
  - Accents: `bg-brand-teal`, `text-brand-teal`, `bg-brand-gold`, `text-brand-gold`, `bg-brand-coral`
  - Font families: `font-display` (Fredoka), `font-body` (Lexend), `font-mono` (JetBrains Mono)
  - Zero arbitrary pixel values (`[12px]`, `[50px]`) — strictly tokenized utility classes.

---

## 5. State Machine & Interactive Behaviors

### Page States:
1. **Persona State**:
   - `steady-improver` (Default): Score `82 ± 4`, high verification & responsible use.
   - `fast-skeptic`: Score `91 ± 3`, extremely high critical verification (95) and autonomy (92).
   - `passive-accepter`: Score `48 ± 7`, low verification (35) and low autonomy (40) — high risk of automated bias / cognitive offloading.
   - `noisy-low-confidence`: Score `61 ± 9`, wide CI interval indicating sparse interaction history.
2. **Weight Mode State**:
   - `default-baseline`: Fixed canonical weights (20%, 25%, 20%, 20%, 15%).
   - `archetype-dynamic`: Weights tuned dynamically by SAT-JEPA cognitive cluster $s_t$ (e.g. Cluster 5 emphasizes autonomy $w=25\%$, while Cluster 2 prioritizes clarification $w=25\%$).
3. **Interactive Telemetry Simulator**:
   - Additive actions: Clicking `+1 Why-This Audit` (+2 verification score, +1 evidence item), `+1 Clarification` (+2 clarification, +1 query), `+1 Custom Goal` (+2 autonomy), `+1 Rest Day Respect` (+3 responsible use).
   - Live recalculation: Recalculates $S_{\text{collab}} = \sum w_i V_i$ instantly with smooth CSS transitions and updates the $\pm\text{CI}$ band.
   - Reset button: Restores base persona values.
4. **Accessible Table Region**:
   - Toggle button: `Show Accessible Telemetry & Weight Table` revealing all numerical values in an HTML table with `tabIndex={0}`, `role="region"`, and keyboard scrollability.

---

## 6. Contracts & API Surface

### Types (`frontend/src/types/cognitive.ts` & `docs/ui/contracts.md`):
```ts
export type CollaborationDimensionKey =
  | 'clarification'
  | 'verification'
  | 'iteration'
  | 'autonomy'
  | 'responsible_use'

export interface CollaborationSubScore {
  key: CollaborationDimensionKey
  label: string
  defaultWeightPct: number       // 20 | 25 | 20 | 20 | 15
  activeDynamicWeightPct: number // Archetype-tuned weight w_i(s_t)
  score: number                  // 0..100
  evidenceCount: number
  recentEvents: string[]
  howToImprove: string
}

export interface CollaborationScorePayload {
  totalScore: number             // 0..100
  ciRange: [number, number]      // e.g. [78, 86]
  statusBadge: 'Design proposal, not validated'
  formulaDisplay: string
  subScores: CollaborationSubScore[]
  whyThis: WhyThisTrail
}
```

---

## 7. Non-Clinical Copy Guardrails & Accessibility
- **Guardrail Rule 1**: Never use "psychological assessment", "compliance index", "trust score", "IQ", or "diagnostic rating".
- **Guardrail Rule 2**: Use "metacognitive reflection", "human-AI synergy", "critical verification", "autonomous practice".
- **Guardrail Rule 3**: Prominently display `"Design proposal, not validated"` on every card and export.
- **Accessibility (WCAG 2.1 AA)**:
  - Contrast ratios $\ge 4.5:1$ on all text and badges.
  - Full keyboard accessibility: All interactive buttons (`tabIndex={0}`), focus-visible rings (`focus-ring`).
  - Table containers with `role="region"`, `aria-label`, and `tabIndex={0}` for narrow viewports.
  - Zero `axe-core` violations across Desktop, Tablet, and Mobile.

---

## 8. Verification Checklist & Screenshots Plan
- Five screenshots to capture via Playwright:
  1. `12-collaboration-1440.png`: Desktop 1440px with composite score, 5 sub-dimension breakdown, and active dynamic weights.
  2. `12-collaboration-simulated-1440.png`: Desktop 1440px with simulated telemetry actions applied and live score shift.
  3. `12-collaboration-dark-1440.png`: Night Lab dark mode with 10-dimension preset active and accessible table region expanded.
  4. `12-collaboration-768.png`: Tablet 768px layout.
  5. `12-collaboration-375.png`: Mobile 375px layout.

---

## 9. Two Rounds of Design Critique Plan & Outcome
- **Round 1 (WCAG 2.5.3 Label-in-Name & Button Semantics)**:
  - *Critique*: Sub-score toggle buttons had distinct visible text (`Hide ▲` vs `Evidence ▼`) while `aria-label` was `Toggle evidence log for ${sub.label}`, triggering WCAG 2.5.3 `label-content-name-mismatch`.
  - *Fix*: Aligned visible text and accessible name to `Hide Evidence ▲` / `Show Evidence ▼` and added `aria-expanded`, guaranteeing 100% accessible label-in-name compliance.
- **Round 2 (Contrast on Shaded Badges & Action Simulator)**:
  - *Critique*: Persona badge had `opacity-80` which dropped contrast to `4.13:1`, and active stepper item had white text on light teal tint.
  - *Fix*: Replaced `opacity-80` with `text-brand-ink font-semibold` (`5.48:1` contrast) and updated current stepper cell text to `text-ink` (`15.61:1`), yielding 0 contrast violations across all themes.

---

## 10. DoD (Definition of Done) Checklist
- [x] Spec approved at **Gate 1**.
- [x] Build `frontend/src/components/signature/CollaborationScoreCard.tsx` (Signature #5).
- [x] Build `frontend/src/pages/CollaborationScorePage.tsx` with simulator, longitudinal curve, and dynamic weight toggle.
- [x] Wire `/collaboration` route into `App.tsx` and navigation in `AppShell.tsx`.
- [x] Add unit tests in `frontend/src/tests/designSystem.test.tsx` (15/15 passing).
- [x] Author Playwright E2E test in `frontend/e2e/collaboration.spec.ts`.
- [x] Run `npm run qa:checks` (lint tokens, lint copy, check contrast, unit tests, build) $\rightarrow$ 0 errors.
- [x] Run Playwright suite and generate 5 screenshots with 0 `axe-core` violations and 0 horizontal overflow.
- [x] Log critiques in `docs/ui/QA-log.md` and update `STATE.md`, `CHANGELOG.md`, `JUDGES-UI.md`.
- [x] Present **Gate 2** to the user.
