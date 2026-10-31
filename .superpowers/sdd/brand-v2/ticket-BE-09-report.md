# Ticket BE-09: clustering, hysteresis and Δc

## Branch and commits
- Branch `worktree-agent-a3cd3113050004c6f`, reset onto the BE-PORT tip `ae67522`.
- `e432305` feat(clustering): GMM practice profiles, hysteresis gate and delta_c (BE-09)
- `33afbf3` docs(sdd): BE-09 report
- Review fix round: the commit "fix(clustering): BE-09 review: validated load, naming threshold, versions, model_id" (see "Review fixes" below).

## What was built (`clustering_engine/`)

| File | Contents |
|---|---|
| `clustering_gmm.py` | See the bullets below. |
| `hysteresis.py` | `HysteresisGate.step(gamma) -> active`. A Schmitt trigger with δ = 0.15 and N_confirm = 3 (see below). |
| `explainability.py` | `delta_c(mu_target, mu_active, W=None) -> {pillar: float}`. `W` can be `None` (identity, d = 5), 1-D (a diagonal W_eval), or `[5, d]` (projects a latent difference onto the pillars). |
| `fit.py` | `python -m clustering_engine.fit [--users 200 --sessions 6 --data-seed 0 --k 9 --seed 0 --out models/clustering/gmm.json]`. |
| `pillar_adapter.py` | `# ponytail:` stand-in for BE-07: `session_pillars(events)` (see the bullets below). |
| `requirements.txt` | `scikit-learn==1.9.1` |
| `.gitignore` | Adds `models/clustering/`. |

**`clustering_gmm.py`**
- `fit_gmm(X, k=9, seed=0, *, pillars=None, features=None)` works on any `[n, d]` array. `features`, if given, must name all d columns. It standardises each column, then fits a full-covariance `GaussianMixture` with `reg_covar=1e-3`, `n_init=3` and `random_state=seed`.
- When n < K, it fits one component per distinct row (`k_eff = min(k, distinct rows)`). With n = 1 it doubles the row, because sklearn needs 2 samples and the one-component fit is unchanged. An empty or non-finite X raises `ValueError`.
- `posteriors(x, model)` / `model.posteriors(x)` return γ_k: `[k]` for one vector and `[n, k]` for a batch.
- `archetype_name(k)` returns the name for an archetype id (0–8). The model also has `model.name(component)`, `.means` (in input units), `.weights`, `.model_id`, and `save`/`load` (JSON, not pickle).
- **Loading is validated.** `from_dict`/`load` raise `ValueError` on any of these:
  - missing fields;
  - an unknown `covariance_type`;
  - `k` not equal to len(means), or ragged or non-numeric `means`;
  - `center` or `scale` not [d], or `scale` ≤ 0;
  - `weights` not [k], negative, or not summing to 1 (±1e-6);
  - `covariances` or `precisions_cholesky` with the wrong shape for the covariance type;
  - `archetype_ids` not null, or not k distinct ids in 0–8 (nulls allowed);
  - `features` neither empty nor d strings;
  - a bad `k_requested` or `seed`;
  - non-finite values;
  - a `model_id` that does not match the parameters.
- **Library versions.** Saved files record numpy, scikit-learn and scipy versions. Loading under different versions raises a `UserWarning`.
- **`model_id`** is the first 16 hex characters of the sha256 of the canonical JSON of the fitted parameters. Component indices only mean something within one `model_id`.

**The hysteresis gate**
- It switches only after 3 consecutive frames in which the same challenger leads the active cluster's posterior by strictly more than 0.15. The comparison is `> delta + 1e-12`, so a lead of exactly δ never counts, even when float rounding gives 0.4 − 0.25 = 0.15000000000000002.
- A frame inside the margin, or a different challenger, restarts the count.
- The first frame adopts the leader, and this does not count as a switch.
- The state is a dataclass, so BE-11 can persist it per user with `asdict` and `HysteresisGate(**d)`.

**`pillar_adapter.py`**
- `session_pillars(events)` gives one 0–100 row per session: 100 × the mean `score_norm` of the exercises feeding each pillar (sources from `pillars.ts` PILLAR_WEIGHTS).
- A session missing any pillar is skipped, never imputed (R15).

