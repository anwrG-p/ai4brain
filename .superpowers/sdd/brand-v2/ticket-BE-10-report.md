# Ticket BE-10 report: SAT-JEPA brain twin (after review fix rounds 1 and 2)

## Branch and commits
- Branch: `worktree-agent-abcde342e9ec768d4`, based on `ae67522` (the BE-PORT tip).
- Commits:
  - `9373880` feat: first version of the SAT-JEPA brain twin
  - `e48f8d9` docs: first report (superseded by this one)
  - `b6b0546` merge of `d9655cb` (BE-07: `telemetry_io.py`, `features.py`, golden vectors, from `feat/ui-calm-clean`)
  - `4e8ffe0` fix: review round 1 (shadow mode, promotion gate, BE-07 features, ragged histories)
  - `54c92c8` docs: report after round 1
  - round 2 (one commit, code and this report): triangular calibrated range, padding masks, independent RNG streams in the gate, skipped-user counts, `validated` on `not_enough_data`

## Headline (read this first)
- **The twin runs in shadow mode (R17).**
  - Every forecast says `validated: false`.
  - Only `brain_twin_jepa/validate.py` can flip that, after passing its gate on real users. It has not been run on real users, because none exist yet.
- **Its interval is calibrated on synthetic users.**
  - At full scale (1000 users, untouched seed 2026), held-out coverage is 0.780–0.827 in every pillar × h cell against a nominal 0.80.
  - The CI-test config (400 users, 400 steps) gets 0.744–0.833 per cell.
- **Its forecasts are barely better than averaging the user's past sessions, and in the CI config they are worse:**
  - **Full run (1000 users, 1500 steps):** the twin beats the mean of history by 0.55–0.90 points of MAE per h (15.9 vs 16.4–16.9).
  - **CI-test config (400 users, 400 steps):** the twin is **worse than the mean of history by 1.4–1.5 points at every h** (MAE 18.0–18.5 vs 16.4–17.1).
  - **Gate dry run on fresh synthetic users (seed 2027):** the full-run twin gains 0.40 points with 95% CI [−0.00, 0.87]. The gate refuses it, as it should.

## Files
| File | What |
|---|---|
| `brain_twin_jepa/jepa_model.py` | Holds `session_record` (a BE-07 session → record), `session_matrix`, `SATJEPA`, `LeakyIntegrator`, `Calibration`, `BrainTwin` and the module-level `forecast()`. |
| `brain_twin_jepa/train.py` | BE-07 data path (in-process BE-08 users, or `--data DIR --source LABEL`), ragged `to_tensors`, deterministic training, `forecasts` (one row per user × n × h, twin and naive residuals), `fit_interval`, `calibrate`, `coverage`, `fit`, CLI. |
| `brain_twin_jepa/validate.py` | The promotion gate, with its CLI. |
| `brain_twin_jepa/requirements.txt` | `--extra-index-url https://download.pytorch.org/whl/cpu`, `torch==2.14.1` (resolves to `2.14.1+cpu`). |
| `brain_twin_jepa/tests/` | `conftest.py` (shared twin, lazy), `test_jepa_model.py`, `test_train.py`, `test_validate.py`. BE-07's `test_features.py` and `test_telemetry_io.py` come in with the merge. |

- Deleted: `session_adapter.py` and `test_session_adapter.py`. BE-07 replaced them.
- No HTTP routes (BE-11 adds them), and `api.py` is untouched.

## Design (unchanged parts in brief)
- **Session features.** Per session, built from BE-07's `features.session_features`:
  - 5 pillar scores
  - 5 coverages (with BE-07, agility coverage is 1.0)
  - gap since the previous session, `log1p(days)/log1p(28)`
  - time of day (sin and cos)
- **Network.**
  - Context encoder f_θ: an MLP per session.
  - Leaky integrator: a learned leak per latent unit (0.68–0.79), stepped per session, never per idle day (R11).
  - Target encoder: an EMA of f_θ, τ = 0.996 (OQ-7: 0.996 belongs to the EMA).
  - Predictor g_φ(s̄_t, n, h).
  - Linear pillar readout (the soft anchor).
- **Loss.** `0.1 · JEPA (latent MSE / target variance) + anchor + forecast`.
- **Interval.** Per pillar, variance `a + b·h` with `b ≥ 0.02 · mean variance`, so the range always widens. A judgement call. Then a split-conformal `z` at level 0.8.

