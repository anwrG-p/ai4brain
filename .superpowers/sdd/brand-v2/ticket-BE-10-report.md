# Ticket BE-10 report: SAT-JEPA brain twin

## Branch and commits
- Branch: `worktree-agent-abcde342e9ec768d4`, based on `ae67522` (the BE-PORT tip).
- Commits:
  - `9373880` feat(brain_twin_jepa): BE-10 SAT-JEPA brain twin with a calibrated forecast interval
  - this report

## Files
| File | What |
|---|---|
| `brain_twin_jepa/jepa_model.py` | Builds the per-session features (`session_matrix`). Holds `SATJEPA`, `LeakyIntegrator`, `Calibration`, `BrainTwin` (forecast, save, load) and the module-level `forecast(history, h, twin=None)`. |
| `brain_twin_jepa/train.py` | Data (BE-08 in-process or `--data DIR`), training, interval fit, held-out coverage, naive-baseline MAE. CLI: `python -m brain_twin_jepa.train`. |
| `brain_twin_jepa/session_adapter.py` | **ponytail:** a local stand-in for BE-07 (see Requests). |
| `brain_twin_jepa/requirements.txt` | `--extra-index-url https://download.pytorch.org/whl/cpu` with `torch==2.14.1`. It resolved to `2.14.1+cpu` here. |
| `brain_twin_jepa/tests/` | `conftest.py` (one shared small twin), `test_jepa_model.py`, `test_train.py`, `test_session_adapter.py`. 23 tests. |

There are no HTTP routes (BE-11 adds them), and `api.py` is untouched.

## Design
- **Steps are sessions.** Each session is a 13-dimensional `x_t`:
  - the 5 pillar scores (/100, 0 when missing)
  - the 5 pillar coverages, which also flag the missing scores
  - the gap since the previous session, `log1p(days)/log1p(28)`
  - time of day, sin and cos of the start hour (UTC, as the generator writes it)
- **Context encoder f_θ.** An MLP over one session: `e_t = f_θ(x_t)` (latent 16, hidden 64).
- **Leaky integrator.** `s̄_t = a ⊙ s̄_{t-1} + (1 − a) ⊙ e_t`, with a learned leak `a` per latent unit; it ends at a ≈ 0.67–0.77.
  - It steps per session, never per idle day, because there is no ground truth for idle decay (R11).
  - Causality is tested.
- **Target encoder f_θ̄.** An EMA of f_θ with **τ = 0.996**, updated after every optimiser step, with no gradients.
- **OQ-7 settled in code.** τ = 0.996 belongs to the EMA (the README). The integrator's leak is learned, not 0.996.
- **Predictor g_φ(s̄_t, n, h).** It predicts `f_θ̄(x_{t+h})`.
  - `n` is the number of sessions seen, so the model can learn the practice curve that plateaus around session 3.
  - `h` is counted in sessions (1–6), not in days.
- **Readout (the "soft anchor").** A linear map from the latent to the 5 pillars.
  - It is trained on `f_θ(x_t)` (anchor loss) and on `g_φ`'s prediction against the scores h sessions later (forecast loss).
  - It keeps the latent tied to measured scores, so the latent cannot collapse to a constant.
- **Loss.** `0.1 · JEPA + anchor + forecast`.
  - The JEPA term is the latent MSE divided by the target latent's variance. That makes it scale-free, so it cannot drop by shrinking the latent.
  - At weight 1, the JEPA term crowded out the forecast (MAE 16.6 against 15.4 for the mean of history), hence the 0.1.
- **Interval** (`train.fit_interval`), per pillar:
  1. Variance model `a + b·h`, fitted by weighted least squares on the calibration users' squared residuals.
  2. `b ≥ 0.02 · mean variance`, so the interval always widens with h. This floor is a judgement call (no evidence that a forecast 6 sessions out is as certain as one 1 session out).
  3. Then `z` = the split-conformal quantile of `|r| / sqrt(a + b·h)` at level 0.8.