**Archetypes.** The names are plain consumer words describing a practice style, never an emotion or a clinical state: Steady planner, Nimble switcher, Careful checker, Keen recaller, Quick spotter, All-rounder, Fresh starter, Balanced builder, Methodical solver.
- Each name has a prototype pillar profile, in SDs from everyone's mean.
- Fitted components are matched one-to-one to the prototypes with a Hungarian assignment, using each component's responsibility-weighted pillar profile.
  - The profile is first shrunk to at most 1.5 SD (`PROFILE_CAP`), so a very pronounced cluster is named by its shape.
  - Pairs costing more than `MAX_NAME_COST = 1.0` (squared SDs) are priced out before the match. The match therefore names as many components as it can within the threshold.
  - A component with no acceptable prototype keeps no id (`None`) and shows as "Profile N" (its 1-based index).
  - Both thresholds are judgement, not evidence.
- Named components come first, sorted by archetype id. Unnamed ones follow, largest first. The result is deterministic.
- With K > 9, at most nine components are named.
- A latent with d ≠ 5 is named through `pillars=` (the pillar rows behind it). If `pillars` is not given, every component is "Profile 1…K".

**Fit on the default synthetic data** (200 users × 6 sessions, data seed 0, K = 9, seed 0):

| Component | Weight |
|---|---|
| Steady planner | .119 |
| Keen recaller | .182 |
| All-rounder | .213 |
| Fresh starter | .063 |
| Balanced builder | .166 |
| Methodical solver | .115 |
| Profile 7 | .064 |
| Profile 8 | .043 |
| Profile 9 | .034 |

On this synthetic data only 6 of the 9 names fit within the threshold. The generator has a strong general factor (users differ mostly in overall level), so single-pillar profiles such as "Nimble switcher" or "Quick spotter" rarely stand out. Before this round, the forced one-to-one match put those names on clusters that did not have that shape.

## Tests
`clustering_engine/tests/`: 84 tests in `test_clustering_gmm.py`, `test_hysteresis.py` and `test_explainability.py`.

After the review round, a full `pytest -q` from the repo root gave **942 passed, 1 xfailed, 0 warnings**. The xfail is pre-existing and not from this ticket. `python -W error -m clustering_engine.fit` runs clean.

## Acceptance criteria

| AC / ask | Where |
|---|---|
| `fit_gmm`, K = 9 default, selectable | `test_k_defaults_to_nine_and_is_selectable` |
| Works on any [n, d], independent of BE-10 | `test_any_latent_width_works_unnamed_or_named_by_pillars` (d = 8) |
| Deterministic given a seed | `test_deterministic_given_a_seed`, golden fit |
| n < K degrades gracefully | `test_fewer_rows_than_k_degrade_to_one_component_per_row[1,2,4,8]`, `test_duplicate_rows_count_once` |
| Posteriors sum to 1 | `test_posteriors_sum_to_one_single_and_batch` |
| Boundary oscillation gives 0 switches | `test_boundary_oscillation_inside_the_margin_never_switches`, `test_oscillation_beyond_the_margin_never_confirms` |
| 3 confirmations give exactly 1 switch | `test_three_confirmations_switch_exactly_once`, `test_a_different_challenger_restarts_the_count` |
| Δc keyed by pillar, checked by hand on a 2-cluster toy | `test_two_cluster_toy_identity_by_hand`, `..._diagonal_weights_by_hand`, `test_latent_centroids_project_onto_pillars_by_hand` |
| Non-clinical, non-emotional names checked against `ai_coach/banned_terms.json` | `test_archetype_names_pass_the_banned_terms_list` (all rules through `lint_text`, plus an emotion-word regex, the 9 names and "Profile N") |
| Names map to their planted centroids | `test_each_planted_profile_gets_its_own_name` (no `if` guards), `test_a_profile_far_from_every_prototype_stays_unnamed` |
| Validated load | `test_malformed_models_are_rejected` (27 malformed dicts), `test_well_formed_variants_still_load`, `test_other_library_versions_warn_on_load`, `test_model_id_tracks_the_fitted_parameters` |
| Exactly-δ edge | `test_a_lead_of_exactly_delta_never_counts[0.15-0.3, 0.25-0.4]`, `test_a_lead_just_beyond_delta_counts` |
| Golden fit on fixed synthetic data under a fixed seed | `test_golden_fit_on_fixed_synthetic_data` (40 users × 3 sessions, data seed 7: ids, names, weights ±1e-3, means ±0.05; asserts the installed scikit-learn equals the pinned one) |
| Model saved under `models/clustering/` (gitignored) by `python -m clustering_engine.fit` | `test_fit_script_writes_a_loadable_model`, `test_save_and_load_give_the_same_posteriors`, `git check-ignore` |
| scikit-learn pinned | `clustering_engine/requirements.txt` |
| No HTTP routes | None were added. `POST /v1/clustering/evaluate` is left for BE-11. |

