# 10: Verify, anti-slop audit, screenshots, DEC-011, docs

Status: resolved
Blocked by: 01–09
Spec: `../spec.md` ("Constraints", "Anti-slop rules")

## Steps

1. **Checks.** From `frontend/`, run `npm run qa:checks`, then every e2e spec on Edge through the scratch config.
   - Axe must be clean in light and dark.
   - There must be no overflow at 375, 768 and 1440 px.
2. **Anti-slop audit.** Open every page in light and dark at 1440 and 375 px and grade it against the spec's 12 anti-slop rules.
   - Record a pass or fail per rule, per page, in Comments, with a screenshot path for each.
   - Fix every fail, or list it as a follow-up with a reason.
3. **UI/UX Pro Max pre-delivery checklist.** Run its §1–§3 (accessibility, touch, performance) and its light/dark checklist on the 4 key screens: Welcome, Results, Dashboard, Train.
4. **Screenshots.** Commit the regenerated `docs/ui/screenshots/`.
5. **Docs.**
   - **DEC-011** in `docs/ui/DECISIONS.md`: the brand v2 direction. It supersedes DEC-010, and supersedes DEC-007 for the redesigned pages. Record the user decisions U1–U5 and rulings R1–R7.
   - **`assessment_engine/HANDOVER.md`:** the consent gate and the new flow.
   - **`assessment_engine/GUIDE.md`:** where exercises appear now (baseline flow, Train page).
   - Set the spec and all tickets to `Status: resolved`.

## Done when

All the checks pass, the audit table is complete, and the commit has no AI attribution.

## Comments

### Anti-slop audit (rules 1–14), ticket 10

Every page was checked in light and dark at 1440 and 375 px: 60 committed captures in `docs/ui/screenshots/audit/` (`<page>-<theme>-<width>.png`, full page).
Automated probes on all 60 found:
- axe: 0 violations; no horizontal overflow.
- No gradient on any control or text. The only gradient image is the board's own dot grid on `#root` (the classroom-board ruling).
- No purple hue; `blur` only on the Results radar.
- No uppercase text, emoji, hype words or social proof.
- At most 1 primary fill per screen, and at most 1 box-shadow per page in light (0 in dark).
I also checked the captures by eye. P = pass, P* = pass with a note. **No fails.**

| Page | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | Screenshots |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Welcome `/` | P | P | P | P | P | P | P | P | P | P | P | P | P | P | [L1440](../../../docs/ui/screenshots/audit/welcome-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/welcome-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/welcome-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/welcome-dark-375.png) |
| Baseline instruction `/baseline` | P | P | P | P | P | P | P | P | P | P | P | P | P | P (Exit, More, Begin) | [L1440](../../../docs/ui/screenshots/audit/baseline-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/baseline-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/baseline-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/baseline-dark-375.png) |
| Results blurred `/results` | P | P (blur carries meaning) | P | P | P | P | P | P | P | P | P | P | P | P | [L1440](../../../docs/ui/screenshots/audit/results-blurred-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/results-blurred-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/results-blurred-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/results-blurred-dark-375.png) |
| Results clear | P | P | P | P | P | P | P | P | P | P | P | P | P | P | [L1440](../../../docs/ui/screenshots/audit/results-clear-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/results-clear-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/results-clear-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/results-clear-dark-375.png) |
| Home `/dashboard` (4 sessions) | P | P | P | P | P | P | P | P | P | P | P | P | P (3 blocks) | P (CTA, Loti bubble, View as table) | [L1440](../../../docs/ui/screenshots/audit/home-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/home-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/home-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/home-dark-375.png) |
| Home, Further explore open (6 sessions) | P | P | P | P | P | P | P | P | P | P | P | P | P (behind one control) | P | [L1440](../../../docs/ui/screenshots/audit/home-explore-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/home-explore-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/home-explore-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/home-explore-dark-375.png) |
| Train `/train` | P | P | P | P | P | P | P | P | P | P | P | P | P | P* | [L1440](../../../docs/ui/screenshots/audit/train-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/train-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/train-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/train-dark-375.png) |
| Exercise `/task/...?schema=stroop` | P | P | P | P | P | P | P | P | P | P | P | P | P | P (Pause hidden before Begin) | [L1440](../../../docs/ui/screenshots/audit/task-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/task-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/task-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/task-dark-375.png) |
| Loti `/coach` | P | P | P | P | P | P | P | P | P | P | P | P | P | P | [L1440](../../../docs/ui/screenshots/audit/coach-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/coach-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/coach-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/coach-dark-375.png) |
| You `/you` | P | P | P | P | P | P | P | P | P | P | P | P | P | P (3 rows) | [L1440](../../../docs/ui/screenshots/audit/you-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/you-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/you-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/you-dark-375.png) |
| Privacy `/privacy` | P | P | P | P | P | P | P | P | P | P | P | P | P | P* | [L1440](../../../docs/ui/screenshots/audit/privacy-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/privacy-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/privacy-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/privacy-dark-375.png) |
| Settings `/settings` | P | P | P | P | P | P | P | P | P | P | P* | P | P | P | [L1440](../../../docs/ui/screenshots/audit/settings-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/settings-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/settings-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/settings-dark-375.png) |
| How we calculate this `/methodology` | P | P | P | P | P | P | P | P | P | P | P | P | P* | P | [L1440](../../../docs/ui/screenshots/audit/methodology-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/methodology-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/methodology-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/methodology-dark-375.png) |
| Offline `/offline` | P | P | P | P | P | P | P | P | P | P | P | P | P | P | [L1440](../../../docs/ui/screenshots/audit/offline-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/offline-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/offline-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/offline-dark-375.png) |
| Not found `/nope` | P | P | P | P | P | P | P | P | P | P | P | P | P | P | [L1440](../../../docs/ui/screenshots/audit/not-found-light-1440.png) · [L375](../../../docs/ui/screenshots/audit/not-found-light-375.png) · [D1440](../../../docs/ui/screenshots/audit/not-found-dark-1440.png) · [D375](../../../docs/ui/screenshots/audit/not-found-dark-375.png) |

