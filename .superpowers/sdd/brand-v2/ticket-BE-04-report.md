# Ticket BE-04 (+ BE-12) report: `GET /v1/tasks/next`, dispatcher, Bloom/TTL, parameter projector

- **Branch:** `worktree-agent-a483458eabf534f4e`, reset to the BE-PORT tip `ae67522` before any work.
- **Commits** (no AI attribution):
  - `c580939 feat(dynamic_cache): GET /v1/tasks/next dispatcher, Bloom/TTL registry, parameter projector (BE-04, BE-12)`
  - this report, in a second commit.
- **Tests:** one `pytest -q` from the repo root: **984 passed, 1 xfailed, 0 warnings**. It also passes with `-W error`. The base had 858 passed + 1 xfailed; 6 tests were removed (the 501 stand-in tests) and 132 added.
- **Venv:** `.venv` inside the worktree (git-ignored), built from the root `requirements.txt` on CPython 3.13.14. No new dependencies.

## Files

| Path | What |
|---|---|
| `dynamic_cache/cache_dispatcher.py` | `Dispatcher`: pools, schema choice, idempotency, staircase, registry persistence, `forget`/`export`. `TelemetryAccuracy`, `accuracy_by_schema` |
| `dynamic_cache/bloom.py` | `TimedBloom`: a day-sliced Bloom filter with a 14-day TTL |
| `dynamic_cache/parameter_projector.py` | BE-12 `project(pillars, schema_type) -> theta | None`, `BOUNDS`, `START_THETA` |
| `dynamic_cache/api.py` | The route, the server wiring (`make_dispatcher`, `get_dispatcher`, `set_dispatcher`) and the privacy hook registration |
| `backend/app/privacy/telemetry_store.py` | `register_user_store(name, delete, export)`. `delete_user` and `export_user` now cover registered stores |
| `backend/app/api/routes/v1_interop.py` | `/tasks/next` stand-in deleted |
| `backend/tests/test_app.py` | `INTENTIONAL_OVERRIDES[("/v1/tasks/next", "GET")] = "dynamic_cache.api"`, plus a test that each override is answered by its module (the stand-in is gone, so the old loop no longer sees it) |
| `backend/tests/test_v1_interop.py`, `test_honest_endpoints.py` | 501 tests for `/tasks/next` removed. The 422 user-id checks for it are kept and still pass |
| `backend/Dockerfile`, `docker-compose.yml`, `backend/.env.example` | Writable `/data/task_registry` (uid 10001, named volume) and `TASK_REGISTRY_DIR`. Without these, the container could not persist the registry |
| `dynamic_cache/pyproject.toml` | Comment only: `api.py` needs the server's `app` package. The dispatcher, Bloom filter and projector need neither FastAPI nor `app` |
| `dynamic_cache/tests/test_{dispatcher,bloom,parameter_projector,tasks_api}.py` | Tests |

## Frontend contract (wave-integration `8b8c859`, `taskSource.ts` + `types.ts`)

**Request.** It sends `GET /v1/tasks/next?user_id=<uuid>` and nothing else: no `schema_type`, `dimension` or session. Every other parameter is optional.

**Response.** `validTask` checks `schema_type` ∈ 8, `dimension` ∈ 6, `task_id` against `^[\w:.-]{1,48}$`, and that `params` is an object. The route returns exactly the BE-03 `TaskPayload` envelope `{task_id, dimension, schema_type, params, surface_seed}`, as `application/json`.

**Errors.** Any non-2xx makes it throw, so 422 and 503 are both safe for it.

**Drift guard.** `test_the_port_matches_task_source_ts` reads the repo's `taskSource.ts` (skipped when `frontend/` is absent). It checks:
- the schema list
- the dimension list
- the task-id regex
- that the exact URL template still holds

## Route