## What the review round changed
1. **Marginal coverage stated.** `Calibration.scope` / payload `calibration.scope` reads: "marginal: the share of forecasts, pooled over held-out users, whose later score fell inside the interval; not a guarantee for any one user". It is asserted in tests.
2. **Data source label not hardcoded.**
   - `fit` sets `Calibration.source` from the data's origin. In-process runs get `synthetic: BE-08 generator in-process (U users x S sessions, data_seed D)`.
   - Supplied histories need a caller-supplied `source`; otherwise `fit` raises a `ValueError`. The CLI requires `--source` with `--data`.
   - `forecast` reads the label from `Calibration`. `validate.py` stores the real-data label with the refitted calibration.
3. **Calibrated range.**
   - `Calibration` records `n_min..n_max`, the context lengths the calibration users had, and `h_max`.
   - Outside that range the payload has `calibrated: false`, `calibration.calibrated: false`, the range and a note. It carries no `scope`, `coverage`, `coverage_at_h` or `held_out_users`. This is tested.
   - h outside 1..6 is still a `ValueError`.
4. **`validated` flag.**
   - Every `ok` payload has `validated` (from `meta.validation.validated is True`) and `calibrated`.
   - `fit` writes `validation: {validated: false}`. Only `validate.promote` writes `true`.
5. **Promotion gate (`python -m brain_twin_jepa.validate --data DIR --source LABEL [--checkpoint] [--out] [--seed]`).**
   - It reads real telemetry with BE-07's `read_sessions` and splits users 50/50, per user.
   - On the calibration half it refits the interval with `calibrate` → `fit_interval`.
   - Checks on the held-out half:
     - at least 100 held-out users with 9+ sessions
     - coverage within ±0.05 of nominal per pillar
     - a paired per-user gain: the mean-of-history MAE minus the twin's MAE over the same cells, 2000 user-resampling bootstraps. The 95% CI must lie above 0 and the mean gain must be ≥ 1.0 point.
   - Only if all checks pass does it save the refitted calibration plus `validation: {validated: true, ...evidence}`. Otherwise it prints each failed check, writes nothing and exits 1.
   - Tests:
     - it refuses on synthetic data for the margin
     - each check alone fails the gate
     - `promote` writes `validated` and the new source
     - the CLI refusal leaves the checkpoint byte-identical
6. **Swap to BE-07.** Merged `d9655cb`. Sessions now come from `telemetry_io.dedupe` / `group_sessions` (in-process) and `read_sessions` (`--data`), and features from `features.session_features`. The adapter and its tests are deleted. Retrained and recalibrated; numbers below.
7. **Ragged histories.**
   - `to_tensors` pads to the longest history: zeros in `x`, NaN in `y`, plus `lengths`.
   - Losses mask the padding (tested: garbage in the padding changes no loss).
   - `forecasts` uses only (n, h) where the target session exists.
   - Short users don't abort `fit`: it raises only when no user has more than 3 sessions.
   - Tested with users of 1, 2, 3 and 10–14 sessions.
8. **Coverage test tolerance.** ±0.10 per pillar pooled over h, ±0.12 per cell.
9. **Torch skip.**
   - The conftest fixture imports `train` lazily behind `pytest.importorskip("torch")`.
   - The three torch test modules call `pytest.importorskip("torch")`.
   - Checked with torch blocked: 41 passed (BE-07), 3 modules skipped, no collection error.
10. **Determinism.**
    - Training runs under `torch.use_deterministic_algorithms(True)` and `set_num_threads(1)`, both restored afterwards.
    - `torch.random.fork_rng()` wraps init and training, so the global RNG is untouched. This is tested.
    - One thread also made full training faster: 14.5 s, down from 49 s.
11. **Evidence seed.** The final evidence uses `data_seed` **2026**, untouched during development (seeds 0–3, 1, 5, 7, 11 and 99 were used in sweeps and tests). The gate dry run uses **2027**, also untouched.
12. **`pytest.raises(..., match=...)`** throughout.

## What review round 2 changed
1. **The calibrated range is a triangle.**
   - A calibration row at (n, h) exists only when a user had n + h sessions. `Calibration.n_max_by_h[h-1]` records the longest calibrated context at each h, and `covers(n, h)` checks against it.
   - The full run's range is `[13, 12, 11, 10, 9, 8]` for h = 1..6.
   - Old behaviour: `forecast(13 sessions, h=6)` claimed coverage. Now it says `calibrated: false`, and the payload's `range` shows `max_sessions_by_h`.
   - Tests: (n_max, h_max) → `calibrated: false` on a fixture and on the trained twin; inside and outside cases of the triangle.
