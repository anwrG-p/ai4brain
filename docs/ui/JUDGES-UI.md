# Rubric criteria mapped to screens

Brand v2 screens. Routes and files: `docs/design/BRAND-V2.md`. Add `?judge=1` to any URL to show the evaluator tools (Simulate offline, the human review gate, stage and preset controls); `?judge=0` hides them. Without the flag, none of them render. Brand v2 screenshots of these screens are in `docs/ui/screenshots/` (decision DEC-011).

| Criterion (weight) | Where to look | Proof in code |
| :--- | :--- | :--- |
| **Relevance** (12%) | `/` → `/baseline` (6 exercises) → `/results` → `/dashboard` (5-skill chart, progress curve); `/coach` (Loti); `/privacy` | `features/flow/`, `features/insights/`, `features/loti/` |
| **Quality** (12%) | Every screen, light and dark, at 375, 768 and 1440 px | `npm run qa:checks`; Playwright e2e with axe (`frontend/e2e/`) |
| **Innovation** (12%) | Loti's bubbles and answer chips; Momo's mood guess you can correct; the classroom board | `components/features/characters/`, `features/loti/` |
| **UX** (9%) | First insight in about 2 minutes (the baseline); one primary button per screen; returning devices go straight to Home | `pages/WelcomePage.tsx`, `pages/BaselinePage.tsx`, e2e `returning.spec.ts` |
| **Explainability** (9%) | "Why Loti picked this" on Home; "How we calculate this" (`/methodology`) with the real formulas, imported from code | `pages/MethodologyPage.tsx`, `features/insights/pillars.ts` |
| **Safety** (6%) | Equal-weight consent on Results; Export / Delete my data; no clinical words; crisis check before any AI reply | `npm run lint:copy`; `ai_coach/safety_guardrails.py`; [ADR 0002](../adr/0002-no-server-side-emotion-inference.md) |
| **Generalisation** (10%) | Exercises map to dimensions in a registry; the exercise runner's dimension preset switch shows under `?judge=1` | `config/dimensions.ts`, `pages/TaskRunnerPage.tsx`, `features/insights/pillars.ts` |
| **Robustness** (10%) | `/offline`, `/system-error`, `*`; Simulate offline under `?judge=1`; hidden tab pauses an exercise | `pages/SystemPage.tsx`, `features/assessment/ExerciseFrame.tsx` |
| **Profile quality** (8%) | Scores only from your sessions; "Not measured yet" when data is missing; ranges in "View as table" | `features/insights/PillarRadar.tsx`, `taskScores.ts` |
| **Plan relevance** (6%) | Train focuses the weakest skill; `?pillar=<id>` | `pages/TrainPage.tsx`, `features/train/catalog.ts` |
| **Defense** (6%) | `?judge=1` tools; this table; the docs index | [docs/README.md](../README.md) |

Paths are under `frontend/src/` unless they start with a top-level folder. *Rewritten 2026-10-31 for brand v2; the earlier matrix of 19 pages and 8 "signature components" is in git history.*
