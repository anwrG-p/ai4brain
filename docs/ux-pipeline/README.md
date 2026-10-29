# CISTAC 1.0 — SynapseTwin / BRIAN UX Pipeline Master Repository

> **Central Hub for Design, Journey Flow, Affective Computing, and UI Verification**  
> **Location**: `docs/ux-pipeline/`  
> **Status**: Complete, Production-Locked, and QA-Verified  
> **Design Philosophy**: Warm Doodle (Hand-Drawn) Aesthetic · Non-Clinical Voice · Epistemic Uncertainty · EMILY Affective Computing  

---

## 🎯 Executive Overview

This directory unifies all documentation, specifications, design tokens, emotional modulation architectures, and verification suites governing the user experience (UX) and user interface (UI) pipeline of **SynapseTwin / BRIAN (AI4Brain Challenge — CISTAC 1.0)**.

The UX pipeline solves two fundamental flaws in traditional cognitive evaluation:
1. **White-Coat Intimidation**: Clinical testing environments induce test anxiety, artificially inflating response times ($+140\text{ ms}$) and error rates. SynapseTwin deploys an approachable, sketch-inspired **Doodle Design System** and **EMILY affective computing** that continuously adapts pacing and feedback without webcam/microphone biometrics.
2. **Deficit-Framed Assessment**: Medicalized jargon and punitive "streaks" cause user abandonment. SynapseTwin guarantees non-clinical language, explicit epistemic uncertainty intervals ($\pm\text{CI}$), and human-in-the-loop approval protocols.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SYNAPSETWIN UX PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ├─► 01. Strategy & User Journey Flow (< 3 min First-Insight Guarantee)
          │
          ├─► 02. Doodle Design System & Perceptual OKLCH Token Ramp
          │
          ├─► 03. EMILY Non-Biometric Affective Computing & Color Psychology
          │
          ├─► 04. TypeScript Contracts, Architecture Decisions & Sprint State
          │
          ├─► 05. Evaluation Rubrics, Copy Safety (GLOSSARY) & Automated QA
          │
          └─► 06. 19 Page-Level Interface & Interaction Specifications