There are no routes, so there is no curl evidence.

## Notes
- **What a "cluster" is.** It is a session-level practice profile over pillar scores. No emotion, mood or clinical input or output is involved.
- **Golden values depend on the data.** The golden values are tied to `pillar_adapter.py` and to the BE-08 generator. Swapping in BE-07's features will change the fitted means, so the golden constants in `test_clustering_gmm.py` must be regenerated in the same change.
- **Names describe the relative profile.** Names come from the profile relative to everyone, not from the absolute level. For example, "Steady planner" means focus leads relative to the population, not that focus is the user's highest raw score.

## Review fixes (round 1)
1. **Important: validated load.** Covered above under "Loading is validated", with 27 parametrized malformed cases.
2. **δ edge.** The comparison is now `> delta + 1e-12`, with strict `>` documented. There are tests at exactly δ (`0.3 − 0.15`, exact in floats) and at float-rounded δ (`0.4 − 0.25`), and a test just beyond δ.
3. **Naming.**
   - Added the cost threshold, with prices-out-before-match, and the profile cap. Components with no fit fall back to "Profile N".
   - The planted-centroid test now asserts all 9 names in order against their planted centroids.
   - A new test checks that an alternating-shape cluster stays unnamed.
4. **Versions.** They are stored in `to_dict`, and a mismatch on load warns. The golden test asserts that the installed scikit-learn equals the version pinned in `requirements.txt`.
5. **`model_id`.** Added as a hash of the fitted params, and checked on load. The BE-11 contract is below.
6. **`features` length.** `fit_gmm(features=...)` must match d (`test_features_must_name_every_column`).
7. **Parametrize spacing.** Fixed to `"target, active, W"`.

`archetype_name(k)` now raises for ids outside 0–8; numbered profiles come from `model.name(i)`.

## Requests
1. **BE-07:** replace `clustering_engine/pillar_adapter.py` (`# ponytail:`) with `brain_twin_jepa/features.py` per-session pillar scores in `fit.synthetic_pillars`.
   - Delete the adapter and its test.
   - Refresh `GOLDEN_IDS`, `GOLDEN_WEIGHTS` and `GOLDEN_MEANS`.
   - Re-check how many of the 9 names fit within `MAX_NAME_COST` on the real features, and tune the prototypes or the threshold there if needed.
2. **BE-11:**
   - Load `models/clustering/gmm.json` with `ClusterModel.load`. Treat its `ValueError` as "no model" and return 501 (R15). Surface the version `UserWarning` in logs.
   - Keep one `HysteresisGate` per user, persisted via `dataclasses.asdict`, and **store the `model_id` with it**. When the served model's `model_id` differs from the stored one, reset the gate (a fresh `HysteresisGate()`), because component indices are not comparable across models.
   - Choose μ_target for Δc. The suggestion is the highest-posterior non-active cluster, or a user-chosen goal.
   - The gate's per-user state is per-user data, so it must be added to delete and export in `telemetry_store.py`.
3. **BE-10:** to cluster on the latent, call `fit_gmm(latent, pillars=session_pillar_rows)` so the components keep consumer names, and pass `W=[5, d]` to `delta_c` to report Δc per pillar.
4. **Root install and Docker:** `pip install -r requirements.txt` now pulls scikit-learn (plus joblib and threadpoolctl). `backend/Dockerfile` installs the root requirements, so the image grows by about that much. The image does not ship a fitted `models/clustering/gmm.json`, so BE-11 must fit it at build time or return 501 when it is missing (R15).