P* notes (all are passes under earlier rulings):
- **Train, rule 14:** the exercise rows are list links, one per exercise, with one filled Start (ticket 09 ruling).
- **Privacy, rule 14:** three quiet controls (Choose, Export, Delete) and no primary (accepted in 09d).
- **Settings, rule 11:** the selected theme radio uses the brand fill as a state, not as a call to action.
- **Methodology, rule 13:** it is the explanation page itself, with 5 closed topics.

### UI/UX Pro Max §1–§3 (Welcome, Results, Home, Train; 375×812, light and dark)

Guidelines from `search.py --domain ux` (accessibility, touch, performance, reduced motion, ARIA labels, headings). The checks ran as a probe in Edge.
Screenshots: [Welcome](../../../docs/ui/screenshots/audit/welcome-light-375.png) · [Results](../../../docs/ui/screenshots/audit/results-blurred-light-375.png) · [Home](../../../docs/ui/screenshots/audit/home-light-375.png) · [Train](../../../docs/ui/screenshots/audit/train-light-375.png), and the `-dark-375` files beside them.

| Check (severity) | Welcome | Results | Home | Train |
|---|---|---|---|---|
| §1 Contrast ≥ 4.5 / 3 (High) | P (check:contrast 112/112, axe 0) | P | P | P |
| §1 Focus states (High): Tab ×12, every stop has an outline or ring | P | P | P | P |
| §1 Keyboard order (High): skip link, logo, theme, content, tabs | P | P | P | P |
| §1 ARIA labels on icon-only controls (High) | P (0 unnamed) | P | P | P |
| §1 Images and SVG named or hidden (High) | P | P | P | P |
| §1 Heading hierarchy (Med) | P (h1) | P (h1) | P (h1, h2, h2) | P (h1, h2×5) |
| §1 Reduced motion (High): running animations after load | P (0) | P (0) | P (0) | P (0) |
| §2 Touch targets ≥ 44 px (High) | Fail → fixed (logo link 40×40 → 44; shell e2e now checks it) | same | same | same |
| §2 Touch spacing ≥ 8 px (Med) | P | P | P | P |
| §3 Font loading (Med): `font-display: swap` with a fallback stack | P | P | P | P |
| §3 Layout shift (High): CLS | 0 | 0.001 | 0.044 | 0.034 (all < 0.1) |
| §3 Load to network idle (local preview) | 0.61 s | 0.59 s | 0.63 s | 0.59 s |
| Light/dark parity | P (axe clean in both; dark cards in the board's hue) | P | P | P |