```

---

## 📁 Directory Structure & Documentation Matrix

```
docs/ux-pipeline/
├── README.md                                 # Master Index & UX Pipeline Navigation Guide (This file)
│
├── 01_strategy_and_journey/                  # High-level UX strategy, journey flow, and context
│   ├── UX_TRANSFORMATION_PLAN.md             # 19-Page user journey flow, EMILY architecture, approval protocol
│   ├── 01-ux-strategy.md                     # Personas, sub-3-minute flow, epistemic honesty, non-clinical voice
│   └── 00-context.md                         # Challenge rules, rubric weights, team architecture sync
│
├── 02_design_system_and_tokens/              # Visual foundations, tokens, and brand identity
│   ├── DESIGN.md                             # Doodle Design System, OKLCH ramps, Okabe-Ito 10-dimension palette
│   ├── 02-design-system.md                   # Core design system documentation & contrast tables
│   ├── stitch-design-tokens.md               # Stitch design system export (colors, typography, spacing)
│   ├── stitch-skill-guidelines.md            # Hand-drawn design skill guidelines & component coverage
│   ├── brian-brand-and-mascot.md             # BRIAN mascot identity, lockups, and design rules
│   └── direction-sprint.html                 # Interactive 3-theme visual comparison showcase
│
├── 03_affective_computing_and_emily/         # Emotion modulation & real-time kinematic interaction
│   └── EMILY_BEHAVIORAL_EMOTION_ENGINE.md    # Circumplex affect model, 7 DOM kinematic metrics, color regulation
│
├── 04_contracts_and_architecture/            # Frontend-backend interface contracts and governance
│   ├── contracts.md                          # Full TypeScript API contract & dimension telemetry bridge
│   ├── SEQUENCE_DIAGRAMS.md                  # Rendered sequence diagrams (5-subsystem interoperability & UX flows)
│   ├── sequence_diagrams_viewer.html         # Interactive visual diagram viewer (zoom, pan, export SVG/PNG)
│   ├── diagrams/                             # High-resolution vector SVGs & Retina PNG diagram renders
│   ├── DECISIONS.md                          # Architectural & UX decision log (DEC-001 through DEC-008)
│   ├── STATE.md                              # Live UX sprint tracker & implementation status
│   ├── ASSETS.md                             # Self-hosted fonts, icon sets, and illustration license ledger
│   ├── CHANGELOG.md                          # UI/UX conventional changelog & milestone history
│   ├── AGENT-EVALUATION-HANDOFF.md           # Evaluator & jury handoff guide with verification steps
│   └── ui-readme.md                          # Original frontend implementation overview
│
├── 05_evaluation_and_qa/                     # Proof matrices, test logs, and copy safety rules
│   ├── JUDGES-UI.md                          # Jury Rubric-to-UI Proof Matrix (11 official criteria)
│   ├── QA-log.md                             # Automated token grep, contrast verification, copy lint logs
│   └── GLOSSARY.md                           # Canonical consumer lexicon & 18 forbidden clinical terms
│
└── 06_page_specifications/                   # Complete page-by-page UX specifications (Pages 01–19)
    ├── 01-welcome.md                         # Page 01: Welcome & Quick Persona Launcher (/)
    ├── 02-onboarding.md                      # Page 02: Onboarding & Hardware Consent (/onboarding)
    ├── 03-assessment-hub.md                  # Page 03: Assessment Hub (/assessment)
    ├── 04-task-runner.md                     # Page 04: Cognitive Task Runner (/task/:dimId)
    ├── 05-profile-reveal.md                  # Page 05: Profile Reveal (<3-Min First Insight) (/profile-reveal)
    ├── 06-dashboard.md                       # Page 06: Adaptive Dashboard (/dashboard)
    ├── 07-dimension-detail.md                # Page 07: Dimension Deep Dive (/dimensions/:dimId)
    ├── 08-brain-twin.md                      # Page 08: Brain Twin Timeline & Time Travel (/brain-twin)
    ├── 09-ai-coach.md                        # Page 09: Explainable AI Coach (/coach)
    ├── 10-plan.md                            # Page 10: Adaptive Weekly Plan & Habits (/plan)
    ├── 11-goals.md                           # Page 11: Goals & Uncertainty ETA (/goals)
    ├── 12-collaboration.md                   # Page 12: AI Collaboration Score Deep-Dive (/collaboration)
    ├── 13-privacy.md                         # Page 13: Privacy Center & Vault Deletion (/privacy)
    ├── 14-settings.md                        # Page 14: Settings & Sensory Ergonomics (/settings)
    ├── 15-methodology.md                     # Page 15: Methodology, Limits & Ethics (/methodology)
    ├── 16-judge-mode.md                      # Page 16: Judge Mode & Defense Center (/judge-mode)
    ├── 17-system.md                          # Page 17: System States (404, Offline, Error) (/system/*)
    ├── 18-design-system.md                   # Page 18: Living Design System Showcase (/design-system)
    └── 19-layer-d.md                         # Page 19: Multimodal Voice & Scenario Projections (/layer-d)
```

---

## 🧭 UX Pipeline Stages & Detailed Descriptions

### 1. Strategy & Journey Flow (`01_strategy_and_journey/`)
- **[`UX_TRANSFORMATION_PLAN.md`](./01_strategy_and_journey/UX_TRANSFORMATION_PLAN.md)**: Master document articulating the shift from clinical deficit diagnosis to continuous cognitive calibration. Defines the 19-page journey graph, EMILY affective computing integration, the color psychology matrix, and the 4-tier Human UX Approval Protocol.
- **[`01-ux-strategy.md`](./01_strategy_and_journey/01-ux-strategy.md)**: Deep dive into the four core user personas (*Student Crammer, Knowledge Worker, Active Senior, Neurodivergent Learner*), the strict sub-3-minute time-to-first-insight guarantee, and epistemic transparency principles.
- **[`00-context.md`](./01_strategy_and_journey/00-context.md)**: Maps the official AI4Brain challenge criteria, scoring rubrics (Phase 1 60%, Phase 2 40%), and architectural team boundaries.

### 2. Design System & Token Architecture (`02_design_system_and_tokens/`)
- **[`DESIGN.md`](./02_design_system_and_tokens/DESIGN.md)**: Full design system manual covering the Doodle aesthetic: 4 px base spacing grid, 2 px tactile ink borders (`#1F1B3B`), `shadow-doodle` tactile offset drop shadows, perceptual OKLCH color ramps (Playful Lab light theme & Night Lab dark theme), and the Okabe-Ito colorblind-safe 10-dimension palette.
- **[`02-design-system.md`](./02_design_system_and_tokens/02-design-system.md)**: Complete contrast verification tables proving all semantic token pairs exceed WCAG 2.2 AA (4.5:1 for body copy, 3.0:1 for tactile borders and UI components).
- **[`stitch-design-tokens.md`](./02_design_system_and_tokens/stitch-design-tokens.md)**: Token specifications generated from Google Stitch MCP tool runs.
- **[`stitch-skill-guidelines.md`](./02_design_system_and_tokens/stitch-skill-guidelines.md)**: Design-system guidelines across 40+ component families adapted for doodle styling.
- **[`brian-brand-and-mascot.md`](./02_design_system_and_tokens/brian-brand-and-mascot.md)**: Specification for BRIAN the Axolotl mascot, including emotional states, lockups, and brand symbology.
- **[`direction-sprint.html`](./02_design_system_and_tokens/direction-sprint.html)**: Interactive, single-file prototype allowing dynamic switching between theme candidates (`Playful Lab`, `Calm Clarity`, `Night Lab`) and typography pairings.