`GET /v1/tasks/next?user_id&schema_type?&dimension?&session_id?&seq?` (a plain `def`, so it runs in FastAPI's thread pool, never on the event loop):

- `user_id` goes through `telemetry_store.user_key()` (R13), so `U1` and `u1` are the same user.
- `schema_type` and `dimension` are Literal enums. A pair that matches no schema (`stroop` + `working_memory`) is a **422**.
- `session_id` (the ID pattern) and `seq` (an int in 0..100000) form the idempotency key.
- **503** with `Retry-After: 1` when no unseen task can be built (`NoFreshTask`) or a generator fails.
- With no filter, the schema served longest ago is chosen; never-served schemas come first, in `SCHEMA_TYPES` order. A new user therefore cycles through the 8 schemas.

## How it works

**Pools**
- Keyed by `(archetype, schema_type, theta level)`, with levels on a 0.1 grid.
- Each holds up to `POOL_SIZE = 16` payloads, already serialised to JSON bytes, so a hit does no JSON work.
- A pop that leaves a pool half empty queues a refill in a **spawn worker process** (`ProcessPoolExecutor(max_workers=1)`).
- An empty pool builds one task inline, in the request's worker thread.
- Pools fill lazily. `warm()` exists for benchmarks or startup.

**Why a process, not a thread:** with a refill thread, uvicorn requests took 20–40 ms. The CPU-bound generator held the GIL against every thread handoff. With the process, a warm request takes about 3 ms (evidence below).

**Archetype:** `NEUTRAL` for everyone until BE-09/BE-11. `ARCHETYPE_OPTIONS[archetype][schema]` holds the generator options per archetype.

**Stroop:** always built with `inks="classic"`. Payloads go through `generate(..., validate=True)` and `allow_unserved` stays False, so `cvd_safe`/`black` cannot be served.

**No repeats (`bloom.py`)**
- One 4096-bit, 7-hash Bloom slice per UTC day, per user. A lookup reads the slices from the last 14 days, so a task stays blocked for 14 to 15 days, never less.
- A false positive only skips a fresh task. It never lets a repeat through.
- Measured: under 1e-3 at 100 tasks a day.
- Seen pool entries go back to the pool for other users.

**Idempotency**
- The key is `(user, session_id, seq, schema_type, dimension)`. Repeating it returns the same bytes, from a replay cache or by deterministic rebuild after a restart.
- The registry stores the recipe (schema, level, seed, archetype, task_id), not the payload. If a rebuild's task_id ever differs (a CPython change, per BE-03's determinism note), the session gets a new task rather than a different one under the old id.
- A per-user lock makes two concurrent identical GETs (StrictMode) return one task.
- Without a `session_id`, every call is a new task.

**Coordinator cross-ticket item (BE-07 dedupe on `(session_id, task_id:trial_index, stream)`): Option B.**
- A user is never served a `task_id` again within the 14-day TTL, retakes included.
- The only exception is the idempotent replay of the **same run** (same `session_id`, `seq` and filter).
- If only an already-served task can be built, the call is refused (503); the old id is never reused.
- Documented in the `cache_dispatcher.py` docstring. Tests: `test_a_retake_never_gets_a_task_id_already_served` and `test_a_retake_when_only_the_old_task_is_buildable_is_refused_not_repeated`.
- **Client rule:** send a new `seq` (or `session_id`) for every run. Reuse one only to re-ask for the same run.

**Difficulty (BE-12 + the 85% rule)**
- **Per-user, per-schema staircase.** The first theta is `project(pillars, schema)`. With no relevant pillar score (always true today: there is no server profile until BE-07/BE-11), it is `START_THETA`, the middle of the schema's bounds. That is a labelled design prior (A), not an estimate of the user.
- **Each new task applies one step of Hamza's rule** (`ExerciseGenerator.apply_85_percent_rule`) to the recent accuracy on that schema:
  - the step runs on b = 5θ − 2.5 and maps back;
  - `RULE_STEP = 1.0` (A): +0.04 θ at 95% accuracy, −0.06 at 70%. Hamza's default of 0.25 would move θ by at most 0.015.
  - the result is clamped to the schema's bounds.
- **It steps only when new trials of that schema arrived** since the last step. This uses a marker for the newest trial counted, so tasks fetched and never played do not move it.
- **Accuracy** is 1 − error rate over the last 60 trials of the schema, with at least 10 trials required. It is read from the tail (≤ 1 MiB) of the user's telemetry JSONL in `TELEMETRY_DIR` and cached by size and mtime.
  - The schema comes from the task_id prefix (`{schema}-{seed}-...`). Fixture ids such as `mock-nback-1` are ignored.
  - Duplicate events count once: keyed by item_id/stream like BE-07, else by `(session, task, trial_index)`.
  - Torn lines are skipped.

**Projector (`parameter_projector.py`)**
- **Weights.** Each schema's weights are the doc weights of the pillar inputs it feeds (`pillars.ts PILLAR_WEIGHTS`):
  - n_back: focus .45 / agility .40
  - stroop: agility .40 / impulse .50
  - tower: focus .30 / impulse .30
  - matrix, relational: focus
  - mst: memory
  - ufov: visual
  - mental_rotation: none, so it always returns None
- **Formula.** Missing pillars renormalise, as in `pillars.ts`; values are clipped to 0..100; non-finite values count as missing. θ = lo + (hi − lo)·mean/100.
- **Bounds.** [0, 1] for every schema except **MST, pinned at 0.5**: its generator ignores theta, so its pool never splits by level.

**Registry**
- One `{key}.json` per user under `data/processed/task_registry/`, or `TASK_REGISTRY_DIR`. It holds the Bloom slices as base64 (not a task list), the session recipes (≤ 64, none older than 14 days) and the staircases.
- Written behind the request by one writer thread, as an atomic tmp file + `os.replace`.
- A failed write is logged (no user id in the log), kept dirty and retried.
- A pending write cannot recreate a file after a delete: the identity check runs under the I/O lock.

