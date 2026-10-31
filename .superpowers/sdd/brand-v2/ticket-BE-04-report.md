# Ticket BE-04 (+ BE-12) report: `GET /v1/tasks/next`, dispatcher, Bloom/TTL, parameter projector

- **Branch:** `worktree-agent-a483458eabf534f4e`, reset to the BE-PORT tip `ae67522` before any work.
- **Commits** (no AI attribution):
  - `c580939 feat(dynamic_cache): GET /v1/tasks/next dispatcher, Bloom/TTL registry, parameter projector (BE-04, BE-12)`
  - `f0169f6 docs(sdd): BE-04 (+BE-12) report: ...` (first version of this report)
  - `0471e25 fix(dynamic_cache): BE-04 review: staircase windup, test isolation, bounded memory, worker lifecycle`
  - this report's update, in the commit after it.
- **Tests:** one `pytest -q` from the repo root: **1012 passed, 1 xfailed, 0 warnings**. It also passes with `-W error`.
  - The base had 858 passed + 1 xfailed.
  - 6 tests were removed (the `/tasks/next` 501 stand-in tests) and 160 added.
- **Venv:** `.venv` inside the worktree (git-ignored), built from the root `requirements.txt` on CPython 3.13.14. No new dependencies.

## Files

| Path | What |
|---|---|
| `dynamic_cache/cache_dispatcher.py` | `Dispatcher`: pools, schema choice, idempotency, staircase, LRU user registry and its persistence, `forget`/`export`, `start`/`close`. Also `TelemetryTrials`, `trials_by_schema`, `trials_since`, `purge_idle`, `worker_pool` |
| `dynamic_cache/bloom.py` | `TimedBloom`: a day-sliced Bloom filter with a 14-day TTL; the false-positive table is in its docstring |
| `dynamic_cache/parameter_projector.py` | BE-12 `project(pillars, schema_type) -> theta | None`, `BOUNDS`, `START_THETA` |
| `dynamic_cache/api.py` | The route, the per-id `RateLimiter`, the server wiring (`make_dispatcher`/`get_dispatcher`/`set_dispatcher`/`shutdown`), the privacy hooks, and the lifecycle hooks |
| `backend/app/lifecycle.py` (new) | `on_startup(name, fn)`, `on_shutdown(name, fn)` and the FastAPI `lifespan` that runs them |
| `backend/app/main.py` | **One edit:** `FastAPI(..., lifespan=lifespan)` (allowed by the review) |
| `backend/app/privacy/telemetry_store.py` | `register_user_store(name, delete, export)` with `(key, directory)` hooks, best-effort runs, and `StoreUnavailable` |
| `backend/app/api/routes/v1_privacy.py` | `StoreUnavailable` → 503 with `Retry-After` on delete and export |
| `backend/app/privacy/retention.py` | The CLI also runs `purge_idle` over the task registry and reports `registries_removed` |
| `backend/app/api/routes/v1_interop.py` | `/tasks/next` stand-in deleted |
| `backend/tests/test_app.py` | `INTENTIONAL_OVERRIDES[("/v1/tasks/next", "GET")] = "dynamic_cache.api"`, plus a test that each override is answered by its module |
| `backend/tests/test_v1_interop.py`, `test_honest_endpoints.py` | The `/tasks/next` 501 tests are removed. Its 422 user-id checks are kept |
| `backend/tests/test_retention.py` | The CLI's output now has `registries_removed` |
| `backend/tests/test_lifecycle.py` (new) | The lifespan runs the hooks; a failing shutdown hook does not stop the others |
| `conftest.py` (new, repo root) | Autouse fixture: every test gets a temporary task registry, a dispatcher with `background=False`, and an empty rate limiter |
| `backend/Dockerfile`, `docker-compose.yml`, `backend/.env.example` | Writable `/data/task_registry` (uid 10001, named volume) and `TASK_REGISTRY_DIR` |
| `dynamic_cache/pyproject.toml` | Comment only: `api.py` needs the server's `app` package. The dispatcher, Bloom filter and projector need neither |
| `dynamic_cache/tests/test_{dispatcher,bloom,parameter_projector,tasks_api}.py` | Tests |

## Frontend contract (wave-integration `8b8c859`, `taskSource.ts` + `types.ts`)

**Request.** It sends `GET /v1/tasks/next?user_id=<uuid>` and nothing else. Every other parameter is optional.

