# 04: Pillar math and local session store (pure, tested)

Status: resolved
Blocked by: —
Spec: `../spec.md` (R5, U5). Source: `docs/Rou7 zebda cognitive intelligence.docx`.

## The doc's weights (verbatim)

| Pillar | Weights |
|---|---|
| Focus & Strategy | 0.45·OSPAN + 0.30·OTS_Planning + 0.25·FluidMatrices |
| Mental Agility | 0.40·ANT_Conflict + 0.40·DCCS_SwitchCost + 0.20·ErrorRecovery |
| Impulse Control | 0.50·SST_SSRT + 0.30·OTS_Execution + 0.20·DDM_Caution |
| Deep Memory | 0.55·MST_LDI + 0.45·PAL_FirstTrialMemory |
| Visual Radar | 0.50·UFOV_SOA + 0.50·ANT_Orienting |

Improvement counts as "real" only when RCI ≥ 1.96.

## Input mapping

Document this in the code. Every input is a 0–100 score.

| Input | Source |
|---|---|
| OSPAN | n-back d′, log-linear correction, scaled |
| OTS_Planning | tower planning time and optimality |
| OTS_Execution | tower `l_min / l_user` |
| FluidMatrices | matrix accuracy, plus relational accuracy weighted by hops |
| ANT_Conflict | Stroop RT cost (incongruent − congruent, correct trials only), inverted and scaled |
| DCCS_SwitchCost | n-back switch-trial delta |
| ErrorRecovery | accuracy on the trial right after an error |
| SST_SSRT | Stroop incongruent accuracy, marked `proxy: true` |
| DDM_Caution, PAL_FirstTrialMemory | omitted (no source) |
| MST_LDI | P(similar \| lure) − P(similar \| new) |
| UFOV_SOA | QUEST threshold ms, inverted and scaled |
| ANT_Orienting | UFOV peripheral accuracy |

## Functions (`frontend/src/features/insights/`)

- `taskScores(events)`
- `pillarScores(inputs)`
  - Renormalises the weights over the inputs that are available.
  - Returns `{ score|null, uncertainty, coverage, proxies }`.
  - The score is `null` when coverage is below 0.3.
  - Uncertainty grows as coverage falls and as trials drop.
- `unifiedScore`
- `projection(history, opts)`
  - Formula: `T(t) = Tmax − (Tmax − T0)·e^(−α·N) − λ·Δt_idle`.
  - Returns the `optimal` series (4 sessions a week) and the `decay` series (no training) for 30 and 90 days.
  - α is fitted from history, with a fallback when there are fewer than 3 points.
  - Document the Tmax and λ defaults.
- `rci(current, baseline, rxx = 0.8, sd = 10)` and `isRealImprovement`
- `sessionStore.ts`
  - Uses `localStorage['synapsetwin_sessions_v1']`, with try/catch and a version field.
  - `clearSessions()` is wired into `PrivacyPage`'s purge, next to `tracker.clear()`.
- A goals slice, persisted the same way.

## Tests

- The weights are exact.
- Renormalisation is correct.
- Coverage below 0.3 returns `null`.
- LDI and d′ give the expected values on known tables.
- RCI is correct at the 1.96 boundary.
- The projection rises monotonically toward Tmax, and the decay series stays below the optimal one.
- The store round-trips, ignores corrupt data, and is empty after clear.

## Done when

`qa:checks` is green, and the commit has no AI attribution.