2. **Bare `pytest.raises` replaced.** `FileNotFoundError` now uses `match="missing.pt"`; the `SystemExit` test asserts code 2.
3. **Padding masks.** In `SATJEPA.losses`, the anchor and forecast masks are ANDed with `real` from `lengths`. The padding test now puts non-NaN garbage in both x and y padding and checks every loss is unchanged.
4. **Independent RNG streams in the gate.** The split and the bootstrap draw from two independent generators spawned from one `SeedSequence(seed)`.
5. **Unreadable users are skipped and counted.** `directory_histories` skips users whose file is over the read limit (`EventsTooLarge`) or whose name fails `ID_PATTERN`. It returns `(histories, skipped)`; both CLIs print the count, and the gate records it as `skipped_users` in its evidence. Tested in `test_directory_skips_and_counts_unreadable_users` and the gate CLI test.
6. **`validated: false` on every payload.** `not_enough_data` now carries `validated: false` too, and the pinned-keys tests are updated.

The checkpoint was retrained after round 2, because `Calibration` gained `n_max_by_h`. The training curve, coverage table and MAE are identical to round 1: equal-length synthetic histories have no padding, so the new masks change nothing there.

## Full evidence run (untouched seed 2026)
```
python -m data.synthetic.generate --users 1000 --sessions 14 --seed 2026 --out data/raw/synthetic-2026
python -m brain_twin_jepa.train --data data/raw/synthetic-2026 --source "synthetic: BE-08 generator CLI, 1000 users x 14 sessions, seed 2026 (untouched during development)"
```
- Split: 600 train / 200 calibration / 200 test users.
- Training: 1500 steps, batch 64, AdamW lr 3e-3, seed 0, 14.5 s training on CPU.
- Checkpoint: `models/checkpoints/sat_jepa.pt` (gitignored), `validated: false`.

### Training curve (mean over each 100 steps)
| step | total | jepa (normalised) | anchor | forecast |
|---:|---:|---:|---:|---:|
| 100 | 0.67331 | 3.34316 | 0.09131 | 0.24768 |
| 200 | 0.14206 | 0.53834 | 0.01636 | 0.07186 |
| 300 | 0.10625 | 0.43118 | 0.00610 | 0.05703 |
| 400 | 0.09637 | 0.39284 | 0.00186 | 0.05523 |
| 500 | 0.09096 | 0.36232 | 0.00135 | 0.05337 |
| 600 | 0.08796 | 0.34052 | 0.00106 | 0.05284 |
| 700 | 0.08541 | 0.32490 | 0.00102 | 0.05190 |
| 800 | 0.08330 | 0.31079 | 0.00081 | 0.05141 |
| 900 | 0.08195 | 0.30273 | 0.00082 | 0.05085 |
| 1000 | 0.08190 | 0.30119 | 0.00068 | 0.05110 |
| 1100 | 0.08043 | 0.29888 | 0.00054 | 0.05000 |
| 1200 | 0.07983 | 0.29545 | 0.00057 | 0.04971 |
| 1300 | 0.08055 | 0.30277 | 0.00054 | 0.04973 |
| 1400 | 0.08048 | 0.30470 | 0.00055 | 0.04946 |
| 1500 | 0.08087 | 0.30575 | 0.00050 | 0.04980 |

The JEPA term bottoms out around step 1200 and creeps up as the EMA target moves. The forecast term keeps falling slowly.

### Calibration table: held-out coverage at nominal 80%
- 200 test users, 10,200 forecasts, h = 1–6; contexts from 3 sessions up to 13 (h=1) … 8 (h=6), the triangle `n_max_by_h = [13, 12, 11, 10, 9, 8]`.
- Coverage is marginal, pooled over users.

| pillar | h=1 | h=2 | h=3 | h=4 | h=5 | h=6 | all | half-width h=1..6 (points) |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| focus | 0.780 | 0.792 | 0.790 | 0.795 | 0.796 | 0.792 | 0.790 | 19.9..21.0 |
| agility | 0.786 | 0.793 | 0.797 | 0.794 | 0.806 | 0.811 | 0.796 | 23.3..24.5 |
| impulse | 0.806 | 0.810 | 0.819 | 0.824 | 0.819 | 0.824 | 0.816 | 17.7..18.6 |
| memory | 0.799 | 0.801 | 0.811 | 0.816 | 0.816 | 0.827 | 0.810 | 36.3..38.2 |
| visual | 0.807 | 0.816 | 0.820 | 0.809 | 0.823 | 0.824 | 0.816 | 11.2..11.8 |

