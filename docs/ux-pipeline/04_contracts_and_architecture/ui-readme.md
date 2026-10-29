# UI Documentation Index (`docs/ui/README.md`)

Welcome to the frontend, UI, UX, and visual analytics documentation for our **CISTAC 1.0 — AI4Brain "Cognitive Growth Agent"** entry.

> **For Evaluators & Jury Members**: Start with **[`JUDGES-UI.md`](./JUDGES-UI.md)** for a direct mapping from every official Phase 1 (60%) and Phase 2 (40%) scoring criterion to the exact route, signature component, and verification screenshot that proves it.

---

## 📚 Core Documentation Suite

| Document | Purpose | Status |
| :--- | :--- | :--- |
| **[`00-context.md`](./00-context.md)** | Official challenge rules, rubric weights, team architecture sync, and working agreements. | Active |
| **[`01-ux-strategy.md`](./01-ux-strategy.md)** | Personas, $<3\text{-minute}$ first-insight flow, epistemic honesty principles, and non-clinical voice. | Active |
| **[`02-design-system.md`](./02-design-system.md)** | OKLCH color tokens, Okabe-Ito WCAG 3:1 dimension palette, typography, spacing, motion, and contrast table. | In Progress (Sprint) |
| **[`03-mascot.md`](./03-mascot.md)** | Original SVG mascot specification, 8 states, reduced-motion fallbacks, and hard exclusion rules. | Scheduled (Post-Dashboard) |
| **[`contracts.md`](./contracts.md)** | Full TypeScript API contract, bridge to `assessment_engine` & `README.md` endpoints, mock fixtures, and backend requests. | Active |
| **[`DECISIONS.md`](./DECISIONS.md)** | Architectural, design, and scope decision log (Context, Options, Choice, Why). | Active |
| **[`JUDGES-UI.md`](./JUDGES-UI.md)** | Official rubric-to-screen proof matrix with screenshot paths and verification instructions. | Active |
| **[`STATE.md`](./STATE.md)** | Live sprint tracker updated at the end of every step and session. | Active |
| **[`QA-log.md`](./QA-log.md)** | Automated token grep, WCAG contrast verification, non-clinical copy lint, `axe-core`, and Lighthouse logs. | Active |
| **[`ASSETS.md`](./ASSETS.md)** | Open-source license ledger for all self-hosted fonts, icon sets, and original SVG illustrations. | Active |
| **[`CHANGELOG.md`](./CHANGELOG.md)** | Chronological conventional-commit log and milestone tags (`ui-m1` through `ui-v1.0-phase1`). | Active |

---

## 🎨 Design Direction Sprint Showcase
- **[`direction-sprint.html`](./direction-sprint.html)**: Interactive 3-tile visual comparison (**Playful Lab** [Recommended], **Calm Clarity**, **Night Lab**) with live font-pairing switcher (`Fredoka + Lexend`, `Baloo 2 + Atkinson Hyperlegible`, `Sora + Lexend`), tactile button states, explainable metric card, and mini uncertainty radar with table toggle.

---

## 📄 Per-Page Specifications (`docs/ui/pages/`)
Every page is specified before implementation (Gate 1) and verified with 375 / 768 / 1440 px screenshots and two critique rounds before merge (Gate 2):
- `pages/18-design-system.md` — Living Style Guide (`/design-system`)
- `pages/01-welcome.md` — Welcome & Quick Persona Launcher (`/`) · **HERO**
- `pages/02-onboarding.md` — Onboarding & Granular Consent (`/onboarding`)
- `pages/03-assessment-hub.md` — Assessment Hub (`/assessment`)
- `pages/04-task-runner.md` — Cognitive Task Runner (`/task/:dimId`) · **HERO**
- `pages/05-profile-reveal.md` — First Brain Twin Reveal (`/profile-reveal`) · **HERO**
- `pages/06-dashboard.md` — Adaptive Analytics Dashboard (`/dashboard`) · **HERO**
- `pages/07-dimension-detail.md` — Dimension Deep-Dive (`/dimensions/:dimId`)
- `pages/08-brain-twin.md` — Brain Twin Timeline & Time Travel (`/brain-twin`) · **HERO**
- `pages/09-ai-coach.md` — Explainable AI Coach (`/coach`) · **HERO**
- `pages/10-plan.md` — Adaptive Weekly Plan & Exercises (`/plan`)
- `pages/11-goals.md` — Goals & Uncertainty ETA Tracker (`/goals`)
- `pages/12-collaboration-score.md` — AI Collaboration Score Deep-Dive (`/collaboration`)
- `pages/13-privacy-center.md` — Privacy Center & AI Visibility Inspector (`/privacy`)
- `pages/14-settings.md` — Settings & Accessibility Controls (`/settings`)
- `pages/15-methodology.md` — How It Works, Limits & Ethics (`/methodology`)
- `pages/16-judge-mode.md` — Demo & Judge Defense Center (`/judge-mode`)
- `pages/17-system-pages.md` — System States: 404, Error, Offline, LLM-Down (`/system/*`)
- `pages/19-layer-d.md` — Layer D Bonus: Voice Coaching & Scenario Projections (`/layer-d`)
