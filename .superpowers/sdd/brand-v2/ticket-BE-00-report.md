# BE-00 report: Hamza's backend/ becomes the one API server

Branch `worktree-agent-a879d7a236faa963b`. Base `6033acd` (B1 tip). Merge commit `cd69a95` has two parents: `6033acd` and `hamza/feat/agent-integration-doodle-ui` (`1085ec8`), so his history is kept.

`frontend/`, `ai_coach/`, `dynamic_cache/` and `data/` are byte-identical to `6033acd`.

## 1. Merge decisions

| Path (from 1085ec8) | Decision | Why |
|---|---|---|
| `backend/` (app, tests, requirements, Dockerfile, .env.example) | **Kept**, then changed (see §2 and §3) | It is the main server (user decision). |
| `dashboard_ui/` | **Dropped** | Stays on his branch (user decision). |
| `frontend/` changes (WelcomePage, AssessmentHubPage, apiClient, AgentTaskSandbox, Dockerfile) | **Dropped**, ours kept | Our frontend was rewritten after 799d2d2. |
| `AGENTS.md` (add/add conflict) | **Ours**, plus a new `## Backend` section (how to run, router rule, tests, config, no region names in payloads) | His file was Doodle design-token rules for the frontend. `docs/design/` already covers them, and his copy also pointed at `dashboard_ui`. |
| `docker-compose.yml` | **Kept, reduced** to the `backend` service | The `frontend` service built `dashboard_ui`. `db` (Postgres) and `redis` were not used: the store is in memory, and his own diagram says "not connected". I also dropped `DATABASE_URL`, `REDIS_URL` and the LLM key variables, which nothing reads. The build context is now the repo root, because the app imports the root module packages. The telemetry JSONL is mounted from `./data/raw/telemetry`. |
| `backend/Dockerfile` | **Kept, rewritten** | Builds from the repo root (`docker build -f backend/Dockerfile .`) on Python 3.13, like CI, and copies the module packages. `backend/Dockerfile.dockerignore` sends only what the build copies. |
| `backend/.env.example` | **Kept, rewritten** | Now lists only `CORS_ALLOW_ORIGINS` and `TELEMETRY_DIR`. |
| `backend/requirements.txt` | **Kept, pinned and trimmed** | Drops `sqlalchemy`, `python-dotenv`, `pydantic-settings` and `pytest-asyncio`: nothing imports them. Adds the B1 pins and `numpy`/`scipy`/`networkx`. It replaces `assessment_engine/api/requirements.txt`. |
| `scripts/run_dev.ps1` | **Kept, rewritten** | His version hard-coded `..\Agent Part\...` venv paths (TD-02 forbids machine paths) and fell back to `dashboard_ui`. The new one starts uvicorn from the root and then the Vite frontend. It prints `Usage:` when `frontend/node_modules` is missing. |
| `scripts/run_tests.ps1` | **Dropped** | One `pytest -q` from the root replaces it. It also ran `assessment_engine/api/tests`, which no longer exists. |
| `scripts/deploy_docker.ps1` | **Dropped** | It only wrapped `docker compose up --build -d` and advertised the cockpit on :3000. |
| `package.json` (root) | **Dropped** | Every script targeted `dashboard_ui` or duplicated `run_dev.ps1`. The frontend has its own `package.json`. |
| `.agents/rules/frontend_guidelines.md` | **Dropped** | Duplicated the design system, pointed at `dashboard_ui` tokens, and linked to `file:///C:/Users/hamza/...`. |
| `docs/frontend_guidelines.md` | **Dropped** | Same `file:///C:/Users/hamza/...` pointer-only file. |
| `docs/ai4brain_architecture.drawio` | **Dropped** | It describes the dropped cockpit (3D brain mesh, coach orb), a "USER CV / WEBCAM TILE" that contradicts the no-biometrics rule, "5-Region Brain Kalman Filter: tracks dlPFC, ACC…", and stale "empty folder" claims. |

## 2. What moved where