**Response.** The route returns exactly the BE-03 `TaskPayload` envelope `{task_id, dimension, schema_type, params, surface_seed}`, as `application/json`, which is what `validTask` checks.

**Errors.** Any non-2xx makes it throw; that covers 422, 429 and 503.

**Drift guard.** `test_the_port_matches_task_source_ts` reads `taskSource.ts` and checks the schema list, the dimension list, the task-id regex and the URL template.

## Route

`GET /v1/tasks/next?user_id&schema_type?&dimension?&session_id?&seq?` is a plain `def`, so it runs in FastAPI's thread pool, never on the event loop.

- **Ids:** `user_id` goes through `telemetry_store.user_key()` (R13).
- **422:** a `schema_type` + `dimension` pair that matches no schema, an unknown value, or a bad id.
- **429:** `Retry-After` is the seconds until the window ends. The limits are per user id, in fixed windows: **120 an hour and 400 a day**.
  - A session is about 8 tasks, so real users never hit them.
  - The daily cap is what keeps a leaked id from saturating its Bloom filter (see the table below). 120/hour alone would allow 2880 a day.
- **503** (`Retry-After: 1`): no unseen task could be built, or a generator failed.
- **No filter:** the schema served longest ago is chosen, so a new user cycles through the 8.

## How it works

**Pools**
- Keyed by `(archetype, schema, theta level)`, levels on a 0.1 grid, `POOL_SIZE = 16` payloads each, already serialised to JSON.
- A pop that leaves a pool half empty queues a refill in a **spawn worker process**. The refill is submitted outside the dispatcher lock.
- An empty pool builds one task inline, in the request thread.
- The worker is started by the lifespan startup hook and stopped by the shutdown hook (`close()`).
- Its initializer starts a thread that `os._exit`s when the parent's sentinel fires, so a hard-killed server leaves no orphan.

**Stroop:** always `inks="classic"`, validated with `allow_unserved=False`. `cvd_safe` is never served.

**No repeats.** One 4096-bit, 7-hash Bloom slice per UTC day, 14-day TTL, so a task is blocked 14 to 15 days. False-positive rates (from the `bloom.py` docstring):

| tasks/day | one slice | 15 such days |
|---|---|---|
| 8 | 9e-14 | 1e-12 |
| 100 | 2.4e-6 | 3.5e-5 |
| 400 (the daily cap) | 7.3e-3 | 0.10 |
| 2880 (no daily cap) | 0.95 | 1.0 |

A false positive only skips a fresh task; it never lets a repeat through.

**Idempotency and "one task_id, one run"** (BE-07 dedupe, Option B)
- The key is `(user, session_id, seq, schema_type, dimension)`; repeating it returns identical bytes, including after a restart.
- Apart from that replay of the same run, a user never gets a `task_id` again within 14 days, retakes included.
- The client must send a new `seq` (or `session_id`) per run.

**Difficulty (BE-12 + the 85% rule)**
- **A per-user, per-schema staircase.** It starts at `project(pillars)`, or at `START_THETA` (the middle of the bounds) with no pillars, which is always the case until BE-11.
- **It steps only on trials it has not counted yet**, and only once **at least 10 new trials** have arrived.
  - At most the newest 60 of them count in one step.
  - The step is Hamza's `apply_85_percent_rule` on b = 5θ − 2.5, with `RULE_STEP = 1.0` (A), then clamped.
- **How trials are tracked.** Each trial carries a marker (`received_at|session|task|trial_index`), and the staircase stores the last one it stepped on.
  - If that trial has left the telemetry window (retention, the 1 MiB tail), only trials received after its `received_at` count.
- **Effect.** Single-trial tasks (matrix, tower) no longer wind it up. Tasks fetched and never played do not move it.
- **Trials source.** The tail of the user's telemetry JSONL, cached by size and mtime, holding up to 5000 users. Deduplicated by item_id/stream like BE-07; fixture ids and torn lines are ignored.

**Projector:** unchanged from the first round.
- Weights come from `pillars.ts`.
- Missing pillars renormalise.
- It returns None when no relevant score exists.
- [0, 1] bounds; MST pinned at 0.5.
- mental_rotation always returns None.

