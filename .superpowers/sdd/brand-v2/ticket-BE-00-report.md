# BE-00 report: Hamza's backend/ becomes the one API server

Branch `worktree-agent-a879d7a236faa963b`, base `6033acd` (the B1 tip).
- `cd69a95`: merge commit. Its parents are `6033acd` and `hamza/feat/agent-integration-doodle-ui` (`1085ec8`).
- `eccd731`: first report.
- Then the review fix round (§6).

`frontend/`, `ai_coach/`, `dynamic_cache/` and `data/` are byte-identical to `6033acd`.

**Hamza's deleted code stays recoverable from commit `1085ec8`:** `dashboard_ui/`, the `/api` routes, the orchestrator, the in-memory store, `ux_sandbox_renderer.py` and the procedural generators. For example: `git show 1085ec8:backend/app/tools/ux_sandbox_renderer.py`.

**Future syncs from his branch must bring in `backend/` only**, never a wholesale merge. Use a path checkout (`git checkout hamza/<branch> -- backend/<path>`) or cherry-pick backend-only commits. A merge would bring `dashboard_ui/`, his `frontend/` and the deleted files back.

## 1. Merge decisions

| Path (from 1085ec8) | Decision | Why |
|---|---|---|
| `backend/` | **Kept as a library plus the one app**. Pruned in the fix round (§6). | It is the main server (user decision). |
| `dashboard_ui/` | **Dropped** | Stays on his branch (user decision). |
| `frontend/` changes (WelcomePage, AssessmentHubPage, apiClient, AgentTaskSandbox, Dockerfile) | **Dropped**; ours kept | Our frontend was rewritten after 799d2d2. |
| `AGENTS.md` (add/add) | **Ours**, plus a `## Backend` section | His file was Doodle frontend rules, already in `docs/design/`, and it pointed at `dashboard_ui`. |
| `docker-compose.yml` | **Kept, reduced** to the `backend` service | Removed: the `dashboard_ui` service; Postgres and Redis (never connected, the store was in memory); unused DB/LLM env vars. Build context is the repo root. Telemetry is mounted from `./data/raw/telemetry`. |
| `backend/Dockerfile` | **Kept, rewritten** | Builds from the repo root on Python 3.13 and runs as the non-root `app` user (uid 10001), who owns only `/data/telemetry`. `backend/Dockerfile.dockerignore` sends only what the build copies. **Not built: the Docker daemon was not running, in either round.** |
| `backend/.env.example` | **Kept, rewritten** | Lists only `CORS_ALLOW_ORIGINS` and `TELEMETRY_DIR`. |
| `backend/requirements.txt` | **Kept, pinned, trimmed** | Removed unused packages: sqlalchemy, dotenv, pydantic-settings, pytest-asyncio, and networkx (after the fix round). Replaces `assessment_engine/api/requirements.txt`. |
| `scripts/run_dev.ps1` | **Kept, rewritten** | The original had machine-specific venv paths (TD-02) and a `dashboard_ui` fallback. |
| `scripts/run_tests.ps1`, `scripts/deploy_docker.ps1`, root `package.json` | **Dropped** | One root `pytest -q` replaces the test script. The other two targeted the cockpit or `dashboard_ui`. |
| `.agents/rules/frontend_guidelines.md`, `docs/frontend_guidelines.md` | **Dropped** | Duplicated the design docs, pointed at `dashboard_ui` and linked to `file:///C:/Users/hamza/...`. |
| `docs/ai4brain_architecture.drawio` | **Dropped** | Describes the cockpit, a webcam tile (contradicts the no-biometrics rule) and "5-Region Brain Kalman Filter". |

## 2. What moved where