- **Data split.** Users are split 60/20/20 into train, calibration and test. Users, not forecasts, are the unit, because residuals within one user are correlated.
- **`forecast(history, h)` returns:**
  - `{"status": "not_enough_data", "sessions": n, "min_sessions": 3}` when n < 3 (R11, R15).
  - `ValueError` for h outside 1..6, the calibrated range.
  - Otherwise `{"status": "ok", "h", "sessions", "level": 0.8, "pillars": {p: {mean, low, high, half_width} | null}, "calibration": {...}}`:
    - **`pillars`:** `low` and `high` are clipped to 0–100. `half_width` is the unclipped ±, which always widens with h. A pillar never scored in the history is `null` (R15).
    - **`calibration`:** `data` says "synthetic users (BE-08 generator), not real users". It also carries `held_out_users`, `coverage_at_h` per pillar and `coverage` per pillar.
- **Checkpoint.** Saved to `models/checkpoints/sat_jepa.pt` (gitignored, verified with `git check-ignore`). It holds config, state_dict, calibration and meta, and is loaded with `torch.load(weights_only=True)`.

## Full training run (the evidence)
Commands, from the repo root:
```
python -m data.synthetic.generate --users 1000 --sessions 14 --seed 0 --out data/raw/synthetic
python -m brain_twin_jepa.train --data data/raw/synthetic
```
- Run conditions: 1000 users × 14 sessions (1,708,000 events), 600 train / 200 calibration / 200 test, 1500 steps, batch 64, AdamW lr 3e-3, seed 0, about 49 s on a laptop CPU.
- The in-process path (`python -m brain_twin_jepa.train` with no `--data`) gave **the identical curve and table**. That is end-to-end evidence of determinism across both data paths.

### Training curve (mean over each 100 steps)
| step | total | jepa (normalised) | anchor | forecast |
|---:|---:|---:|---:|---:|
| 100 | 0.66117 | 3.28794 | 0.08674 | 0.24564 |
| 200 | 0.13657 | 0.51201 | 0.01497 | 0.07039 |
| 300 | 0.10450 | 0.42576 | 0.00562 | 0.05631 |
| 400 | 0.09171 | 0.37516 | 0.00154 | 0.05266 |
| 500 | 0.08590 | 0.33684 | 0.00088 | 0.05134 |
| 600 | 0.08234 | 0.31403 | 0.00081 | 0.05012 |
| 700 | 0.07970 | 0.28699 | 0.00080 | 0.05019 |
| 800 | 0.07723 | 0.27670 | 0.00093 | 0.04863 |
| 900 | 0.07546 | 0.26585 | 0.00079 | 0.04809 |
| 1000 | 0.07469 | 0.26270 | 0.00060 | 0.04781 |
| 1100 | 0.07567 | 0.26546 | 0.00070 | 0.04842 |
| 1200 | 0.07417 | 0.26282 | 0.00061 | 0.04727 |
| 1300 | 0.07423 | 0.26414 | 0.00049 | 0.04733 |
| 1400 | 0.07568 | 0.27432 | 0.00049 | 0.04776 |
| 1500 | 0.07530 | 0.27825 | 0.00034 | 0.04714 |

- The JEPA term bottoms out near step 1000 and drifts up slightly (0.263 → 0.278). That is the usual moving-target effect: the EMA target keeps changing.
- The forecast term keeps falling. An MSE of 0.047 on a 0–1 scale is an RMSE of about 22 points. That is mostly session-to-session noise: within-user SD is 15–25 points per session.

### Calibration table: held-out coverage at nominal 80%
200 test users, 10,200 forecasts, contexts of at least 3 sessions.

