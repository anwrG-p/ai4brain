# 07c: Flow cleanup (07 and 07b minors)

Status: ready-for-agent
Blocked by: 07
Spec: `../spec.md` (R8, R9, rule 2, rule 13, rule 14). Source: the brand-v2 SDD ledger (reviews of 07 and 07b). File ownership: `../parallel/CONTRACT.md` ("07c flow polish").

Each item below is a minor from the 07 or 07b review. None blocked those tickets; all are collected here.

## From the 07 review

1. A paused attempt's events are still scored. Drop the paused `task_id` and its events.
2. `?fast=1` needs an explicit e2e build flag too, not only mocks.
3. Escape on the instruction screen pauses and re-fetches. Ignore it before trials start.
4. "You finished all five" shows even when exercises errored. Count completions.
5. Rule 14: skip the login step when there is no Google client id, and hide "I already have an account" when there is no client id (controller ruling, user's few-buttons rule).
6. Baseline axe at 375 and 768, light and dark, plus an overflow check.
7. `welcome.spec` writes `docs/ui/screenshots`. Route it to `outputPath`.
8. `GoogleSignIn` caches a rejection and never retries.
9. Stale `LotiSays` docstring.

## From the 07b review (motion pass)

10. Call `setLeaving` before `go()` in both paths.
11. Suspense fallback: no blank after exit, and block the keyboard during exit.
12. Put the breathe animation on the HTML wrapper, not on the SVG `g`.
13. Spec line 124 (loops: demos allowed) and rule 2 (one-shot end-card burst allowed): update the wording.
14. Wave delay 400 ms.
15. `LotiSays` gets a `className` passthrough instead of duplicated markup.
16. Welcome axe with motion on, after the animations settle.
17. The fixation "+" appears instantly, with no fade or scale (ruling R9).

## Later user ruling

18. R10: the baseline has 6 exercises (Color Clash added as the 4th).

## Done when

- Each item above is fixed or explicitly ruled out in the report.
- `cd frontend && npm run qa:checks` is green, and the flow e2e specs pass.
- Commit with no AI attribution.