| From | To |
|---|---|
| `assessment_engine/api/routes/telemetry.py` | `backend/app/api/routes/v1_telemetry.py` (git rename). The contract is unchanged: strict `TelemetryEvent`, `ID_PATTERN` (named as in BE-02), batch ≤ 100, `202 {"accepted": n}`, `{TELEMETRY_DIR}/{user_id}.jsonl` + `received_at`. The default dir is still `<repo>/data/raw/telemetry`. |
| `assessment_engine/api/routes/privacy.py` | `backend/app/api/routes/v1_privacy.py`: the honest delete. |
| `assessment_engine/api/routes/auth.py` | `backend/app/api/routes/v1_auth.py`: empty, because users are anonymous (R13). |
| `assessment_engine/api/main.py` | `backend/app/main.py`. Same mounting rule and custom 422 handler. The repo root goes on `sys.path`. |
| `assessment_engine/api/tests/*` | `backend/tests/{conftest,test_app,test_telemetry_event}.py` |
| `assessment_engine/api/{pytest.ini,requirements.txt,routes/__init__.py}` | Deleted. `assessment_engine/api/` is gone; `assessment_engine/client/` is untouched. |

`backend/app/main.py` mounts these routers, in this order:
1. `v1_telemetry`, `v1_privacy`, `v1_auth`, `dynamic_cache.api`, `ai_coach.api`, `brain_twin_jepa.api`
2. `v1_interop`

Nothing else is mounted; `/api/*` is gone (§6). Two tests guard the order:
- `test_module_routes_win_over_the_interop_router`: a module's `/v1` route shadows the stand-in.
- `test_no_route_shadows_a_v1_interop_stand_in_by_accident`: the reverse. The first matching route for each stand-in must be `v1_interop`, or an entry in `INTENTIONAL_OVERRIDES` (empty today; BE-04/06/11 add theirs).

Run from the repo root: `uvicorn app.main:app --app-dir backend --reload`. CORS origins come from `CORS_ALLOW_ORIGINS` (comma-separated, default `http://localhost:5173`), with `allow_credentials=False`.

Updated:
- Root `requirements.txt` and `pytest.ini` (`pythonpath = . backend`).
- `tests/test_workspace.py`, CI job names and `scripts/README.md`.
- `assessment_engine/{README,GUIDE,HANDOVER}.md`, `docs/ui/contracts.md` and `docs/ui/pages/04-task-runner.md`.
- The `brain_twin_jepa/api.py` comment.

## 3. Endpoint audit (final state)

"Before" is 1085ec8.

| Route | Before | Now |
|---|---|---|
| `GET /` | partial: region names, design-system field, engine list | **real**: `{status, version}` only |
| `POST /v1/telemetry/event` | **fake**: accepted any dict, stored nothing | **real** (ours) |
| `DELETE /v1/user/telemetry` | **fake**: cleared RAM only and said "purged" | **real**: deletes `{user_id}.jsonl` and returns `{deleted_events, deleted_files}`, the BE-02 contract. `user_id` is required and must match `ID_PATTERN`. Idempotent. |
| `GET /v1/tasks/next` | **fake/broken**: region name in params; Stroop/MST with n-back params; seed always 42 | **501** `task service not available yet`. My first round served a hard-coded 2-back block and called it "valid". That was wrong: its params do not match the frontend `NBackParams`, so it could not render. |
| `GET /v1/dashboard/profile` | **fake**: priors shown as scores, a hard-coded collaboration block, region names | **honest empty**: always `200 {status: "not_enough_data", estimates: []}` until the JSONL → engine pipeline exists (BE-11). My first round published Kalman estimates; the review showed those are fabricated (see the fixes below). |
| `POST /v1/coach/chat` | **fake**: called a method that does not exist, so it always returned canned text naming a region | **501** `coach not available yet` (ruling, R14). My first round called this a "real relay" to `handle_chat`. That was wrong to ship: there is no backup crisis classifier, and the default-cluster persona claims are fabricated. |
| `GET /v1/coach/collaboration-score` | **fake**: always 82.5 | **501** `collaboration score not available yet`. The scorer needs chat history and a cluster; neither is stored. |
| `POST /v1/clustering/evaluate` | **fake**: "Focused Builder" | **501** `clustering not available yet` |
| `/api/session/*`, `/api/telemetry/ingest`, `/api/brain/*`, `/api/coach/reflection` | real compute, but payloads named regions and the coach reflection text was invented | **unmounted and deleted** (ruling) |