| pillar | h=1 | h=2 | h=3 | h=4 | h=5 | h=6 | all | half-width h=1..6 (points) |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| focus | 0.786 | 0.789 | 0.790 | 0.804 | 0.802 | 0.801 | 0.794 | 19.8..20.8 |
| agility | 0.779 | 0.781 | 0.786 | 0.796 | 0.786 | 0.802 | 0.787 | 18.5..19.5 |
| impulse | 0.784 | 0.783 | 0.793 | 0.796 | 0.795 | 0.801 | 0.791 | 17.3..18.1 |
| memory | 0.779 | 0.780 | 0.781 | 0.782 | 0.781 | 0.795 | 0.782 | 34.8..36.5 |
| visual | 0.758 | 0.760 | 0.768 | 0.776 | 0.771 | 0.785 | 0.768 | 11.7..12.3 |

- Every cell is within 0.758–0.804, so all are within ±0.10 of nominal. Most are within ±0.03.
- With an earlier 70/15/15 split (90 calibration users), visual came out at 0.743 overall. That is why the split moved to 60/20/20 with 1000 users.

### Forecast error vs a naive baseline (MAE, points, test users)
| h | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|
| twin | 15.36 | 15.42 | 15.34 | 15.44 | 15.58 | 15.49 |
| mean of history | 15.47 | 15.62 | 15.55 | 15.71 | 15.91 | 15.87 |

The twin is better at every h, but only by 0.1–0.4 points. On this data the session noise dominates, and the best possible forecast is close to a shrunk mean of the history.

### Small-config robustness
This is the CI test's config: default architecture, 400 users × 12 sessions, 400 steps, so 80 test users. It was run over 4 seeds:

| seed | seconds | min cell | max cell |
|---:|---:|---:|---:|
| 0 | 12.1 | 0.722 | 0.828 |
| 1 | 11.2 | 0.751 | 0.825 |
| 2 | 10.3 | 0.768 | 0.841 |
| 3 | 9.6 | 0.735 | 0.879 |

- The test uses seed 0, the default, not the best seed.
- Its tightest cell has a 2.2-point margin. The result is deterministic on a given platform. A float difference on another OS would move a handful of the roughly 300 forecasts per cell.

## Tests
- `pytest -q` from the repo root: **881 passed, 1 xfailed, 0 warnings, 44 s**. The base had 858 passed.
- `brain_twin_jepa/tests` alone: 23 passed in about 12 s. The shared twin trains and calibrates in about 10 s, under an asserted 120 s budget.
- No slow marker was needed. It would also have meant registering a marker in the root `pytest.ini`, which this ticket does not own.

## Acceptance-criteria mapping
| Criterion | Where | Test |
|---|---|---|
| context encoder f_θ, target EMA τ = 0.996, predictor g_φ, leaky integrator | `jepa_model.SATJEPA`, `LeakyIntegrator` | `test_network_shapes`, `test_leaky_integrator_formula_and_causality` |
| inputs: 5 pillars + coverage + session gap + time of day | `jepa_model.session_matrix` | `test_session_matrix_shapes_and_values` |
| shapes | | `test_network_shapes`, `test_session_matrix_shapes_and_values` |
| EMA update exact | `SATJEPA.ema_update` | `test_ema_update_is_exact` (bitwise `torch.equal`), `test_target_encoder_gets_no_gradient` |
| loss decreases on synthetic data | `train.train_model` | `test_loss_decreases_on_synthetic_data` (total, JEPA, anchor, forecast; first vs last window) |
| seed determinism | `train.train_model` | `test_same_seed_same_weights_other_seed_other_weights`, plus the identical full runs on both data paths |
| trains on BE-08 data; checkpoint in `models/checkpoints/` (gitignored) | `train.fit`, `main`, `directory_histories` | `test_cli_trains_and_writes_a_loadable_checkpoint`, `test_generator_files_read_back_as_the_same_sessions` |
| `forecast(history, h)`: per-pillar mean and an interval that widens with h | `BrainTwin.forecast`, `jepa_model.forecast` | `test_interval_widens_with_h` |
| calibration evidence returned and in this report | `forecast()["calibration"]`, tables above | `test_forecast_carries_its_calibration_evidence` |
| fewer than 3 sessions: `not_enough_data` | `_not_enough_data` | `test_fewer_than_three_sessions_is_not_enough_data`, `test_module_forecast_needs_no_checkpoint_for_not_enough_data` |
| held-out coverage within ±10% of nominal, in CI under a time budget | `train.coverage` | `test_held_out_coverage_is_within_ten_points_of_nominal` (every pillar × h cell plus overall, budget 120 s) |
| torch pinned (CPU wheel) | `brain_twin_jepa/requirements.txt` | the root `pip install -r requirements.txt` resolved `2.14.1+cpu` |
| no HTTP routes | `api.py` untouched | |