| From | To |
|---|---|
| `assessment_engine/api/routes/telemetry.py` | `backend/app/api/routes/v1_telemetry.py` (git rename). Unchanged contract: strict `TelemetryEvent` (`extra="forbid"`, no NaN/Inf), `ID_PATTERN` now a named constant (same name BE-02 uses), batch ≤ 100, `202 {"accepted": n}`, `{TELEMETRY_DIR}/{user_id}.jsonl` + `received_at`. `REPO_ROOT` is now `parents[4]`, so the default dir is still `<repo>/data/raw/telemetry`. |
| `assessment_engine/api/routes/privacy.py` | `backend/app/api/routes/v1_privacy.py`: now holds the honest `DELETE /v1/user/telemetry` (§3). |
| `assessment_engine/api/routes/auth.py` | `backend/app/api/routes/v1_auth.py`: empty router. Its comment now says users are anonymous (R13). |
| `assessment_engine/api/main.py` | `backend/app/main.py`: the same mounting rule and the custom 422 handler (no `input` echo). The repo root goes on `sys.path`. |
| `assessment_engine/api/tests/{conftest,test_app,test_telemetry}.py` | `backend/tests/{conftest,test_app,test_telemetry_event}.py` |
| `assessment_engine/api/{pytest.ini,requirements.txt,routes/__init__.py}` | deleted. `assessment_engine/api/` no longer exists in git. `assessment_engine/client/` is untouched. |
| `/v1/telemetry/event` and `/v1/user/telemetry` in his `v1_interop.py` | removed. Ours replace them. |

`backend/app/main.py` mounts these routers, in this order:
1. `v1_telemetry`, `v1_privacy`, `v1_auth`, `dynamic_cache.api`, `ai_coach.api`, `brain_twin_jepa.api` (the B1 module routers)
2. `v1_interop` (his /v1 stand-ins)
3. his `/api` routers (session, telemetry, brain, coach)

Because the module routers come first, a `/v1` route that BE-04/06/11 adds to its module shadows the stand-in in `v1_interop`. `test_app.py::test_module_routes_win_over_the_interop_router` pins that behaviour.

Run (repo root): `uvicorn app.main:app --app-dir backend --reload`. I smoke-tested this on :18765: `/` 200, `/v1/clustering/evaluate` 501, `/v1/dashboard/profile` gave `not_enough_data`.

Config and docs updated:
- **Config:** root `requirements.txt` (`-r backend/requirements.txt`), root `pytest.ini` (`pythonpath = . backend`, testpaths `backend/tests`), `tests/test_workspace.py` (and a new `test_one_api_server`), and the CI Python job names (the steps were already `pip install -r requirements.txt` and `python -m pytest -q`).
- **Docs:** `scripts/README.md`, `AGENTS.md`, `assessment_engine/{README,GUIDE,HANDOVER}.md`, `docs/ui/contracts.md`, `docs/ui/pages/04-task-runner.md`, and the `brain_twin_jepa/api.py` comment.

CORS: origins now come from `CORS_ALLOW_ORIGINS` (comma-separated, default `http://localhost:5173`). `allow_credentials=False`: users are anonymous and no cookies or auth headers are used. That also keeps `*` valid if someone sets it.

## 3. Endpoint audit (every route in backend/app)

"Before" is 1085ec8; "after" is this branch.