The Kalman fixes behind the profile ruling, in `app/tools/digital_brain_updater.py`:
- **The overshoot is fixed.** `H` was `diag(active_mask)`, so a 0.5 weight read a T-score as half the state: a 60 reading moved 50 to about 95 T. `H` is now `diag(mask > 0)`. A `ponytail:` note says partial weights should inflate R instead; they are ignored for now. A test pins it.
- **The derived dimensions are marked** `ponytail: not an estimate`:
  - inhibition = lure score − 1.5;
  - flexibility = a copy of WM when there is no LDI;
  - episodic = reasoning + 1;
  - the generic branch copies one score to all five nodes.

Every `/v1` route requires `user_id` matched against `ID_PATTERN` (query, or body for the POSTs). The `usr_default` default is gone.

## 4. His code: what remains, and the generator overlap

**Kept as a library**, unmounted, with its unit tests:
- `app/tools/psychometric_engine.py`: EZ-DDM, 3PL-IRT MLE, SSRT, d′, LDI, RCI.
- `app/tools/digital_brain_updater.py`: the Kalman filter, with the fixes above.
- `app/tools/exercise_generator.py`: reduced to `apply_85_percent_rule`.
- The models the first two need: `app/models/{brain_state,telemetry,task_schema}.py`, with `task_schema` reduced to `TaskType`.

**Deleted:**
- `/api` route files (`session.py`, `telemetry.py`, `brain.py`, `coach.py`);
- `ux_sandbox_renderer.py`;
- `orchestrator/` (only the `/api` routes and the renderer used it);
- `memory/template_memory_store.py` (nothing writes it once `/api` is gone);
- the RFT and n-back generators, with their tests;
- `test_end_to_end_api.py` and the sandbox-HTML test.

**Overlap with dynamic_cache:**
- BE-03 (`dc4e078`) covers all 8 schema types, including n-back and relational. It is deterministic per `(schema_type, theta, seed)`, validated against a JSON Schema that mirrors `types.ts`, and re-checked by solvers. It replaces his two generators.
- His iframe renderer duplicated our React task screens and bypassed the tracker and the copy and token lints.
- Worth porting into BE-04: the 85% rule.
- Worth reusing in BE-11: the psychometric engine and the Kalman filter, run over the JSONL telemetry.

## 5. Tests

The tests were written first and seen failing:
- the first round's 20 new tests;
- in the fix round, the Kalman overshoot test.

In `backend/tests/test_honest_endpoints.py`:
- the 4 routes return 501 with their exact detail;
- `user_id` is required and pattern-checked on all 6 `/v1` user routes (missing, `../x`, `a.b`, empty, 65 chars → 422);
- honest delete counts, idempotence, other users untouched, unsafe ids rejected without touching files;
- the profile never returns numbers, even with telemetry stored;
- health is `{status, version}` exactly;
- the 6 `/api` routes return 404;
- no payload names a region;
- CORS: the default origin, origins from env, and never wildcard with credentials.

`test_app.py` has the shadow tests in both directions. `test_kalman_rci.py` has the partial-mask test.

Result from the repo root with one command (worktree `.venv` from root `requirements.txt`, Python 3.13.14):

```
.venv/Scripts/python -m pytest -q
187 passed in 1.90s
```

0 warnings: every `datetime.utcnow()` is now `datetime.now(timezone.utc)`.

## 6. Fix round 1 (review "Needs fixes")

1. `/v1/tasks/next` → 501. The report's "valid static block" claim is corrected (§3).
2. The profile is always `not_enough_data`. The Kalman `H` overshoot is fixed; derived dimensions are marked; a test pins that no numbers come out.
3. `/api/*` is unmounted. Its route files, the renderer, the orchestrator, the memory store, the e2e test and the sandbox test are deleted. The engine, the Kalman filter and the 85% rule are kept as a library (§4).
4. `/v1/coach/chat` → 501. The "real relay" claim is corrected (§3).
5. `user_id` is required and must match `ID_PATTERN` on every `/v1` route; no `usr_default`.
6. Health is `{status, version}` only.
7. The reverse-shadow test was added.
8. `utcnow` was replaced; the suite runs with 0 warnings.
9. The Dockerfile runs as non-root `USER app`. The build is still unverified because the Docker daemon is not running.
10. The top of this report says future syncs from his branch bring in `backend/` only.