## Curl evidence
Not applicable: BE-10 adds no routes (BE-11 does).

## Limitations (honest)
- **Synthetic only.** The coverage is measured on BE-08's synthetic users, whose noise model the interval learned. Real users may be noisier or heavy-tailed differently. The forecast says this in `calibration.data`. Recalibrate (`fit_interval` + `coverage`) on real held-out users once they exist.
- **Marginal coverage, not per user.** About 80% of forecasts across users land in the interval. A very steady or very erratic user will see more or fewer.
- **Small bias.** Mean residuals on test users are −2.4 to +1.2 points depending on the pillar. The forecast mean also drifts up by about 1 point over h = 1..6 where the synthetic truth is flat after session 3.
- **Scope of the claim.** A forecast is about scores on these exercises (research area 3). It says nothing about cognition in general.
- **Gaps as features only.** The gap enters only as an input feature; there is no decay with idle days (R11). If BE-08 is ever run with `--forgetting-per-day > 0`, the model would learn whatever that parameter encodes, which is still not ground truth.
- **Time of day is UTC.** The local hour needs a tz from the client.

## Requests
1. **BE-07: swap the adapter.** `brain_twin_jepa/session_adapter.py` is the `# ponytail:` local adapter.
   - Replace `read_jsonl_dir` with BE-07's `read_events`, which dedupes.
   - Replace `_task_scores` / `_pillar_scores` with BE-07's golden-vector port.
   - The adapter leaves out `DCCS_SwitchCost` and `ErrorRecovery`, so its agility is ANT_Conflict alone (coverage .4), and agility and coverage differ from the frontend's.
   - The twin needs only records with `started_at`, `pillars` and `coverage` (attributes or keys).
   - After the swap: delete `session_adapter.py` and point `train.py` and `test_session_adapter.py` at BE-07, then retrain and re-run the calibration table.
2. **BE-11.** Load once with `BrainTwin.load()` (or call `jepa_model.forecast(history, h)`).
   - Map `not_enough_data` to the profile's `predictions` as-is.
   - Map `FileNotFoundError` (no trained checkpoint) to 501.
   - Map `ValueError` (h out of 1..6) to 422.
   - Show `half_width` as the "likely" range (research area 2: numbers, not verbal hedges).
   - The Docker image needs a checkpoint. Either train one at build or deploy time (about 1 min CPU), or mount `models/checkpoints/`.
3. **DOC-1 / docs.**
   - The README lists `src/brain_twin/jepa_model.py` as the deliverable path. The code lives at `brain_twin_jepa/jepa_model.py`.
   - Record OQ-7's resolution: τ = 0.996 is the EMA; the integrator's leak is learned. SEQUENCE_DIAGRAMS' "leaky temporal filter (Tau = 0.996)" is therefore wrong.
4. **BE-09.** For latents, use `SATJEPA.context(x)[:, -1]` (16-d smoothed state) from the BE-10 checkpoint.
5. **TD-01 / CI.** The Python job now downloads the torch CPU wheel (about 200 MB). The pip cache in `ui-ci.yml` keys on `**/requirements.txt`, so it caches the wheel after the first run.