| Route | Before | After | Notes |
|---|---|---|---|
| `GET /` | partial: marketing fields `digital_brain_nodes` (region names) and `design_system` | **real** | Returns status, version and the psychometric methods. |
| `POST /v1/telemetry/event` | **fake**: accepted any dict, stored nothing, bumped `session_count` per event | **real** (ours) | Strict model, JSONL sink. |
| `DELETE /v1/user/telemetry` | **fake**: cleared in-memory state only and said "purged" | **real** | Deletes `{user_id}.jsonl` and returns `{deleted_events, deleted_files, deleted_evaluations}`. `user_id` must match `ID_PATTERN` (422 otherwise). It also clears the in-memory store, including that user's cached sessions. Idempotent. |
| `POST /v1/clustering/evaluate` | **fake**: fixed posteriors, "Focused Builder" | **501** `{"detail": "clustering not available yet"}` | `clustering_engine/` is empty. |
| `GET /v1/coach/collaboration-score` | **fake**: `calculate_score(cluster_id=…)` lacks the required `dimension_scores`, so it always raised and returned 82.5 and fixed dimensions | **501** `{"detail": "collaboration score not available yet"}` | `ai_coach/collaboration_scorer.py` is real maths, but it needs the user's chat history (to get `DimensionScores`) and a cluster id. The server stores neither, and calling it on defaults returns baseline 50s, which would be fake. |
| `GET /v1/dashboard/profile` | **fake** (details below) | **partial** | Details below. |
| `POST /v1/coach/chat` | **fake**: called `AICoachAgent.generate_response`, which does not exist, so it always fell back to canned text ("…centered on dlPFC") | **real relay** | Calls `AICoachAgent().handle_chat(ChatRequest(user_id, message))`. Any failure gives 503 `{"detail": "coach not available"}`, never canned text. Reply quality and safety belong to ai_coach (BE-05). |
| `GET /v1/tasks/next` | **fake/broken** (details below) | **partial** | A valid static 2-back working-memory block with a random `surface_seed`. Not adaptive; the docstring now says so. BE-04 replaces it with the BE-03 generators. |
| `POST /api/session/init`, `GET /api/session/init` | real compute (his generator and renderer) | unchanged, **real** | The response exposes region names (`target_node`, `current_brain_state`, `reasoning_trace`). GET defaults `user_id=usr_default`. No product consumer. |
| `GET /api/session/sandbox/{id}` | partial | unchanged | An unknown id silently starts a new session for `usr_sandbox` instead of returning 404. |
| `POST /api/telemetry/ingest` | **real**: EZ-DDM, 3PL-IRT MLE, SSRT, d′, RCI, then the Kalman update | unchanged | In memory only, lost on restart. Responses are keyed by region. Errors return 400 with the exception text. |
| `GET /api/brain/state/{user_id}` | partial | unchanged | Real state. An unknown user gets the normative prior (all 50), and the call creates an entry. Region names. |
| `GET /api/brain/history/{user_id}` | real | unchanged | |
| `POST /api/coach/reflection` | **partial/fake** | unchanged | Template text that names regions ("The dlPFC node demonstrated measurable growth"), "neural fatigue", "neuroplastic progression". Its `collaboration_score` is an invented heuristic (70 +15 +10 +5). |

**`/v1/dashboard/profile`, before (fake):**
- Every user got prior T=50 values.
- `variances` were never updated (the store saved means only), so sigma was always clamped to 18.
- `attention_networks` copied the dlPFC value.
- It returned a hard-coded `collaboration` block (82.5).
- `lastAssessedAt` was always "now" and `sampleSize = session_count*4`.
- It returned `plasticity_bottleneck` with region names.

**`/v1/dashboard/profile`, after (partial):**
- With no evaluated sessions it returns `{"status": "not_enough_data", "estimates": []}`.
- Otherwise it lists only the dimensions that some session observed, meaning the Kalman posterior variance is below the prior of 16.
- Fields per estimate: `dimensionId` (`working_memory`, `inhibition_control`, `cognitive_flexibility`, `episodic_pattern_separation`, `divided_perceptual_speed`), `backendDimensionKey`, and `code`.
- `sampleSize` is the number of sessions that observed the dimension. `lastAssessedAt` is that session's timestamp. `focus_dimension_id` replaces the bottleneck field.
- Unchanged psychometric maths: Kalman means, `(t-20)*1.666`, `sigma = clamp(var*2, 4, 18)` and the confidence formula.
- The region→dimension map exists only in `NODE_DIMENSIONS` inside `v1_interop.py`.
- Still partial because:
  - **(a)** only `/api/telemetry/ingest` feeds the store, not `/v1/telemetry/event`, so a real frontend user always gets `not_enough_data`;
  - **(b)** the covariance is not carried between sessions. The store does not persist it, so each Kalman step restarts from the prior;
  - **(c)** the `*1.666` and `var*2` transforms are ad hoc.

**`/v1/tasks/next`, before (fake/broken):**
- `params.target_bottleneck` held a region name.
- An ACC/Hippocampus bottleneck produced `schema_type` `stroop`/`mst` with n-back params, which is an invalid payload.
- `surface_seed` was always 42.

**The /api routers:** no product screen calls them; they served the dropped cockpit. Recommendation: unmount them, or put them behind an env flag, before any public deploy, and in any case once the psychometric engine is wired to `/v1` telemetry.

### His generator and renderer vs. our dynamic_cache (BE-03)

