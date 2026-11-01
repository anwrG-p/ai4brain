# Ticket BE-11 report: state bus, profile service, clustering evaluate

## Branch and commits
- Branch `worktree-agent-a70375fb12eb5a691`, reset to `e36227e` (main tip with BE-04, BE-06, BE-07, BE-09 and BE-10 merged), as instructed. Not `ae67522`.
- One commit, "feat(brain_twin): BE-11 state bus, profile service, clustering evaluate". It holds the code, the tests and this report. The sha is in the reply.
- No AI attribution in the commit (user rule).

## What was built

| File | What |
|---|---|
| `brain_twin_jepa/state_bus.py` (new) | See "State bus" below. |
| `brain_twin_jepa/profile.py` (new) | See "Profile service" below. |
| `brain_twin_jepa/api.py` | `GET /v1/dashboard/profile` and `POST /v1/clustering/evaluate`, plus a startup hook that warms both models off the event loop. |
| `brain_twin_jepa/bootstrap.py` (new) | `python -m brain_twin_jepa.bootstrap [--force] [--skip-twin]`. See "Fit and train" below. |
| `dynamic_cache/api.py` | `make_dispatcher` passes `pillars=state_bus.task_pillars`, `archetype=state_bus.task_archetype` and `on_step=state_bus.record_step` (BE-04's request). |
| `dynamic_cache/cache_dispatcher.py` | An optional `on_step(key, schema, old_level, new_level)` hook. It fires when the 85% rule moves the served level of an already seeded staircase, and is the source of the "why this" staircase reasons. 8 lines, default `None`. |
| `ai_coach/xai_explainer.py`, `agent.py`, `schemas.py`, `api.py` | The coach reads the bus server side (`state_bus.coach_context`) and turns Δc into words. See "Member 2" below. |
| `backend/app/privacy/telemetry_store.py`, `retention.py` | `state_bus_dir()` (env `STATE_BUS_DIR`). The retention CLI drops bus files idle past the period (`state_bus_removed`). |
| `backend/app/api/routes/v1_interop.py`, `backend/tests/test_v1_interop.py` | **Deleted.** Both stand-ins are replaced, so `v1_interop` had no routes left. `main.py` no longer imports or mounts it. That is a two-line removal; nothing was added to `main.py`. |
| `backend/tests/test_app.py` | `INTENTIONAL_OVERRIDES` gains the profile and evaluate entries. The interop-shadowing tests became `test_the_stand_ins_are_gone_and_each_route_is_declared_once`. |
| `backend/tests/test_honest_endpoints.py` | The 501 test is gone. "Profile never returns numbers today" became `test_profile_never_invents_numbers`: events no exercise scorer reads give `not_enough_data`. |
| `conftest.py` (root) | Every test gets a temporary `STATE_BUS_DIR`, and `CLUSTER_MODEL_PATH` / `TWIN_CHECKPOINT` pointing at missing files. No test depends on what the bootstrap left in `models/`. |
| `backend/Dockerfile`, `docker-compose.yml`, `backend/.env.example`, `scripts/run_dev.ps1`, `scripts/README.md` | Bootstrap at build time and in dev, a `state_bus` volume, and the new env vars. |
| `docs/ui/contracts.md` | The profile and evaluate contracts for F-C (the one doc I was allowed to edit). The stale statuses of the BE-04 and BE-06 rows and of the delete and export rows are fixed. |

### State bus (`state_bus.py`)
- **Pub/sub.** `bus.subscribe(topic, fn)` and `bus.publish`, in process and synchronous. A failing subscriber is logged by exception class only (no user id) and never stops the others.
- **Topic `tasks`** carries `ClusterState {user_id, active_cluster_id, centroid_vector, confidence}`, plus `model_id`, `archetype` and `pool`. This is README Member 3 → Member 5.
- **Topic `coach`** carries `CoachSignal {user_id, transition_occurred, delta_vector, uncertainty}`, plus `model_id`. This is README Member 3 → Member 2.
- **Retained events.** The last event of each topic is also kept per user, so a consumer that was not subscribed can read it. This is what the dispatcher and the coach read.
- **When it runs (lazily).**
  - A profile or evaluate request does a full refresh.
  - `tasks/next` and coach chat call `refresh_light`. It stats the JSONL and reads only the bytes appended since the last refresh. It refreshes in full only when one of these happened:
    - a new session id appears;
    - the open session has been idle for 30 minutes;
    - the served model changed;
    - the file shrank (retention or delete).
  - During play that is one full read per session, not one per request (tested with a read counter).
  - I picked "lazy on request" over "after ingest" because it needs no change to the ingest route and no background thread.
- **Frames.**
  - A session becomes one frame once it is **finished**: a later session exists, or nothing arrived for 30 minutes.
  - Its vector is the latest score of each pillar up to and including that session. If any pillar was never scored there is no vector and no step (R15, never imputed).
  - Each finished session is stepped exactly once. New frames are those after the newest frame already seen, so a bounded id list cannot cause re-steps (tested).
- **Gate state.**
  - One `HysteresisGate` per user, persisted with `asdict` together with BE-09's `model_id`.
  - The gate starts fresh for a new user or when the served model's id differs. In that case every finished session counts as seen and the latest one with a vector is adopted.
  - Retained events from the old model are dropped, so a model swap is never a "transition".
- **`transition_occurred`** is true only when the active cluster changes under one model. The first adoption is not a transition.
- **Δc** is `μ_target − μ_active` per pillar, in points, with BE-09's suggested target: the runner-up posterior. `uncertainty` is 1 − the active posterior.
- **Pools.**
  - A named archetype id maps to `archetype-<id>`, stable across refits.
  - An unnamed component maps to `cluster-<model_id>-<k>`.
  - No cluster maps to `neutral`.
- **Storage.**
  - One file per user, `{STATE_BUS_DIR}/{key}.json`, written as tmp + replace under a striped per-user lock.
  - It is registered with `register_user_store("state_bus", ...)`, so delete and export cover it.
  - The retention CLI drops idle files.
  - A delete holds the same lock as a refresh, so a refresh in flight cannot resurrect the file.
- **Hot-path safety.** `task_archetype`, `task_pillars`, `record_step` and `coach_context` never raise. On any failure the task is served from `neutral` and the chat goes on without context (tested with a broken bus).

### Profile service (`profile.py`)
- **Pillars.** Each session goes through BE-07's `read_sessions` and then `session_features`. For each pillar the profile gives `latest`, `uncertainty` (of the latest session), `average` (over the sessions that scored it) and `sessions`. A pillar never scored is `null`.
- **Uncertainty: I used the frontend's method, not the Kalman filter.** BE-07's port of `pillars.ts` gives a 95% half-width from the worst-case binomial SE per input, weighted and coverage-scaled, capped at 50. The Kalman filter in `app/tools/digital_brain_updater.py` cannot give an honest per-pillar sigma, for three reasons:
  - Its noise terms are fixed constants on a T-score scale (R = 2.25, i.e. a 1.5-point SD per session) with no data behind them. A 20-trial binomial input has a spread of about 11 points, so the filter's sigma would claim precision nobody measured.
  - Its transition matrix pulls every node toward a cross-node mean.
  - Its observation map is per cortical node, with the "not an estimate" rows.

  Fixing it would mean estimating Q and R from real users, which we do not have. With this choice the server and the UI show the same band. None of that filter's names or notes reach the payload (tested).
- **Archetype.**
  - It comes from the bus's retained `ClusterState`: `{name, confidence, model_id}`.
  - Otherwise it is `null`, with `archetype_reason` set to `no_model`, `invalid_model` (BE-09's validated load failed, or the model is not a 5-pillar one) or `not_enough_data`.
  - The profile never answers 501 for this. The version `UserWarning` is logged.
- **Forecast (R17).**
  - It is BE-10's `forecast(history, h)` on the cached checkpoint, plus `mode: "shadow"` and a top-level `source`. `validated` is always false.
  - Below 3 sessions, BE-10's `not_enough_data` passes through.
  - Otherwise it is `null`, with `forecast_reason` set to `no_model`, `outdated_model` (the pre-triangle `ValueError`, caught around `load` only), `not_installed` (no torch) or `invalid_model`.
  - A bad `h` is 422 at the route (Query 1..6). `FORECAST_H_MAX` is tested equal to `jepa_model.H_MAX`.
- **Collaboration score.**
  - It is BE-06's `score_stored_history` over the stored typed turns: `not_enough_data` until there is enough. If the chat store is busy it is `{"status": "unavailable"}`.
  - **The archetype weights are NOT applied.** `ARCHETYPE_WEIGHT_PROFILES` assumes cluster ids 0–8 ordered from beginner (0–2) to advanced (6–8). BE-09's ids are practice styles; id 6 is "Fresh starter", which would get the "Strategist" weights. Applying them would rank users by an order that does not exist. The scorer stays on equal weights, as BE-06 shipped it.
- **WhyThisTrail (`why_this`).**
  - The last 5 decisions, newest first, as `{kind, reason, at}`:
    - `harder` / `easier`: the staircase moved one exercise's served level (`on_step`).
    - `style`: the practice style was set or changed.
  - The copy is fixed templates with consumer exercise names, for example "Memory Gauntlet got a little harder because your recent rounds went well." and "Your practice style reads as Keen recaller."
  - There are no numbers. Each line is at most 12 words and lint-clean; this is tested for every exercise and every pillar.
- **`not_enough_data`** below 1 session that scored any skill. That includes an unknown user (200, not 404: the ids are anonymous).

### Member 5: the task service
- `tasks/next` serves from `state_bus.pool_key(user)` once a cluster exists. The registry's session record stores that archetype; this is tested, and seen live: `archetype-6`.
- New staircases are seeded by BE-12's projector from the latest pillar scores.
- **Honest limit:** the per-archetype pools hold the same content. `ARCHETYPE_OPTIONS` defines generator options for `neutral` only, and no evidence says how a practice style should change the generators, so I did not invent any. The difficulty personalisation is the projector seed plus the 85% staircase.
- I did not re-seed a staircase on a style change (BE-04 decision 1). The 85% rule already walks it from the user's own accuracy.

### Member 2: the coach
- `coach_chat` reads `state_bus.coach_context(key)` server side and passes `delta_vector`, `uncertainty` and `adaptation_reason` into `ChatRequest` as new internal fields. The client never sends them; the HTTP request model is unchanged.
- **Scripted path.** A "why" question gets up to 3 bubbles:
  1. the latest staircase reason, or else the latest style reason;
  2. the Δc line, for example "Your style sits lower on Visual Radar than the nearest one." When uncertainty is above 0.5 the line is "Your practice style is still taking shape." Below 5 points of difference there is no line;
  3. "Want to try the next one?".

  With no context it is unchanged (`OFFLINE_WHY_REPLY`).
- **LLM path.** A pillar-keyed Δc replaces the old "Cluster k / sigma 0.123" block with a words-only `PRACTICE PROFILE CONTEXT` block, with no digits (tested). BE-06's number check still withholds any number in the reply (tested with an LLM reply containing "20%").
- **The wording says "style", not "you".** Δc compares the two clusters' centres, not the user's own scores, so the old "we added challenge to X" reading would be false. Pillar-keyed Δc no longer goes through the old dimension-keyed rationale.

### Fit and train (`bootstrap.py`)
- **Clustering.** BE-09's `fit_gmm` (K = 9) on **BE-07** per-session pillar scores of 200 × 6 BE-08 users, the same features the profile computes. `clustering_engine/fit.py` still uses BE-09's interim adapter; the served model does not.
  - Run here: 3 s, `model_id 99c43f78be091f33`.
  - Names: Keen recaller, All-rounder, Fresh starter, Balanced builder, Methodical solver, and 4 × Mixed profile.
- **Twin.** BE-10's `TrainConfig()` defaults, saved with `validated: false`.
  - Run here: 153 s, so **about 2.7 min in total on this laptop, not ~1 min**. Most of the time is generating 1000 × 14 synthetic users. I kept BE-10's evidence configuration rather than shrink it.
- The bootstrap keeps models that load and refits missing or broken ones. A second run took 2 s.
- It runs at `docker build` (a `RUN` step, models baked into `/srv/models`) and in `scripts/run_dev.ps1`. It is documented in `scripts/README.md`.
- Without models, the profile answers with `null` sections and reasons, and evaluate answers 501. Nothing is faked.

## Tests (written first)
- **Before:** `pytest -q` from the repo root at the `e36227e` baseline gave 1370 passed, 1 xfailed.
- **After:** `pytest -q -W error` from the repo root gives **1423 passed, 1 xfailed, 0 warnings** (279 s). The xfail is BE-05's pre-existing strict xfail.
- **New files:**
  - `brain_twin_jepa/tests/test_state_bus.py`: 21 tests.
  - `brain_twin_jepa/tests/test_profile_api.py`: 39 tests, including parametrised cases.
  - `dynamic_cache/tests/test_dispatcher.py`: one new test, `test_each_change_of_the_served_level_is_reported_once`.
- **Two existing tests adjusted.** In each, the `state_bus` export record and file now appear for a user who has telemetry:
  - `test_coach_api.py::test_chat_history_is_exported_and_deleted`: `deleted_files` 2 → 3, and the new record is asserted.
  - `test_tasks_api.py::test_export_puts_the_registry_after_the_events`: it now finds the registry by tag, not by position.
- `test_retention.py`: the CLI report gains `state_bus_removed`.

| Required test | Test |
|---|---|
| Contract snapshot for the profile | `test_profile_contract_snapshot` (the full key and type tree, with the forecast); `test_unknown_user_is_not_enough_data` (the exact body) |
| A transition emits exactly once | `test_transition_emits_exactly_once` (LOW, LOW, HIGH ×4, each refresh repeated: exactly 1 transition, on the 5th frame); `test_boundary_frames_never_switch` |
| Unknown user → `not_enough_data` | `test_unknown_user_is_not_enough_data`, `test_evaluate_runs_the_users_profile_through_the_gate` |
| A model swap resets gates | `test_a_model_swap_resets_the_gate` (a pending challenger count of 2 → a fresh gate adopts the latest frame, count 0, switches 0, no transition); `test_a_new_users_gate_starts_from_the_latest_finished_session`; `test_gate_state_is_kept_per_user_with_the_model_id` |
| Δc reaches the coach context without numbers in replies | `test_delta_c_reaches_the_scripted_coach_without_numbers`, `test_delta_c_reaches_the_llm_context_as_words_only`, `test_every_coach_line_fits_lotis_shape[10]` |
| `tasks/next` uses the user's archetype pool once a cluster exists | `test_tasks_next_uses_the_users_archetype_pool_once_a_cluster_exists` (`neutral` with no model, the user's pool with one); `test_tasks_next_still_serves_when_the_bus_fails`; `test_task_view_uses_the_archetype_pool_key` |
| Delete and export cover the new state | `test_delete_and_export_cover_the_bus_state`, `test_delete_with_an_explicit_directory_keeps_to_it`, `test_export_and_delete_cover_the_new_state` (HTTP), `test_the_retention_cli_drops_idle_bus_files` |
| Shadow-mode forecast flags present | `test_the_forecast_is_in_shadow_mode`, `test_below_three_sessions_the_forecast_says_not_enough_data`, `test_no_checkpoint_is_forecast_null_with_a_reason`, `test_an_old_checkpoint_is_forecast_null_with_a_reason`, `test_a_bad_horizon_is_422[5]` |
| No brain-region names anywhere in the payload | `test_no_brain_region_names_anywhere` (profile, evaluate and the empty profile; also no "ponytail", "not an estimate" or "bottleneck") |

Also tested:
- the light refresh reads only the tail during a session, and reads in full on a new session, an idle session, a model change or a rewrite;
- the newest session is a frame only once it is finished;
- a partial session is no frame;
- old frames are never re-stepped;
- a failing subscriber does not stop the others;
- 413 and 503;
- ids are lowercased;
- pillars equal BE-07's features;
- evaluate takes only a user id (422 for a `latent_vector`).

## Acceptance criteria → evidence

| Ask | Where |
|---|---|
| In-process pub/sub; recompute on new telemetry (lazy) | `StateBus`, `refresh_light` / `refresh_full`; the light-path tests |
| Publish to tasks `{user_id, active_cluster_id, centroid_vector, confidence}`; dispatcher `pillars=`/`archetype=` | `ClusterState`, `make_dispatcher`; `test_events_carry_the_readme_contracts`, the tasks/next tests |
| Publish to coach `{user_id, transition_occurred, delta_vector, uncertainty}`; the coach gets the Δc explanation, no numbers | `CoachSignal`, `coach_context`, the explainer and agent changes; the Δc tests |
| Per-user HysteresisGate with `model_id`; reset on model change | `UserState.gate` / `model_id`; the swap test |
| Delete and export via `register_user_store` | `state_bus._delete` / `_export`; the privacy tests |
| `GET /v1/dashboard/profile`; stand-in deleted; `INTENTIONAL_OVERRIDES` | `brain_twin_jepa/api.py`; `test_app.py` |
| Pillars from BE-07, latest + average | `profile.pillar_profile`; `test_pillars_are_the_latest_and_the_average_of_the_be07_features` |
| Uncertainty: Kalman or the frontend method, documented | The frontend method; see "Profile service" and `profile.py`'s docstring |
| Archetype via `ClusterModel.load` → posteriors → gate → `name`; `null`, not 501 | The bus + `archetype_section`; `test_a_missing_or_invalid_clustering_model_is_archetype_null_not_an_error` |
| Forecast in shadow mode; `null` + reason; bad h → 422 | `forecast_section`; the forecast tests |
| Collaboration score; archetype weights only if honest | Equal weights kept; reason above |
| WhyThisTrail | `on_step` + style changes → `why_this`; `test_staircase_steps_join_the_trail_as_plain_reasons` |
| Contract in `docs/ui/contracts.md` | Done |
| `POST /v1/clustering/evaluate` for real | `clustering_evaluate`; 501 without a model |
| Fit and train at build or startup; graceful when missing | `bootstrap.py`, Dockerfile, `run_dev.ps1` |

## Curl evidence
uvicorn on :8771 with `TELEMETRY_DIR`, `STATE_BUS_DIR`, `COACH_DIR` and `TASK_REGISTRY_DIR` in a scratch folder, the models from `python -m brain_twin_jepa.bootstrap`, and no Gemini key.

```
$ GET /v1/dashboard/profile?user_id=nobody
{"user_id":"nobody","status":"not_enough_data","sessions":0,"min_sessions":1}
$ POST /v1/clustering/evaluate {"user_id":"nobody"}
{"user_id":"nobody","status":"not_enough_data"}
$ POST /v1/clustering/evaluate {"user_id":"demo","latent_vector":[0.1]}   -> 422
$ GET profile h=0 -> 422 | h=7 -> 422 | h=x -> 422
(posted 488 BE-08 events, 4 sessions, as user "Demo", in batches through POST /v1/telemetry/event)
$ GET /v1/dashboard/profile?user_id=DEMO&h=2
{"user_id":"demo","status":"ok","sessions":4,"min_sessions":1,
 "pillars":{"focus":{"latest":58.7,"uncertainty":24.4,"average":36.0,"sessions":4},
            "agility":{"latest":78.6,"uncertainty":13.0,"average":55.2,"sessions":4},
            "impulse":{"latest":92.2,"uncertainty":28.8,"average":67.0,"sessions":4},
            "memory":{"latest":0.0,"uncertainty":34.6,"average":25.0,"sessions":4},
            "visual":{"latest":80.2,"uncertainty":17.3,"average":59.7,"sessions":4}},
 "archetype":{"name":"Fresh starter","confidence":1.0,"model_id":"99c43f78be091f33"},"archetype_reason":null,
 "forecast":{"status":"ok","validated":false,"calibrated":true,"h":2,"sessions":4,"level":0.8,
             "pillars":{"focus":{"mean":45.6,"low":25.3,"high":66.0,"half_width":20.37}, ...},
             "calibration":{"source":"synthetic: BE-08 generator in-process (1000 users x 14 sessions, data_seed 0)",
                            "calibrated":true,"range":{...},"scope":"marginal: ...","held_out_users":200,
                            "coverage_at_h":{"focus":0.7905,...},"coverage":{"focus":0.7941,...}},
             "mode":"shadow","source":"synthetic: BE-08 generator in-process (1000 users x 14 sessions, data_seed 0)"},
 "forecast_reason":null,"collaboration":{"status":"not_enough_data"},
 "why_this":[{"kind":"style","reason":"Your practice style reads as Fresh starter.","at":"2026-11-01T11:04:47.940686+00:00"}]}
$ POST /v1/clustering/evaluate {"user_id":"demo"}
{"user_id":"demo","status":"ok","archetype":{"name":"Fresh starter","confidence":1.0,"model_id":"99c43f78be091f33"},"frames":3,"transition_occurred":false}
$ GET /v1/tasks/next?user_id=demo&session_id=play9&seq=0
{"task_id":"n_back-3154741950-92cf49d0db","dimension":"working_memory","schema_type":"n_back","params":{"n":2,...
   registry session record archetype: ['archetype-6']   bus retained pool: archetype-6
$ POST /v1/coach/chat {"user_id":"demo","transcript":[],"message":"why did it get harder?","kind":"typed"}
{"crisis":false,"message":{"id":"coach","text":"Your practice style reads as Fresh starter.\n\nYour style sits lower on Visual Radar than the nearest one.\n\nWant to try the next one?","choices":[]},"reply_source":"offline"}
$ GET /v1/user/export?user_id=demo
492 rows; records after the events: ['coach_turn', 'coach_turn', 'state_bus', 'task_registry']
state_bus record keys: coach, frames, gamma, gate, model_id, open_session, pillars, tasks, telemetry, trail
$ DELETE /v1/user/telemetry?user_id=demo
{"deleted_events":488,"deleted_chat_turns":2,"deleted_files":4}
   (STATE_BUS_DIR is empty afterwards)
$ GET /v1/user/export?user_id=demo -> 404
$ GET /v1/dashboard/profile?user_id=demo
{"user_id":"demo","status":"not_enough_data","sessions":0,"min_sessions":1}
```

- The server log had no warning or error lines. The only lines that name the user are uvicorn's access lines (query strings), as before.
- `POST /v1/clustering/evaluate` without a model answers `501 {"detail": "no clustering model is installed"}`. This is tested; it was not curled, because the demo server had the models.
- **Docker.** `docker compose config` resolves, with the new `state_bus` volume. **A full `docker build` was not run:** the Docker daemon is not running on this machine. The `RUN python -m brain_twin_jepa.bootstrap` step is therefore unverified in a container (it adds about 3 min to the build).

## Decisions to review
1. **Frames are finished sessions.** A session is finished once a later session starts, or after 30 minutes idle. The frame vector is the latest score per pillar. A brand-new user's gate adopts the latest finished frame instead of replaying their whole history.
2. **The light path.** It reads the appended tail and refreshes in full only on a new session. If a stat lands mid-append, the next refresh reads in full.
3. **The Δc floor is 5 points and "unsettled" means uncertainty above 0.5.** Both are judgement calls.
4. **Archetype weights are not applied** to the collaboration score (see above).
5. **The pools hold the same content per archetype** (see above).
6. **`PROFILE_MIN_SESSIONS = 1`** session with any skill scored. The forecast keeps BE-10's 3.

## Requests
1. **F-C (FE-06):**
   - Switch the dashboard to `GET /v1/dashboard/profile` per `docs/ui/contracts.md`.
   - Show `pillars` (ranges only in "View as table", R12).
   - **Do not draw `forecast` while `validated` is false** (R17).
   - Treat `archetype: null` and `forecast: null` as "not yet".
   - Handle 413, 503 and 422.
   - Drop the old `estimates` / `snapshots` keys and the `latent_vector` body for evaluate (it is now 422).
2. **DOC-1 / TD-04:** `docs/architecture/SEQUENCE_DIAGRAMS.md` line 3 still says clustering is 501 and the profile is `not_enough_data` until BE-11. That is now false; I did not edit it (outside my one allowed doc).
3. **BE-09 follow-up:** move `clustering_engine/fit.py` onto BE-07 features (as `bootstrap.fit_cluster_model` does) and refresh the golden constants, so the two fit paths become one.
4. **Ops:**
   - Run `python -m brain_twin_jepa.bootstrap` after deploy if not baked in.
   - The retention CLI's daily run now also prunes `STATE_BUS_DIR`.
   - Real-user promotion of the twin is unchanged: `python -m brain_twin_jepa.validate` (BE-10).
5. **TD-05:** verify the `docker build` with the bootstrap step once a daemon is available.
6. **Not built:** the gaps.md "snapshots (REQ-BE-03) + fatigue grid (REQ-BE-04)" lines were not in this ticket's build list. Per-session pillar history is available from the same summaries if F-D wants it.