### 3. Affective Computing & Interaction Engine (`03_affective_computing_and_emily/`)
- **[`EMILY_BEHAVIORAL_EMOTION_ENGINE.md`](./03_affective_computing_and_emily/EMILY_BEHAVIORAL_EMOTION_ENGINE.md)**: Architecture specification for **EMILY (Emotion & Micro-Interaction Listener for You)**:
  - **Zero Biometrics**: Complies with EU AI Act Art. 5(1)(f) by evaluating solely client-side pointer kinematics and keystroke intervals.
  - **Circumplex Model of Affect**: Continuously maps interaction dynamics across Valence (Negative ↔ Positive) and Arousal (Sluggish ↔ Agitated).
  - **7 Passive Kinematic Features**: Cursor velocity, tremor/jerk, path curvature ($\kappa$), click dwell time, rage-click bursts, hover hesitation, and pacing drift.
  - **Anti-Red Counter-Regulation**: Prohibits alarming red alert banners during cognitive strain, dynamically swapping in calming lavender/violet hues and pacing breaks.

### 4. Contracts, Decisions & State (`04_contracts_and_architecture/`)
- **[`contracts.md`](./04_contracts_and_architecture/contracts.md)**: TypeScript data contracts bridging frontend telemetry to the assessment engine, clustering service, and Layer B AI coach.
- **[`DECISIONS.md`](./04_contracts_and_architecture/DECISIONS.md)**: Architecture Decision Records (ADRs) `DEC-001` through `DEC-008` documenting typography selection, color spaces, state management (Zustand), and offline queues.
- **[`STATE.md`](./04_contracts_and_architecture/STATE.md)**: Chronological sprint tracker recording gate completions across all 19 screens.
- **[`ASSETS.md`](./04_contracts_and_architecture/ASSETS.md)**: Provenance and Open Source license documentation for all fonts (`Fredoka`, `Lexend`, `JetBrains Mono`), Lucide icons, and SVG illustrations.
- **[`CHANGELOG.md`](./04_contracts_and_architecture/CHANGELOG.md)**: Conventional commit log and milestone history from `ui-m1` to `ui-v1.0-phase1`.
- **[`AGENT-EVALUATION-HANDOFF.md`](./04_contracts_and_architecture/AGENT-EVALUATION-HANDOFF.md)**: Step-by-step instructions for AI evaluators and teammates to verify the frontend independently.

### 5. Evaluation, Rubric Proofs & Quality Assurance (`05_evaluation_and_qa/`)
- **[`JUDGES-UI.md`](./05_evaluation_and_qa/JUDGES-UI.md)**: Master matrix directly linking all 11 competition rubric criteria to exact route URLs, signature React components, and responsive screenshot proofs.
- **[`QA-log.md`](./05_evaluation_and_qa/QA-log.md)**: Automated CI logs for token linter, copy linter, contrast validator, Vitest unit suite, and Playwright E2E tests.
- **[`GLOSSARY.md`](./05_evaluation_and_qa/GLOSSARY.md)**: Canonical dictionary of consumer cognitive terms and the **18 strictly forbidden clinical/deficit jargon words** (e.g., "deficit", "impairment", "diagnosis", "pathology") enforced by `scripts/lint-copy.mjs`.

