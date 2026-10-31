# Parallel wave contract (brand v2: 07c + 09 split)

The user asked for more agents in parallel, one per part of the platform. Each agent works in its own git worktree. The controller merges the worktrees into `feat/ui-calm-clean`. Ticket 08 (the dashboard) runs in the main tree at the same time.

## File ownership

Edit only the files you own. Anything else is read-only. If you need a change outside your files, write it under "Requests" in your report.

| Ticket | Owns |
|---|---|
| 07c flow polish | `pages/WelcomePage.tsx`, `pages/BaselinePage.tsx`, `pages/ResultsPage.tsx` (minors only), `features/flow/*`, `features/assessment/ExerciseFrame.tsx` (+ test), `LoginSheet`/`GoogleSignIn`, `LotiSays` in `features/loti/LotiBubbles.tsx` (className passthrough only), `styles/tokens.css` (motion block only), `e2e/welcome.spec.ts`, `e2e/flow.spec.ts`, spec.md lines 124 and rule 2 |
| 09a shell | `App.tsx`, `components/layout/*` (AppShell, nav, footer, theme toggle), judge mode (`?judge=1`, R6), `e2e/testUtils.ts`, `src/tests/designSystem.test.tsx` (shell and legacy blocks), `pages/TaskRunnerPage.tsx`, the Mascot copy, deletion and redirects of legacy pages (Onboarding, AssessmentHub, ProfileReveal, Plan, Goals, Collaboration, LayerD, BrainTwin, DimensionDetail, DesignSystem, AiCoachPage, System and Auth as decided). Routes: `/train`→TrainPage, `/coach`→CoachPage, `/you`→YouPage, `/privacy`, `/settings`, `/methodology` |
| 09b train | `pages/TrainPage.tsx` (new), `features/train/*` (new), `e2e/train.spec.ts` |
| 09c coach | `pages/CoachPage.tsx` (new), `features/loti/*` except the `LotiSays` passthrough (keep the public APIs of `LotiBubbles` and `scriptedBrain` backward-compatible, since Welcome, Results and Dashboard use them), `e2e/coach.spec.ts` |
| 09d you | `pages/YouPage.tsx` (new), `pages/PrivacyPage.tsx`, `pages/SettingsPage.tsx`, any profile view inside You, `e2e/you.spec.ts` (+ the existing privacy/settings specs) |
| 09e methodology | `pages/MethodologyPage.tsx`, `e2e/methodology.spec.ts` |

## Shared rules

- **Page shape.** Pages are default exports with no required props. Each page renders its own `<h1>` and uses the existing AppShell layout.
- **Stubs for 09a.** 09a creates stub files for TrainPage, CoachPage and YouPage only if its build needs them. Mark each stub with `// stub: replaced by 09b/09c/09d`. The controller keeps the owner's version on merge.
- **Tokens.** Do not edit `styles/tokens.css` (07c alone may, motion block only). Use existing tokens and classes only. Run `lint:tokens` and keep it clean.
- **designSystem.test.tsx.** Page agents may delete or rewrite only the describe block for their own page. Put new tests in your own files.
- **Binding spec rules:** rule 13 (≤3 blocks above the fold, paragraphs ≤2 lines, details behind one "More"), rule 14 (one primary button and ≤2 quiet controls), the copy-trim section of `issues/09-shell-cleanup.md`, and a word-budget test (≤60 visible words above the fold at 1440×900).
- **Text.** Consumer wording only. No visible `v1/`, `QUEST`, `JSON`, `SAT-JEPA`, `contract`, `receipt`, `±` or `σ` (except on `/methodology`).
- **Motion (R8).** Gentle entrances only. Reduced motion means none.
- **Characters.** Reuse Loti, Dolphin and Momo from `components/features/characters`. Do not draw new ones.
- **Setup.** In the worktree, run `cd frontend && npm ci` first.
- **Checks.** `npm run qa:checks` must be green in your worktree. Run Edge Playwright with a scratch config (`channel: 'msedge'`, not committed) for your own spec, with axe in light and dark at 375/768/1440 and no overflow.
- **Commits.** Commit on your worktree branch. No AI attribution: no Co-Authored-By lines (user rule).
- **Report.** Write it to `C:\Users\mazen\OneDrive\Documents\Aura\ai4brain\.superpowers\sdd\brand-v2\ticket-<id>-report.md`, using the main-tree absolute path. Include your branch name, commits, tests, screenshot paths, anything removed (before → after) and Requests.