### Forecast error vs the mean of history (MAE, points, the same 200 test users)
| h | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|
| twin | 15.89 | 15.88 | 15.86 | 15.88 | 15.97 | 15.93 |
| mean of history | 16.44 | 16.52 | 16.56 | 16.65 | 16.85 | 16.77 |

### Promotion-gate dry run (untouched seed 2027, synthetic, not real users)
```
python -m data.synthetic.generate --users 300 --sessions 12 --seed 2027 --out data/raw/synthetic-2027
python -m brain_twin_jepa.validate --data data/raw/synthetic-2027 --source "synthetic: BE-08 CLI seed 2027 (gate dry run, not real users)"
```
```
read 300 users from data\raw\synthetic-2027; skipped 0 {'too_large': 0, 'bad_id': 0}
held-out users 150 (eligible 150), coverage {'focus': 0.8222, 'agility': 0.8005, 'impulse': 0.8036, 'memory': 0.8026, 'visual': 0.7968}
gain over the mean of history: 0.4 points, 95% CI [-0.0, 0.865]
NOT PROMOTED: the twin stays in shadow mode (validated: false). Failed checks:
- the 95% interval of the gain over the mean of history [-0.0, 0.865] does not exclude 0
- margin 0.4 points over the mean of history is below 1.0
exit=1
```
The user-count and coverage checks passed; only the two gain checks failed. The CI's lower bound prints as −0.0: it is a small negative rounded to 3 decimals, so it does not exclude 0. These numbers come after round 2. Round 1 printed a gain of 0.41, CI [−0.05, 0.90]; the difference is the new split and bootstrap streams.

## CI-test config (stated plainly)
- Config: the shared fixture, `TrainConfig(users=400, sessions=12, data_seed=0, seed=0, steps=400)`, 80 test users, 3120 forecasts. It trains and calibrates in about 11 s, under an asserted budget of 120 s.
- **Forecasts:** the twin is worse than the mean of history at every h:
  - twin MAE: 18.25, 18.35, 18.01, 17.95, 18.06, 18.53
  - mean of history: 16.84, 16.95, 16.56, 16.44, 16.66, 17.07
  - That is 1.4–1.5 points worse. 400 steps are too few for the model to learn more than a noisy average.
- **Coverage:** per cell 0.744–0.833. Per pillar overall: focus 0.769, agility 0.761, impulse 0.793, memory 0.811, visual 0.780.
- **Gate:** run on 240 fresh synthetic users (seed 7), it refuses this twin. The gain is −1.18 points, 95% CI [−1.66, −0.68], after round 2's independent split and bootstrap streams (round 1 gave −1.27). This is `test_refuses_when_the_margin_over_the_mean_of_history_is_too_small`.
- **Why CI uses this config:** the CI tests check mechanics and calibration, not forecast quality. Forecast quality is exactly what the promotion gate exists to judge.