**Privacy**
- `api.py` registers the registry as a store with `telemetry_store.register_user_store`.
- `DELETE /v1/user/telemetry` drops it from memory (state, replay cache, accuracy cache) and from disk, and counts it in `deleted_files`.
- `GET /v1/user/export` appends one line, `{"store": "task_registry", "user_id": ..., "data": <registry>}`, after the events. If the user has only a registry, export now returns that line instead of a 404.
- The frontend does not call the export route (checked on wave-integration).

## Acceptance criteria → evidence

| AC | Evidence |
|---|---|
| Per-archetype in-memory pools refilled from BE-03 off the event loop | `test_pools_are_per_archetype`, `test_background_refill_keeps_the_pool_warm` (refill in the worker process); a plain `def` route |
| Archetype defaults to neutral | `NEUTRAL` default in `Dispatcher(archetype=...)` |
| `schema_type` filter (and `dimension`) | `test_schema_filter[8]`, `test_dimension_filter_cycles_its_schemas[6]`, `test_filters_that_disagree_raise`, `test_every_schema_is_served_and_valid[8]` (HTTP), `test_bad_requests_are_422[7]` |
| Idempotent per (user, session) | `test_same_session_and_seq_returns_the_same_task`, `test_filter_is_part_of_the_idempotency_key`, `test_idempotent_across_a_restart`, `test_a_double_get_in_flight_gets_one_task` (8 threads), `test_idempotent_per_user_and_session` (HTTP, case-insensitive id) |
| No repeat within 14 days, simulated clock | `test_no_repeat_within_14_days_simulated_clock` (a constant seed means one possible task: refused on days 0, 1, 7, 13 and 14, served again on day 16, and another user gets it on day 0), `test_blocked_for_at_least_14_days_from_any_time_of_day`, `test_seen_filter_survives_a_restart`, `test_a_seen_task_is_skipped_for_a_fresh_one` |
| Persisted under `data/processed/`; delete drops it | `test_delete_clears_the_registry` (HTTP: the file and memory are gone, the other user is untouched, `deleted_files` is 1), `test_forget_drops_memory_and_file`, `test_a_pending_write_cannot_undo_a_delete`, `test_export_includes_the_registry`, `test_export_puts_the_registry_after_the_events` |
| Projector monotone and bounded per schema | `test_monotone_in_every_pillar[8]` (each pillar × a 3^4 grid of the others), `test_bounded_for_any_input[8]` (NaN, ±inf, −50, 1e9, None), `test_relevant_pillars_span_the_whole_range`, `test_no_relevant_score_is_none_not_a_made_up_level`, `test_projection_feeds_the_generators[24]` |
| 85% rule applied over recent accuracy from telemetry | `test_85_percent_rule_moves_theta_from_recent_accuracy[3]` (100% up, 50% down, 85% flat, matching the rule's own output), `test_the_rule_steps_once_per_batch_of_new_trials`, `test_perfect_play_walks_up_to_harder_levels_and_stays_bounded`, `test_accuracy_needs_enough_trials_and_ignores_duplicates_and_fixtures`, `test_accuracy_window_is_the_most_recent_trials`, `test_projector_seeds_the_staircase` |
| Stroop: classic inks only | `test_stroop_is_served_with_the_classic_inks_only` |
| p99 < 10 ms, warm pools | `test_p99_under_10_ms_with_warm_pools`: 320 calls, 40 users, background refill on. Last run **p50 0.05 ms, p99 2.7 ms** in-process |
| Frontend contract shape | `test_the_frontends_exact_request_gets_a_valid_task` (UUID id, exact key set, `application/json`), `test_the_port_matches_task_source_ts`, `test_openapi_documents_the_payload` (only `user_id` is required) |
| `INTENTIONAL_OVERRIDES` entry, stand-in and 501 tests deleted | `test_no_route_shadows_a_v1_interop_stand_in_by_accident`, `test_intentional_overrides_are_answered_by_their_module` |

## Curl evidence

`uvicorn app.main:app --app-dir backend --port 8767` with `TASK_REGISTRY_DIR` and `TELEMETRY_DIR` set to scratch dirs, called through `127.0.0.1`. (`localhost` on this Windows box adds about 200 ms of IPv6 fallback in curl.)

**First call per schema** (cold pool, built inline). The task id, dimension and envelope keys come from parsing each body:

```
n_back           n_back-1552133189-377b7d37c5 working_memory ['dimension','params','schema_type','surface_seed','task_id'] 200 6781B 0.140s  (first request of the process)
stroop           stroop-2045591139-4096a33615 executive_function  ...  200 4672B 0.006s
matrix           matrix-2982995028-40be907204 pattern_induction   ...  200 1070B 0.004s
mental_rotation  mental_rotation-3254134888-e876b41b66 spatial_orientation ... 200 13986B 0.022s
relational       relational-2492858473-4cf6e70a44 pattern_induction ... 200 23756B 0.015s
tower            tower-3408667490-4f102515bc executive_function  ...  200 307B 0.009s
ufov             ufov-1515526886-bc03a15fbc processing_speed     ...  200 17991B 0.008s
mst              mst-4133520358-29c30dd423 episodic_memory       ...  200 18143B 0.029s
```

**Second call per schema**, once the worker process had refilled the pools:

```
n_back 200 6878B 0.0031s | stroop 200 4672B 0.0042s | matrix 200 1076B 0.0032s | mental_rotation 200 13986B 0.0030s
relational 200 23565B 0.0030s | tower 200 309B 0.0027s | ufov 200 17991B 0.0035s | mst 200 18610B 0.0038s
```

**The frontend's exact request** (`?user_id=3f2a9c1e-…`), 8 calls for a new user. It cycles through all 8 schemas, 3.2–4.6 ms each.

**Idempotency:**

```
session_id=sess-42&seq=0 twice -> n_back-86178129-762c57d386, identical bytes (True)
seq=1                          -> stroop-1270313912-aff6da6b3b
```

**Errors:**

```
422 user_id=u1&schema_type=stroop&dimension=working_memory  {"detail":"no stroop task has dimension working_memory"}
422 user_id=../x            (string_pattern_mismatch on user_id)
422 schema_type=go_no_go    (literal_error)
422 session_id=a.b          (string_pattern_mismatch on session_id)
DELETE /v1/user/telemetry?user_id=curl-user -> {"deleted_events":0,"deleted_files":1}; then GET /v1/user/export -> 404
```

**HTTP latency** (keep-alive client, server above):
- **Paced at 100 req/s** (400 calls, 25 users): **p50 1.59 ms, p99 2.43 ms**, max 4.4 ms.
- **Unpaced burst** (200 back-to-back calls): p99 10–15 ms. The burst drains the 16-deep pools faster than the single worker refills them, and the empty pools build inline. A single user's flow is nowhere near that rate. Raise `POOL_SIZE` or call `warm()` if a burst profile matters.

## Decisions to review

1. **Staircase vs. a stateless projection.** The projector only seeds each staircase, and the 85% rule walks it. Applying the rule fresh to the projection on every call would never converge: one step is ≤ 0.085 θ. Once BE-11 supplies pillars, it may want to re-seed, for example on an archetype change. Today a seeded staircase is not re-projected.
2. **`RULE_STEP = 1.0`** (A), versus Hamza's default of 0.25. The rule function is unchanged.
3. **`START_THETA` = the middle of the bounds** (A). This is a staircase prior and appears in no response. The task payload carries no theta.
4. **MST pinned at 0.5**, and mental_rotation has no projection: no pillar input feeds it.
5. **Export format.** Registry records are appended to the JSONL export as `{"store", "user_id", "data"}` lines. Export used to be 404 when there were no events; it now returns 200 if a registry exists.
6. **Accuracy from `error_flag`**, the most recent 60 trials, at least 10. Practice items are not excluded: none are served, because `generate_block` is not used.
7. **One task = one `generate()` payload.** For tower that is a single problem; for matrix, a single item. The frontend plays one payload per fetch. The TOL-F series and matrix blocks (`generate_block`) are not served.

## Requests

- **F-C (frontend):** send `session_id` plus a per-run `seq` on `/v1/tasks/next`:
  - Without them, StrictMode's double GET hands out two tasks, and the unplayed one is burnt for 14 days.
  - Never reuse a `(session_id, seq)` for a retake (BE-07 dedupe; see Option B).
  - Handle 503 by retrying after `Retry-After`.
- **BE-06 / any per-user store:** use `telemetry_store.register_user_store(name, delete, export)` rather than adding another special case to `delete_user`/`export_user`. Expect a small merge in `telemetry_store.py` if BE-06 edited the same functions.
- **BE-11:** pass `pillars=` (0–100 per pillar, None when below coverage) and `archetype=` into `api.make_dispatcher(...)`. Nothing else changes.
- **BE-13:** feed LLM variants into the same pools (`Entry(task_id, body, seed)`), after `validate_payload`. Recipes then need a `source`, because an LLM variant cannot be rebuilt from a seed.
- **Retention follow-up:** a registry file stays until the user is deleted or comes back, when it prunes itself. A `purge_idle(days)` in `retention.py` would bound inactive users. Not done: the files are small (≤ 8 KB) and hold no task list, but GDPR storage limitation argues for it.
- **TD/CI:** the dispatcher's worker is a spawn process. The first refill in a fresh process pays about 0.5–1 s of child start-up, off the request path.