**Registry**
- **Storage.** One `{key}.json` per user (Bloom slices as base64, session recipes, staircases, `last` served time) under `TASK_REGISTRY_DIR` (default `data/processed/task_registry`).
- **Writes.** A writer thread writes behind the request, as tmp + `os.replace`. Failed writes are logged with no user id and retried.
- **Memory is a bounded cache; the file is the source of truth.**
  - At most `MAX_USERS = 5000` users are kept, least recently used first out.
  - Only users whose latest generation is on disk, with no call in flight, are evicted.
  - A change made during a write keeps the user dirty.
  - Per-user locks exist only while a call is in flight.
- **Reads** of a registry no longer wait on the writer's file lock. That wait put the writer's disk time on requests.
- **Retention**
  - A registry idle for 30 days starts afresh when its user returns.
  - `purge_idle(dir, days)` removes files whose mtime is older than that. The retention CLI (`python -m backend.app.privacy.retention --days 30`) runs it.

**Privacy (delete/export)**
- **Hooks.** `register_user_store(name, delete(key, directory), export(key, directory))`.
  - `directory` is None for the server's own locations.
  - When a caller passes an explicit telemetry directory (a tool, a test), the store keeps to `directory/<name>/` and touches nothing else.
- **Failures.** Hooks are best effort: every store is tried, and failures are logged by store name and exception class only. Any failure raises `StoreUnavailable`, which the routes turn into **503 + Retry-After**; the delete is safe to repeat. There is no partial-delete 500.
- **Export content.** The registry is appended as `{"store": "task_registry", "user_id", "data"}` after the events. A corrupt registry file is exported as `{"unreadable": "<raw text>"}`, so the telemetry export still goes out.
- **Test isolation.** The root autouse fixture means no test can reach the real `data/processed/task_registry`. `test_a_pre_existing_registry_file_outside_tmp_is_never_touched` plants a file there and checks its bytes and mtime after serve, export and delete.

## Review round (`0471e25`): each item

