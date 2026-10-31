# 09: App shell and cleanup

Status: ready-for-agent
Blocked by: 02, 03
Spec: `../spec.md` (U1, R6, R7, IA nav, Anti-slop rules)

## Shell (`AppShell`)

- Header: the logo, then **4 nav items**: Home (`/dashboard`), Train (`/train`), Loti (`/coach`), You (`/you`). Add a theme toggle that keeps the names "Dark (Night Lab)" and "Light (Playful Lab)".
- Mobile: the same 4 items as bottom tabs, with Lucide icons and labels.
- Remove from the header: EmilyMoodPill (Momo replaces it on the dashboard), the Privacy and Settings icons (both move under You), and the sign-in pill when the user is in a session.
- Footer: one muted line.
- `page-progress-badge`: remove it. It was a sprint-tracking badge, and R7 removes its test.

## Remove technical clutter app-wide (U1)

Delete these from the UI entirely:
- live JSON ("What BRIAN Sees")
- bound backend contracts and endpoint lists
- the "never collected" panels (the Privacy page keeps a plain sentence instead)
- receipt hashes
- QUEST+, staircase and persona switchers
- the "Inspect Payload JSON" panels
- the safeguards and biases panels
- the Layer A/B/C badges

Grep `frontend/src/pages` for: `v1/`, `JSON`, `QUEST`, `Layer `, `SAT-JEPA`, `contract`, `CISTAC`, `receipt`, `telemetry` as visible copy, `±`, `σ`.

## Judge tools (R6)

- The evaluator, inspector, stage and persona controls render **only** when `?judge=1` is in the URL. Remember the flag for the session.
- Update `e2e/testUtils.openJudgeMode` to navigate with `?judge=1`.

## Pages

| Page | Change |
|---|---|
| `/train` (new) | Pillar sections, each listing its exercises by consumer name. One "Start" per row. Loti bubble at the top. |
| `/coach` | A full Loti conversation page: `LotiBubbles` in a column, history of the user's choices, Loti `md`. |
| `/you` (new hub) | Profile, Privacy (consent status + change choice, delete my data), Settings, and "How we calculate this". |
| "How we calculate this" (`/methodology`) | The only place the pillar formulas, the brain-region mapping, the projection model and RCI appear. Plain intro first, details below. **No chemical claim** (U5). |
| Other routes (onboarding, assessment hub, brain-twin, profile-reveal, plan, goals, collaboration, layer-d, system, design-system) | Remove from the nav and redirect to the new equivalents (onboarding → `/`, assessment → `/train`, profile-reveal → `/results`, goals → `/dashboard`). Delete pages that become unreachable, or keep them only behind `?judge=1`. List each decision in Comments. |

## Tests

R7: rewrite `designSystem.test.tsx` and the e2e specs for the new pages, and delete the tests of deleted pages. Keep the theme-toggle names and the axe/overflow checks.

New tests:
- the nav has exactly 4 items
- no `v1/`, `QUEST`, `JSON` or `SAT-JEPA` visible on `/`, `/dashboard`, `/train`, `/coach` or `/you`
- judge controls are absent without `?judge=1` and present with it

## Done when

`qa:checks` is green, the e2e passes on Edge, and the commit has no AI attribution.