The delete response lost `deleted_evaluations`: with the in-memory store gone, the JSONL is the only per-user data. That matches BE-02's `{deleted_events, deleted_files}` contract.

## 7. Follow-ups to port BE-02/03/05/08 into backend/app

**BE-02 privacy** (`1e1f107`, `b69da47`). Expect modify/delete conflicts on `assessment_engine/api/routes/{telemetry,privacy}.py` and on `tests/`.
1. Move `assessment_engine/api/telemetry_store.py` to `backend/app/telemetry_store.py`. Imports become `from app.telemetry_store import …`. Its `telemetry_dir()` root depth becomes `parents[2]`.
2. Replace `backend/app/api/routes/v1_privacy.py` with BE-02's `privacy.py` (delete + export, 503 on lock timeout, 413 over the ceiling). The response contract already matches.
3. Apply BE-02's `telemetry.py` changes (sync handler, `telemetry_lock()`) to `v1_telemetry.py`. `ID_PATTERN` is already named there. `v1_interop.py` also imports `ID_PATTERN` from it; keep it re-exported if it moves to `telemetry_store`.
4. Move `retention.py` to `backend/app/retention.py`. Run it with `python -m app.retention --days 30` from `backend/`, or from the root with `PYTHONPATH=backend`. Update the docs that mention it.
5. Move `test_privacy.py` and `test_retention.py` to `backend/tests`. `from main import app` becomes the `client` fixture. The subprocess import check becomes `import app.telemetry_store, app.retention`.

**BE-03 generators** (`dc4e078`). No path conflict.
1. Merge as is.
2. Fix the stale "Mounted by assessment_engine/api/main.py" comment in `dynamic_cache/api.py`.
3. BE-04:
   - Add `GET /v1/tasks/next` to `dynamic_cache/api.py`, with `user_id: Query(pattern=ID_PATTERN)`.
   - Add `("/v1/tasks/next", "GET"): "dynamic_cache.api"` to `INTENTIONAL_OVERRIDES` in `backend/tests/test_app.py`.
   - Delete the stand-in from `v1_interop.py`, and its 501 entries in `test_honest_endpoints.py` and `test_v1_interop.py`.
   - Port `apply_85_percent_rule` into the theta update.

**BE-05 ai_coach safety** (`e06db62`, `520720f`, `bd4d74e`).
1. Merge as is (ai_coach only). Nothing in `backend/app` imports ai_coach any more besides `ai_coach.api`.
2. Fix the stale comment in `ai_coach/api.py`.
3. BE-06 ships `/v1/coach/chat` and `/v1/coach/collaboration-score` in `ai_coach/api.py`, only with the backup crisis classifier (R14). It must not state default-cluster persona claims. Add the override entries and delete the stand-ins.

**BE-08 synthetic data** (`dae9cbf`, `eff4870`).
1. `data/synthetic/generate.py:52` imports `assessment_engine.api.routes.telemetry`, which no longer exists. Change it to `from app.api.routes.v1_telemetry import TelemetryEvent`, with `<repo>/backend` on `sys.path` when run standalone. Root pytest already has it.
2. Update its docstring path (line 5).
3. `tests/test_synthetic_generate.py` then runs unchanged.

**Other follow-ups:**
1. **BE-11:**
   - Compute the profile by running JSONL telemetry through `psychometric_engine` and the Kalman filter, and persist the state with its covariance.
   - Never publish the derived dimensions marked `ponytail: not an estimate`.
   - Handle partial weights through R.
   - Add override entries for profile and clustering.
2. **Frontend** (read-only for me):
   - `types.ts` and `types/index.ts` comments still name `assessment_engine/api/routes/telemetry.py`.
   - `apiClient.getDashboardBundle` calls the profile without `user_id`, which now gets a 422. It also falls back to `SAMPLE_COLLABORATION_SCORE`/mocks on errors or missing fields, which shows invented data as real.
   - `getNextTask`, `postCoachChat` and the others must handle 501.
3. **BE-14** (Google ID tokens) conflicts with R13 (no accounts): cancel or re-scope it. `v1_auth.py` stays empty.
4. **Root `README.md`** still lists the original blueprint paths (`src/api/routes/...`). They are plans, not run instructions, so they were left.