### 6. Page Specifications (`06_page_specifications/`)
Complete functional, ergonomic, and accessibility specifications for each of the 19 screens in the application:
1. **[`01-welcome.md`](./06_page_specifications/01-welcome.md)**: Landing hero, persona quick-select, and non-clinical value proposition.
2. **[`02-onboarding.md`](./06_page_specifications/02-onboarding.md)**: Granular telemetry consent, sensory calibration, and privacy-first defaults.
3. **[`03-assessment-hub.md`](./06_page_specifications/03-assessment-hub.md)**: Dimension cards, test suite selector, and 2-minute baseline launcher.
4. **[`04-task-runner.md`](./06_page_specifications/04-task-runner.md)**: Active cognitive test runner with EMILY real-time affective modulation.
5. **[`05-profile-reveal.md`](./06_page_specifications/05-profile-reveal.md)**: First insight reveal under 3 minutes with visible uncertainty bands ($\pm\text{CI}$).
6. **[`06-dashboard.md`](./06_page_specifications/06-dashboard.md)**: Central dashboard, daily cognitive rhythm, readiness score, and quick actions.
7. **[`07-dimension-detail.md`](./06_page_specifications/07-dimension-detail.md)**: In-depth analysis of individual cognitive skills with historical trend lines.
8. **[`08-brain-twin.md`](./06_page_specifications/08-brain-twin.md)**: Digital twin visualizer with interactive timeline slider and time-travel projection.
9. **[`09-ai-coach.md`](./06_page_specifications/09-ai-coach.md)**: Explainable conversational coach featuring interactive "Why This?" decision trails.
10. **[`10-plan.md`](./06_page_specifications/10-plan.md)**: Adaptive training plan with protected rest-day pacing and habit contracts.
11. **[`11-goals.md`](./06_page_specifications/11-goals.md)**: Goal tracker with uncertainty-aware completion ETAs and non-predatory streaks.
12. **[`12-collaboration.md`](./06_page_specifications/12-collaboration.md)**: Human-AI collaboration efficiency score (0–100) and friction diagnostics.
13. **[`13-privacy.md`](./06_page_specifications/13-privacy.md)**: Granular privacy controls, GDPR export, and irreversible local vault deletion.
14. **[`14-settings.md`](./06_page_specifications/14-settings.md)**: Ergonomic controls, font size scaling, theme toggles, and sensory mode.
15. **[`15-methodology.md`](./06_page_specifications/15-methodology.md)**: Scientific validity, ethical safeguards, and 4-stage cognitive computation pipeline stepper.
16. **[`16-judge-mode.md`](./06_page_specifications/16-judge-mode.md)**: Dedicated evaluation panel for instant persona switching and fault injection.
17. **[`17-system.md`](./06_page_specifications/17-system.md)**: Robustness screens: 404 wayfinder, offline queue status, and error boundary self-healing.
18. **[`18-design-system.md`](./06_page_specifications/18-design-system.md)**: In-app living style guide and component demonstration gallery.
19. **[`19-layer-d.md`](./06_page_specifications/19-layer-d.md)**: Layer D bonus: Multimodal speech synthesis and counterfactual "what-if" simulations.

---

## ⚡ How the Team Can Check & Validate the UX Pipeline

To verify the UX implementation against all specifications in this directory, run the verification suite:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Run the complete automated QA pipeline
npm run qa:checks
```

The `npm run qa:checks` command runs 5 rigorous verification gates:
1. **`lint:tokens`**: Ensures 0 hardcoded colors, spacing values, font sizes, or transition durations exist in the codebase.
2. **`lint:copy`**: Validates that all UI copy, error strings, and mock fixtures are 100% compliant with the non-clinical, zero-guilt rules in `GLOSSARY.md`.
3. **`check:contrast`**: Validates all 21 Light and Dark theme semantic token pairs against WCAG 2.1 AA/AAA contrast ratios.
4. **`test` (Vitest)**: Executes unit and integration test suites, including EMILY emotion state engine and interactive review gates.
5. **`build` (Vite)**: Verifies that TypeScript types compile cleanly and production bundle builds with zero errors.

---

## 📸 Responsive Verification Proofs

Visual verification screenshots for all 19 screens at mobile (`375 px`), tablet (`768 px`), and desktop (`1440 px`) breakpoints are located in:
`docs/ui/screenshots/`
