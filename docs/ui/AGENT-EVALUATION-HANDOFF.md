# Agent Evaluation & Audit Handoff Guide (`docs/ui/AGENT-EVALUATION-HANDOFF.md`)

> **History.** This describes the UI before brand v2 (BRIAN, the Doodle design, 19 pages, 7 dimensions), superseded on 2026-10-31. Current: the [root README](../../README.md), the [glossary](../../docs/GLOSSARY.md) and `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

This guide is designed for any secondary AI agent, external code auditor, or competition evaluator assessing the frontend implementation of **SynapseTwin (CISTAC 1.0 AI4Brain)**.

---

## 1. Quick Repository & Version Snapshot

- **Repository**: [`https://github.com/anwrG-p/ai4brain`](https://github.com/anwrG-p/ai4brain)
- **Production UI Branch**: [`ui/main`](https://github.com/anwrG-p/ai4brain/tree/ui/main)
- **Phase 1 Production Release Tag**: [`ui-v1.0-phase1`](https://github.com/anwrG-p/ai4brain/releases/tag/ui-v1.0-phase1)
- **Local Working Directory**: `c:\Users\Smida\Desktop\CISTAC`
- **Scope Boundary**: Strictly isolated to `frontend/` and `docs/ui/` (root files and backend folders untouched).

---

## 2. Reading Roadmap for the Reviewing Agent

Instruct the evaluating agent to read the documentation in this exact order to understand the architecture, rubric alignment, and verification evidence:

1. **Rubric-to-Code Matrix**: `docs/ui/JUDGES-UI.md`
   - Maps all 11 competition criteria (Relevance, Quality, Innovation, UX, Explainability, Safety, Generalisation, Robustness, Profile Quality, Plan Relevance, Defense) directly to route URLs, React components, and verification screenshots.
2. **Architectural Decisions**: `docs/ui/DECISIONS.md`
   - `DEC-001` to `DEC-006` covering repository boundaries, design system lock, dimension registries, and accessibility mandates.
3. **Automated QA & Contrast Logs**: `docs/ui/QA-log.md`
   - Computed contrast numbers (15.61:1 Playful Lab ink, 16.12:1 Night Lab ink), Okabe-Ito colorblind markers, Vitest logs, and Playwright `axe-core` accessibility results.
4. **Backend Contracts & Schemas**: `docs/ui/contracts.md`
   - REST/JSON schemas for `GET /v1/twin/state`, `POST /v1/tasks/next`, `POST /v1/coach/message`, and `POST /v1/collaboration/evaluate`.
5. **Page Specifications**: `docs/ui/pages/01-welcome.md` through `docs/ui/pages/19-layer-d.md`
   - Full 11-section specifications detailing information architecture, WCAG 2.1 AA checklists, edge cases, Definition of Done, and design critique reviews.

---

## 3. How the Reviewing Agent Can Run & Verify the Code

The agent can execute the automated verification commands in `frontend/`:

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Run the complete automated QA pipeline:
# - lint:tokens: enforces 100% OKLCH design tokens (0 arbitrary hex colors)
# - lint:copy: enforces non-clinical and zero-guilt streaks
# - check:contrast: validates all 21 Light & Dark token pairs >= WCAG AA thresholds
# - test: runs 22/22 unit and component tests (Vitest)
# - build: runs TypeScript strict compilation and Vite production bundling
npm run qa:checks

# 3. Run Playwright End-to-End & Axe-Core Accessibility Tests:
npm run qa:e2e

# 4. Launch the local development preview server:
npm run dev
# -> Opens http://localhost:5173
```

---

## 4. Key Architectural Signatures to Inspect

Instruct the evaluating agent to inspect the 8 Signature Components:

1. **Signature #1 `<UncertaintyRadar />`** (`frontend/src/components/signature/UncertaintyRadar.tsx`): Dual-polygon confidence bands with diagonal SVG hatching on low-confidence dimensions ($< 0.60$) and Okabe-Ito glyphs.
2. **Signature #2 `<BrainTwinTimeTravel />`** (`frontend/src/components/signature/BrainTwinTimeTravel.tsx`): 14-snapshot historical timeline scrubber with snapshot diffing.
3. **Signature #3 `<WhyThisPanel />`** (`frontend/src/components/signature/WhyThisPanel.tsx`): 5-tab explainability drawer (*Data, Inference, Advice, Confidence, Counterfactual*).
4. **Signature #4 `<ProjectionFanChart />`** (`frontend/src/components/signature/ProjectionFanChart.tsx`): Bayesian trajectory fan with transparent credible intervals ($\pm \sigma, \pm 2\sigma$).
5. **Signature #5 `<CollaborationScoreCard />`** (`frontend/src/components/signature/CollaborationScoreCard.tsx`): 0–100 metacognitive collaboration metric with dynamic weighting.
6. **Signature #6 `<PrivacyCenter />`** (`frontend/src/components/signature/PrivacyCenter.tsx`): Hardware lock banner, telemetry JSON viewer, and GDPR right-to-erasure suite.
7. **Signature #7 `<JudgeModeDock />`** (`frontend/src/components/signature/JudgeModeDock.tsx`): Evaluator dock with 6 seeded personas, fault injection switches, and dimension generalisation toggles.
8. **Signature #8 `<Mascot />`** (`frontend/src/components/signature/Mascot.tsx`): Interactive companion featuring 5 cognitive states (`idle`, `hello`, `thinking`, `celebrate`, `rest`).

---

## 5. Ready-to-Use Prompt Template for External Agent

Copy and paste the prompt below directly into the reviewing agent (e.g., Claude, ChatGPT, Cursor, Gemini, etc.):

```markdown
You are an expert AI software architect and competition evaluator assessing the frontend implementation for the AI4Brain "Cognitive Growth Agent" (CISTAC 1.0) competition.

The production codebase is available on GitHub at:
Repository: https://github.com/anwrG-p/ai4brain
Branch: ui/main
Tag: ui-v1.0-phase1

Please evaluate the frontend codebase in `frontend/` and documentation in `docs/ui/` against the competition criteria:

1. ARCHITECTURAL ASSESSMENT:
   - Review `docs/ui/JUDGES-UI.md`, `docs/ui/DECISIONS.md`, and `docs/ui/contracts.md`.
   - Assess how well the 4-layer architecture (Layer A: Adaptive Assessment, Layer B: Conversational AI Coach, Layer C: Metacognitive Dashboard & Habits, Layer D: Multimodal Voice & Counterfactual Projections) is realized in `frontend/src/pages/`.

2. ACCESSIBILITY & DESIGN SYSTEM:
   - Review `frontend/src/styles/tokens.css` and `docs/ui/02-design-system.md`.
   - Inspect WCAG 2.1 AA compliance, keyboard navigability, Okabe-Ito colorblind palette with vertex glyphs, and non-clinical/zero-guilt copy guardrails (`frontend/src/utils/copyLinter.ts`).

3. CODE QUALITY & TEST COVERAGE:
   - Inspect `frontend/src/tests/designSystem.test.tsx` (22 unit tests) and `frontend/e2e/*.spec.ts` (Playwright E2E suites).
   - Evaluate TypeScript strictness, component decomposition, and state management (Zustand).

4. COMPETITION RUBRIC SCORING:
   - Provide an objective evaluation and preliminary rating for each of the 11 CISTAC criteria:
     * Relevance (12%), Quality (12%), Innovation (12%), UX (9%), Explainability (9%), Safety (6%) [Phase 1: 60%]
     * Generalisation (10%), Robustness (10%), Profile Quality (8%), Plan Relevance (6%), Defense (6%) [Phase 2: 40%]
   - Identify standout strengths and actionable suggestions for the final Phase 2 pitch presentation.
```