| # | Item | Fix | Evidence |
|---|---|---|---|
| 1 | Staircase windup on single-trial schemas | Steps only on trials not yet counted, after ≥ 10 new ones, at most the newest 60 | `test_single_trial_tasks_do_not_wind_the_staircase_up[0.7, 1.0]`: 600 single-trial matrix tasks, simulated learner P = logistic(8(ability − level)); asserts late SD < 0.1 and mean within 0.1 of the 85% point. Over 10 learners through the real dispatcher: **ability 0.7: mean 0.459 (target 0.48), SD 0.054; ability 1.0: mean 0.758 (target 0.78), SD 0.052** (reviewer's fixed sim: 0.06). Also `test_the_rule_steps_only_on_trials_it_has_not_counted` (9 new trials: no step; the 10th: one step on exactly those 10), `test_trials_since_a_marker`, `test_one_step_counts_at_most_the_newest_window` |
| 2 | Privacy tests touched the real registry | Root autouse fixture; hooks honour an explicit directory | `test_a_pre_existing_registry_file_outside_tmp_is_never_touched`, `test_store_hooks_keep_to_an_explicit_directory`, `test_forget_and_export_with_a_directory_touch_only_that_directory`; the retention CLI subprocess tests inherit the temporary `TASK_REGISTRY_DIR` |
| 3 | Unbounded per-user memory | LRU of 5000; only clean users with nothing in flight are evicted; locks only while in flight; the trials cache is bounded too | `test_memory_keeps_at_most_max_users_evicting_clean_ones` (dirty users stay; after flush the LRU goes; an evicted user reloads with its seen filter), `test_a_user_with_a_call_in_flight_is_not_evicted`, `test_a_change_made_during_a_write_keeps_the_user_dirty`, `test_telemetry_trials_cache_is_bounded` |
| 4 | Orphan worker on a hard kill | Initializer thread waits on `parent_process().sentinel`, then `os._exit`; lifespan hooks via `app/lifecycle.py` | `test_the_worker_exits_when_its_parent_is_killed` (subprocess parent, `kill()`, worker pid gone), `test_lifespan_starts_and_stops_the_dispatcher`, `test_lifecycle.py` (3 tests). Live: uvicorn hard-killed with `Stop-Process -Force`; its worker 26676 was gone 3 s later |
| 5 | First submit under the lock | `_refill_job` under the lock, `_submit` after; `start()` spawns the worker at startup | `test_the_first_submit_runs_outside_the_dispatcher_lock` (another thread takes the lock from inside `submit`) |
| 6 | Delete/export robustness | Best-effort hooks, logged without ids; `StoreUnavailable` → 503; corrupt registry exported raw | `test_a_failing_store_makes_delete_503_and_still_runs_the_others` (other stores ran, the registry file is gone, the log names the store and `ZeroDivisionError` but not the id, a retry gives 200), `test_a_failing_store_makes_export_503`, `test_a_corrupt_registry_does_not_block_the_telemetry_export`, `test_a_corrupt_registry_is_exported_raw` |
| 7 | Registry retention | 30-day idle reset in memory; `purge_idle`; wired into the retention CLI | `test_a_registry_idle_past_retention_starts_afresh`, `test_purge_idle_removes_registry_files_untouched_for_30_days`, `test_the_retention_cli_purges_idle_registries`. Live CLI: `{"files": 0, ..., "registries_removed": 2}` (two files set 40 days old out of 93) |
| 8 | Bloom docstring | Correct per-slice and 15-slice false-positive table | `bloom.py` docstring; `test_false_positive_rate_is_small` |
| 9 | Rate limit | 120/hour and 400/day per id, fixed windows, 429 + Retry-After, at most 50k ids tracked | `test_too_many_calls_for_one_id_are_429` (case-insensitive id, per id, next window), `test_rate_limiter_windows_and_bound`, `test_default_limits`. Live: 125 calls → 120 × 200, 5 × 429, `retry-after: 3456` |
| 10 | p99 at production POOL_SIZE, paced | New paced test at 16 deep, 100 calls/s; the unpaced burst is stated in its docstring | `test_p99_under_10_ms_at_production_pool_size_paced`: last run **p50 0.14 ms, p99 0.47 ms**. The warm 48-deep test: p50 0.02 ms, p99 1.08 ms |

Found and fixed while testing round 2 (not in the review):
- Registry reads waited on the writer's file lock. Fixed as above.
- The real-registry probe test left an empty `data/processed/`. It now removes every directory it created.

## Acceptance criteria → evidence

| AC | Evidence |
|---|---|
| Per-archetype pools refilled from BE-03 off the event loop | `test_pools_are_per_archetype`, `test_background_refill_keeps_the_pool_warm`; a plain `def` route; the worker process |
| Archetype defaults to neutral | `NEUTRAL` default |
| `schema_type` (and `dimension`) filter | `test_schema_filter[8]`, `test_dimension_filter_cycles_its_schemas[6]`, `test_every_schema_is_served_and_valid[8]`, `test_bad_requests_are_422[7]` |
| Idempotent per (user, session) | `test_same_session_and_seq_returns_the_same_task`, `test_idempotent_across_a_restart`, `test_a_double_get_in_flight_gets_one_task`, `test_idempotent_per_user_and_session` |
| One task_id per run (BE-07) | `test_a_retake_never_gets_a_task_id_already_served`, `test_a_retake_when_only_the_old_task_is_buildable_is_refused_not_repeated` |
| No repeat within 14 days, simulated clock | `test_no_repeat_within_14_days_simulated_clock`, `test_blocked_for_at_least_14_days_from_any_time_of_day`, `test_seen_filter_survives_a_restart` |
| Persisted under `data/processed/`, covered by delete/export | `test_delete_clears_the_registry`, `test_forget_drops_memory_and_file`, `test_a_pending_write_cannot_undo_a_delete`, `test_export_includes_the_registry`, plus review items 2 and 6 |
| Projector monotone and bounded | `test_monotone_in_every_pillar[8]`, `test_bounded_for_any_input[8]`, `test_no_relevant_score_is_none_not_a_made_up_level`, `test_projection_feeds_the_generators[24]` |
| 85% rule over recent telemetry accuracy | `test_85_percent_rule_moves_theta_from_recent_accuracy[3]`, `test_the_rule_steps_only_on_trials_it_has_not_counted`, `test_perfect_play_walks_up_to_harder_levels_and_stays_bounded`, `test_single_trial_tasks_do_not_wind_the_staircase_up[2]` |
| Stroop classic only | `test_stroop_is_served_with_the_classic_inks_only` |
| p99 < 10 ms | `test_p99_under_10_ms_with_warm_pools`, `test_p99_under_10_ms_at_production_pool_size_paced` |
| Frontend contract shape | `test_the_frontends_exact_request_gets_a_valid_task`, `test_the_port_matches_task_source_ts`, `test_openapi_documents_the_payload` |
| Stand-in replaced | `test_no_route_shadows_a_v1_interop_stand_in_by_accident`, `test_intentional_overrides_are_answered_by_their_module` |

## Curl and HTTP evidence (round 2)

`uvicorn app.main:app --app-dir backend --port 8769`, with `TASK_REGISTRY_DIR` and `TELEMETRY_DIR` in a scratch directory.

**All 8 schemas**

First call (cold pool, built inline):

```
n_back           200 6841B 0.042s   (first request of the process)
stroop           200 4672B 0.003s
matrix           200 1098B 0.003s
mental_rotation  200 13984B 0.010s
relational       200 23588B 0.008s
tower            200 307B 0.005s
ufov             200 17989B 0.020s
mst              200 18185B 0.011s
```

Second call (refilled pools):

```
n_back 0.0022s | stroop 0.0020s | matrix 0.0020s | mental_rotation 0.0020s | relational 0.020s | tower 0.0019s | ufov 0.0020s | mst 0.014s
```

Each curl is a new process and a new TCP connection, and isolated 11–25 ms outliers show up on `GET /` too, which never touches the dispatcher. They are measurement noise from this Windows box. The keep-alive client below is the fair measure.

**Keep-alive client** (`bench_http.py`, 40 users):

```
paced 100 req/s, 400 calls:  p50 1.39 ms  p99 3.48 ms  max 9.08 ms
unpaced burst, 200 calls:    p50 1.00 ms  p99 7.91 ms  max 8.32 ms
```

In round 1 the unpaced burst reached 10–15 ms, before the read-path fix. An unpaced burst can still drain a 16-deep pool, and the empty pool then builds inline: MST takes about 7 ms, mental rotation about 6 ms.

**Rate limit:**

```
125 calls for one id -> 120 x 200, 5 x 429; then: HTTP/1.1 429 Too Many Requests, retry-after: 3456
```

**Delete then export:**

```
DELETE /v1/user/telemetry?user_id=curl-user -> {"deleted_events":0,"deleted_files":1}
GET /v1/user/export -> 404
```

**Idempotency and 422s** (round 1, unchanged):
- the same `session_id`/`seq` twice gives identical bytes; `seq=1` gives a new task;
- 422 for disagreeing filters, a bad id, an unknown schema, and a bad session id.

**Hard kill:** after `Stop-Process -Force` on the server, its spawn worker had exited 3 s later.

## Decisions to review

1. **The staircase** is seeded by the projector and walked by the 85% rule on new trials only. A seeded staircase is not re-projected when pillars change; BE-11 may want to re-seed, for example on an archetype change.
2. **`RULE_STEP = 1.0`** (A), with `MIN_TRIALS = 10` new trials per step. With Hamza's default step of 0.25, the sim's late SD is 0.03 but it converges four times slower.
3. **`START_THETA` = the middle of the bounds** (A). MST is pinned at 0.5; mental_rotation has no projection.
4. **Rate limits of 120/hour and 400/day** use fixed windows, so up to 2× the limit can pass across a window boundary. The state is in memory and per process.
5. **Export format:** store records are appended after the events. A corrupt registry goes out as raw text.
6. **Retention:** registries share the telemetry period (`--days`, 30).
7. **One `generate()` payload per fetch.** The TOL-F series and matrix blocks are not served.

## Requests

- **F-C (frontend):** send `schema_type` and `session_id` + a per-run `seq`. Never reuse a `(session_id, seq)` for a retake. Handle 429 and 503 by waiting `Retry-After`. (The coordinator is routing this.)
- **BE-06 / any per-user store:** the hook signature is now `delete(key, directory)` / `export(key, directory)`, best effort, with `StoreUnavailable` → 503. With an explicit directory, keep to `directory/<name>/`. Expect a small merge in `telemetry_store.py`.
- **Any module with background work:** register start/stop with `app.lifecycle.on_startup` / `on_shutdown` instead of editing `main.py`.
- **BE-11:** pass `pillars=` and `archetype=` to `api.make_dispatcher(...)`.
- **BE-13:** LLM variants can enter the same pools as `Entry`. Their session recipes need a source field, since an LLM variant cannot be rebuilt from a seed.
- **Ops:** run the retention CLI daily, as before; it now also prunes idle task registries.