- **`exercise_generator.py`**: 2 families producing his own `TaskConfigPayload`, which carries a `target_node` region and IRT `b`:
  - an RFT relational/transitive-inference task (networkx);
  - an interference n-back with N±1 lures.

  BE-03 (`dc4e078`, `dynamic_cache/generators`) covers all 8 schema types, including `n_back` and `relational`. Its output is deterministic per `(schema_type, theta, seed)`, validated against a JSON Schema that mirrors `types.ts`, and re-checked by independent solvers. BE-03 overlaps both of his families and is the only one that emits what the frontend renders.

  **Recommendation:** use BE-03 for `/v1/tasks/next` (BE-04). From his file, keep only `apply_85_percent_rule` (port the idea to BE-04's theta update) and his lure ideas if BE-03's n-back lacks them. Retire `exercise_generator.py` with `/api/session/*`.
- **`ux_sandbox_renderer.py`**: builds a self-contained iframe HTML runtime (inline JS task loop, Google Fonts, CSP `connect-src *`). Our frontend renders all 8 tasks natively in React with the tracker, so this duplicates the UI and bypasses the tracker, the copy lint and the token lint.

  **Recommendation:** retire it with the `/api` routes. Do not serve it to product screens.
- **Keep:** `psychometric_engine.py` (EZ-DDM, 3PL-IRT MLE, SSRT, d′, LDI, RCI, with recovery tests) and the Kalman filter in `digital_brain_updater.py`. They are the real value in his backend: the profile should be computed by running them over our JSONL telemetry (follow-up).

Not deleted, per the ticket.

## 4. Tests

I wrote the tests first and watched all 20 new ones fail. They are in `backend/tests/test_honest_endpoints.py`:
- both 501s;
- delete: counts, idempotence, other users untouched, unsafe ids rejected without touching files, the in-memory store cleared;
- profile: `not_enough_data`, dimension ids only, no region names or "bottleneck", an unobserved dimension omitted;
- `/v1/tasks/next` has no region names;
- coach chat goes through ai_coach, and a failure gives 503;
- health has no region or design-system fields;
- CORS: the default origin, origins from env, and never wildcard with credentials.

`test_app.py` adds a check that the module routes shadow `v1_interop` and that `/v1/telemetry/event` is the strict ingest.

His tests were adapted only where the old behaviour was fake:
- the `design_system` assertion;
- his loose telemetry event (it now fails the strict model; our ported suite covers ingest);
- profile `len==6` and region asserts;
- `200` → `501` for collaboration-score and clustering.

Result from the repo root with one command (worktree `.venv`, created from root `requirements.txt`, Python 3.13.14):

```
.venv/Scripts/python -m pytest -q
158 passed, 12 warnings in 0.96s
```

The 12 warnings are `datetime.utcnow()` deprecations in his code.

Not verified: the Docker image. The daemon was not running (`dockerDesktopLinuxEngine` pipe missing), so `docker build -f backend/Dockerfile .` never ran.

## 5. Follow-ups to port BE-02/03/05/08 into backend/app

**BE-02 privacy** (`1e1f107`, `b69da47`). Expect modify/delete conflicts on `assessment_engine/api/routes/{telemetry,privacy}.py` and on `tests/`.
1. Move `assessment_engine/api/telemetry_store.py` to `backend/app/telemetry_store.py`. Change `from telemetry_store import …` to `from app.telemetry_store import …` in privacy, retention and the tests. Its `REPO_ROOT`/`telemetry_dir()` depth changes: `backend/app/` → `parents[2]`.
2. Replace `backend/app/api/routes/v1_privacy.py` with BE-02's `privacy.py` (delete + `GET /v1/user/export`, 503 on lock timeout, 413 over the export ceiling). Keep clearing the in-memory agent store on delete: call `memory_store.clear_user_data(user_id)` and keep `deleted_evaluations` in the response. Otherwise the `/api` evaluations survive a delete.
3. Apply BE-02's `telemetry.py` changes (sync handler, `telemetry_lock()`) to `backend/app/api/routes/v1_telemetry.py`. `ID_PATTERN` is already named there.
4. Move `retention.py` to `backend/app/retention.py`. Its run instruction becomes `python -m app.retention --days 30` from `backend/` (or the root with `PYTHONPATH=backend`). Update its docstring and `assessment_engine/README.md`.
5. Move `test_privacy.py` and `test_retention.py` to `backend/tests/`. `from main import app` becomes the `client` fixture or `from app.main import app`. The subprocess check `import telemetry_store, retention` becomes `import app.telemetry_store, app.retention`, with `backend` on the path.
6. `backend/tests/test_honest_endpoints.py`'s delete tests assert the three-key response. Adjust them if BE-02's contract wins.

**BE-03 generators** (`dc4e078`). No path conflict: everything is under `dynamic_cache/`.
1. Merge as is. Its `requirements.txt` additions (e.g. `fastjsonschema`) are already included by the root `requirements.txt`.
2. Fix the stale comment in `dynamic_cache/api.py` ("Mounted by assessment_engine/api/main.py" → `backend/app/main.py`). I did not touch it: it is outside BE-00's scope.
3. BE-04: add `GET /v1/tasks/next` to `dynamic_cache/api.py` using `generate()`/`generate_block()` (it shadows the stand-in automatically). Then delete `get_next_task` from `v1_interop.py` and `test_v1_tasks_next`/`test_next_task_has_no_region_names` (or move them to dynamic_cache's tests).

**BE-05 ai_coach safety** (`e06db62`, `520720f`, `bd4d74e`).
1. Merge as is (it only touches `ai_coach/`).
2. Then re-run `backend/tests/test_honest_endpoints.py::test_coach_chat_*` and `test_v1_interop.py::test_v1_coach_chat`. `/v1/coach/chat` calls `AICoachAgent().handle_chat(ChatRequest(user_id=…, message=…))` and reads `reply_text`, `xai_explanation`, `suggested_actions`, `safety_metadata` and `timestamp`. If BE-05 renamed any of these, or changed the crisis-gate return shape, update the relay.
3. Check that the offline coach does not state a "Collaboration Index … /100" computed from the default cluster 4, which is a made-up number.
4. Fix the stale comment in `ai_coach/api.py`.
5. BE-06 then moves `/v1/coach/chat` and `/v1/coach/collaboration-score` into `ai_coach/api.py` and deletes them from `v1_interop.py`. Collaboration-score stays 501 until chat history is stored per anonymous id.

**BE-08 synthetic data** (`dae9cbf`, `eff4870`).
1. `data/synthetic/generate.py:52` does `from assessment_engine.api.routes.telemetry import TelemetryEvent`, which no longer exists here.
   - Change it to `from app.api.routes.v1_telemetry import TelemetryEvent`, and put `<repo>/backend` on `sys.path` when the script runs standalone. Root pytest already has `backend` on `pythonpath`.
   - Also update its docstring path (line 5).
2. Its `tests/test_synthetic_generate.py` runs in the root suite unchanged once that import is fixed.

**Other follow-ups (not in a ticket yet):**
1. Frontend comments still name the old path (read-only for me):
   - `frontend/src/features/assessment/telemetry/types.ts` lines 3 and 88;
   - `frontend/src/types/index.ts` line 1;
   - `assessment_engine/client/src/telemetry/types.ts` line 1 (frozen).
2. Frontend contract gaps:
   - `apiClient.getDashboardBundle` calls `/v1/dashboard/profile` without `user_id`;
   - it falls back to `SAMPLE_COLLABORATION_SCORE`/mocks when fields are missing or on 501, which shows invented data as real;
   - its `DimensionEstimate` shape (`scorePct`, `ciLowerPct`…) does not match the profile payload (`mean`, `ciLower`…). That last one was true before BE-00 too.
3. Wire the real pipeline: run `/v1/telemetry/event` JSONL through `psychometric_engine` and the Kalman filter so the profile reflects product sessions. Persist the state (with covariance) instead of the in-memory singleton.
4. Unmount or flag the `/api` routers (§3). They return region names and invented reflection text.
5. `v1_auth.py` is an empty placeholder. Given R13 (no accounts), BE-14 (Google ID tokens) should be cancelled or re-scoped.
6. Root `README.md` still lists the original blueprint paths (`src/api/routes/telemetry.py`, `src/api/routes/privacy.py`). They are plans, not run instructions, so I left them.
7. Replace `datetime.utcnow()` in his code.