## Tests
- `pytest -q` from the repo root: **943 passed, 1 xfailed, 0 warnings**.
- `brain_twin_jepa/tests`: 85 passed in about 20 s (including BE-07's 41).

## Acceptance-criteria mapping
| Criterion | Where | Test |
|---|---|---|
| f_θ, target EMA τ = 0.996, g_φ, leaky integrator | `SATJEPA`, `LeakyIntegrator` | `test_network_shapes`, `test_leaky_integrator_formula_and_causality` |
| inputs: 5 pillars + coverage + gap + time of day (BE-07) | `session_record`, `session_matrix` | `test_session_record_uses_be07_features`, `test_session_matrix_shapes_and_values` |
| shapes | | `test_network_shapes` |
| EMA exact | `ema_update` | `test_ema_update_is_exact` (bitwise), `test_target_encoder_gets_no_gradient` |
| loss decreases | `train_model` | `test_loss_decreases_on_synthetic_data` |
| seed determinism | `train_model`, `deterministic()` | `test_same_seed_same_weights_other_seed_other_weights` (also: RNG, threads and the determinism switch are restored) |
| trains on BE-08 data; checkpoint in `models/checkpoints/` | `fit`, `main`, `directory_histories` | `test_cli_trains_and_writes_a_loadable_checkpoint`, `test_generator_files_read_back_as_the_same_sessions` |
| interval widens with h | `Calibration.half_width` | `test_interval_widens_with_h` |
| fewer than 3 sessions: `not_enough_data` | `_not_enough_data` | `test_fewer_than_three_sessions_is_not_enough_data`, `test_module_forecast_needs_no_checkpoint_for_not_enough_data` |
| held-out coverage near nominal, in CI under a budget | `coverage`, `measure` | `test_held_out_coverage_is_near_nominal` (±0.10 pooled, ±0.12 per cell, 120 s) |
| review 1: marginal scope | `COVERAGE_SCOPE` | `test_payload_is_shadow_mode_with_source_and_marginal_scope`, `test_forecast_carries_its_calibration_evidence` |
| review 2: source from the origin | `fit`, `synthetic_source`, `--source` | `test_fit_needs_a_source_for_supplied_histories_and_users_long_enough`, `test_cli_with_data_requires_a_source`, `test_fit_keeps_every_session...` |
| review 3 / round 2.1: calibrated range (a triangle) | `Calibration.covers`, `n_max_by_h` | `test_inside_the_calibrated_triangle_claims_coverage`, `test_outside_the_calibrated_range_makes_no_coverage_claim` (incl. (n_max, h_max)), `test_calibration_is_a_triangle_not_a_rectangle` |
| review 4: `validated` | `BrainTwin.validated` | `test_validated_only_from_the_promotion_metadata` |
| review 5: promotion gate | `validate.py` | `test_validate.py` (4 tests) |
| review 6: BE-07 swap | merge `b6b0546`, `session_record` | adapter tests removed; BE-07's tests pass |
| review 7: ragged histories | `to_tensors`, masked `losses`, `forecasts` | `test_ragged_histories_are_padded_not_cut`, `test_fit_keeps_every_session_of_ragged_users_and_short_users_do_not_abort`, `test_losses_ignore_padding_after_a_short_history` |
| torch CPU pin | `requirements.txt` | `pip install -r requirements.txt` resolved `2.14.1+cpu` |
| no HTTP routes | `api.py` untouched | |

## Curl evidence
Not applicable: BE-10 adds no routes (BE-11 does).

## Limitations
- **Synthetic only.** Every coverage and error number here comes from BE-08 synthetic users. The real-user verdict belongs to `validate.py`.
- **Marginal coverage.** It is pooled over users; a steady or erratic user will see more or less.
- **Small gain.** The full run's gain over the naive forecast (about 0.6–0.9 points, 0.41 on a fresh seed) does not reach the gate's 1-point margin, even on synthetic data. A promoted twin needs a better model or a different target, not a looser gate.
- **Scope of the claim.** Forecasts are about scores on these exercises only (research area 3).
- **Time of day is UTC.**

## Requests
1. **BE-11 (R17 shadow mode).**
   - Compute the forecast and return it with `validated: false` and `calibration.source`. The UI shows measured values only.
   - Map errors and statuses:
     - `not_enough_data` → pass through
     - missing checkpoint (`FileNotFoundError`) → 501
     - checkpoint saved before `bc6a929`: `BrainTwin.load` raises `ValueError("checkpoint predates the calibrated-triangle format; ...")` → 501. Catch it around `load`, separately from the `forecast` call, whose `ValueError` (bad h) is a 422.
     - h outside 1..6 (`ValueError`) → 422
     - `calibrated: false` → show no range claim
   - The Docker image needs a trained checkpoint, either trained at deploy (about 15 s training + data) or mounted.
2. **Ops / Member 3.** Run `python -m brain_twin_jepa.validate --data <real export> --source "<label>"` once at least 200 real users have 9+ sessions (for 100 eligible held-out users). Promote only on exit 0.
3. **DOC-1.**
   - The README deliverable path `src/brain_twin/jepa_model.py` should read `brain_twin_jepa/jepa_model.py`.
   - SEQUENCE_DIAGRAMS' "leaky temporal filter (Tau = 0.996)" is wrong: 0.996 is the EMA, and the leak is learned.
   - Document R17 shadow mode.
4. **BE-09.** For latents, use `SATJEPA.context(x)[:, -1]` (the 16-d smoothed state).
5. **TD-01 / CI.** The Python job downloads the torch CPU wheel (about 200 MB); the pip cache keyed on `**/requirements.txt` holds it after the first run.
