# BE-PORT report: the reviewed backend tickets in the one server (backend/app)

Branch `worktree-agent-aa7f412496ab112ba`, reset to `2a20ae1` (BE-00's reviewed tip), then:

| Commit | What |
|---|---|
| `d97d0d6` | merge BE-02 privacy (`b69da47`) plus the port into `backend/app/privacy/` |
| `c6980b7` | merge BE-03 generators (`4b72553`) plus its docstring minors |
| `15a5266` | merge BE-08 synthetic (`eff4870`) plus the import fix |
| `d83c7ce` | merge BE-05 ai_coach: the tip of `worktree-agent-a88d87654114b12c1`, **`ce37139`**. That is `e30f6b1` plus the controller fix "I'll / I will / I might + a method harm hits again". |
| `360772a` | BE-00 review minors: compose volume, the profile test setup, the ai_coach mount comment |

All four are real `git merge --no-ff` commits, so each ticket's history is kept. `frontend/` is unchanged (`git diff 2a20ae1 HEAD -- frontend` is empty). No commit has AI attribution.

## 1. Conflicts and how each was resolved

**BE-02 (`b69da47`).** Git detected the `assessment_engine/api → backend` directory rename.

| Path | Conflict | Resolution |
|---|---|---|
| `assessment_engine/api/routes/privacy.py` | modify/delete | Deleted. Its delete and export are now `backend/app/api/routes/v1_privacy.py`, a thin wrapper. |
| `backend/app/api/routes/v1_telemetry.py` | content | Kept BE-00's strict `TelemetryEvent` and BE-02's sync handler with the 503. The append moved into the store (`append_events()`). The local `telemetry_dir()`/`REPO_ROOT` are gone. |
| `assessment_engine/api/{telemetry_store,retention}.py` | file location (Git suggested `backend/*.py`) | Moved to `backend/app/privacy/telemetry_store.py` and `backend/app/privacy/retention.py`. |
| `assessment_engine/api/tests/test_{privacy,retention}.py` | file location | Moved to `backend/tests/`, with imports adapted and new tests added (§3). |

The leftover empty `assessment_engine/api/routes/` directory was removed.

**BE-03, BE-08, BE-05: no conflicts.** Each merged cleanly. BE-03's and BE-08's `test_app.py` hunk (dropping `import main`) and the `.scratch` issue line were already in the base.

## 2. What moved where, and what changed

| From | To |
|---|---|
| `assessment_engine/api/telemetry_store.py` | `backend/app/privacy/telemetry_store.py`. `REPO_ROOT` is `parents[3]`. It keeps `delete_user`, `export_user`, `telemetry_lock`, `telemetry_dir`, `check_user_id`, `ID_PATTERN`, `LOCK_TIMEOUT_S`, `EXPORT_MAX_BYTES`, `LockTimeout` and `ExportTooLarge`, and adds `user_key()` and `append_events()`. It has no FastAPI or pydantic, and a test checks that in a subprocess. |
| `assessment_engine/api/retention.py` | `backend/app/privacy/retention.py`. `purge_expired` and the CLI are unchanged; it now imports the store relatively. |
| `assessment_engine/api/routes/privacy.py` | `backend/app/api/routes/v1_privacy.py` |
| ingest append loop in `routes/telemetry.py` | `append_events(events, directory=None, received_at=None)` in the store. It checks every id before writing anything, stamps `received_at`, takes the shared lock and raises `LockTimeout`. `v1_telemetry.ingest` is now: validate, call it, map `LockTimeout` to 503. |

**Routes.**
- `DELETE /v1/user/telemetry` returns honest `{deleted_events, deleted_files}`.
- `GET /v1/user/export` returns the raw JSONL as an `application/x-ndjson` attachment: 404 when nothing is stored, 413 above 50 MB.
- Both routes, and ingest, answer **503 with `Retry-After: 1`** when the lock is busy for more than 10 s.

**Lowercase ids, in one place.**
- `telemetry_store.user_key()` checks the id, then lowercases it. `append_events`, `delete_user` and `export_user` all go through it.
- So `U1` and `u1` write, export and delete the same `u1.jsonl` on every filesystem. The stored row's `user_id` is lowercased too.
- `delete_user` matches file owners case-insensitively, by the name part before the first dot. A file named under another case before this change (possible on Linux) is still found and counted.
- The pydantic `ID_PATTERN` still accepts upper case on the way in.

**Where `ID_PATTERN` lives.** It now comes from the store. `v1_telemetry` still exposes it (it uses it). `v1_interop` imports it from the store.

**Retention CLI.** Run it from the repo root:

```
python -m backend.app.privacy.retention --days 30
```

- In the container (WORKDIR `/srv` is the repo layout): `docker compose exec backend python -m backend.app.privacy.retention --days 30`.
- This works because of the relative import: the same file imports as `app.privacy.retention` in the server and tests, and as `backend.app.privacy.retention` from the root.
- Documented in `scripts/README.md`, `AGENTS.md` (Backend section), `assessment_engine/HANDOVER.md` (Member 4) and `backend/.env.example`.
- I also replaced the invented contract in `docs/ui/pages/13-privacy.md` §9 (`certificate_id`, `purged_records`) with the real one.

**BE-08.**
- `data/synthetic/generate.py` now imports `from app.api.routes.v1_telemetry import TelemetryEvent`. Two lines before that import put `<repo>/backend` on `sys.path`, so `python -m data.synthetic.generate` still runs from the root; `test_cli_writes_the_same_files` covers it. The docstring path is updated.
- `test_lines_survive_the_real_ingest_route` imports `app.main`.
- Synthetic ids (`syn-s{seed}-u{n}`) are already lowercase, so ingest lowercasing changes nothing for them.

**BE-03.**
- `dynamic_cache/api.py` names `backend/app/main.py` as its mount.
- `/v1/tasks/next` is still the 501 stand-in (BE-04).

## 3. Review minors

- **Compose: I chose a named volume** (`telemetry:/data/telemetry`, with a top-level `volumes: telemetry:`).
  - Docker seeds a new named volume from the image's `/data/telemetry`, which the image's uid 10001 owns, so writes work on Linux with no host chown.
  - Trade-off: the JSONL is no longer in `./data/raw/telemetry` on the host. Read it with `GET /v1/user/export` or `docker compose cp backend:/data/telemetry ./out`. The compose comment and `AGENTS.md` say so.
  - `docker compose config --volumes` validates. The image was **not built and not run**; I did not check whether the Docker daemon was running.
- **Profile test.** `test_profile_never_returns_numbers_today` now asserts its setup POST returns 202.
- **BE-03 docstrings.**
  - "~15 ms" now reads "about 4 ms to build, about 7 ms with validation (median, dev laptop, CPython 3.13)". I measured that here: MST at 0/0.5/1 gave a 6.7–6.8 ms validated median, and 3.8 ms with `validate=False`. MST stays the slowest type; mental rotation is about 5–6 ms.
  - MAX_TRIALS is per length option, not per block, in both `__init__.py` and `_common.py`. Checked: an MST block with repeats=lures=foils=500 is accepted, giving 1500 test trials.
  - These edits went into the merge commits (`c6980b7`, `d97d0d6`), not separate commits.
- **The `ai_coach/api.py` comment** names `backend/app/main.py` and the R14 gate.

## 4. Tests

- **Privacy:** BE-02's tests are carried over (fixture `client`, imports from `app.privacy`).
- **Case:** BE-02's two filesystem-dependent case tests are replaced by deterministic ones:
  - `test_u1_and_U1_share_one_lowercase_file` lists names, so it holds on case-sensitive and case-insensitive disks alike;
  - `test_delete_and_export_ignore_the_case_of_the_id` (U1 and u1);
  - `test_delete_finds_a_file_written_under_another_case`;
  - `test_user_key_is_the_one_place_ids_are_lowercased`.
- **New store tests:** `test_append_events_writes_nothing_if_any_id_is_bad` and `test_append_events_stamps_received_at`.
- **Retention:**
  - The CLI and import checks now run from the repo root as `backend.app.privacy.*`.
  - New: `test_cli_runs_from_the_repo_root`.
  - The no-FastAPI check also asserts that pydantic is not loaded.
  - The two CLI tests no longer use the fixed `NOW` date; they date against the real clock. They would have started failing after 2026-11-30.
- `test_telemetry_event.py` imports `telemetry_dir` from the store.

One command from the repo root (a worktree `.venv` from the root `requirements.txt`, Python 3.13.14):

```
.venv/Scripts/python -m pytest -q
858 passed, 1 xfailed in 33.17s
.venv/Scripts/python -m pytest -q -W error
858 passed, 1 xfailed in 54.78s
.venv/Scripts/python -m pytest -q backend/tests
156 passed in 4.90s
```

- There are 0 warnings; `-W error` passes.
- The one xfail is BE-05's intentional strict xfail, `TestCrisisHeldOut::test_held_out_recall_meets_the_target`. Keyword-gate recall on unseen wording is below the 85% target, which is the R14 reason the coach stays 501.
- The venv at `assessment_engine/api/.venv` lacks numpy and fastjsonschema, so I built a fresh one in the worktree. It is gitignored.

## 5. curl transcript

Server: `TELEMETRY_DIR=<scratch>/telemetry .venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8010`. The `date` and `server` headers are trimmed.

```
$ curl http://127.0.0.1:8010/
HTTP/1.1 200 OK
{"status":"OPERATIONAL","version":"1.4.0"}

$ curl -X POST http://127.0.0.1:8010/v1/telemetry/event -H content-type: application/json -d [{"user_id":"Demo1",...,"trial_index":0,...},{"user_id":"demo1",...,"trial_index":1,...}]
HTTP/1.1 202 Accepted
{"accepted":2}

$ ls -A $TELEMETRY_DIR          (the uuid files were already in the scratch dir; not from this run)
.lock
...
demo1.jsonl

$ curl http://127.0.0.1:8010/v1/user/export?user_id=DEMO1
HTTP/1.1 200 OK
content-disposition: attachment; filename="demo1-telemetry.jsonl"
content-length: 854
content-type: application/x-ndjson
{"user_id": "demo1", "session_id": "s1", "task_id": "t1", "trial_index": 0, ... "received_at": "2026-10-31T21:48:35.412255+00:00"}
{"user_id": "demo1", "session_id": "s1", "task_id": "t1", "trial_index": 1, ... "received_at": "2026-10-31T21:48:35.412255+00:00"}

$ curl -X DELETE http://127.0.0.1:8010/v1/user/telemetry?user_id=demo1
HTTP/1.1 200 OK
{"deleted_events":2,"deleted_files":1}

$ curl -X DELETE http://127.0.0.1:8010/v1/user/telemetry?user_id=demo1
HTTP/1.1 200 OK
{"deleted_events":0,"deleted_files":0}

$ curl http://127.0.0.1:8010/v1/user/export?user_id=demo1
HTTP/1.1 404 Not Found
{"detail":"no telemetry stored for this id"}

$ curl http://127.0.0.1:8010/v1/tasks/next?user_id=demo1
HTTP/1.1 501 Not Implemented
{"detail":"task service not available yet"}

$ curl http://127.0.0.1:8010/v1/dashboard/profile?user_id=demo1
HTTP/1.1 200 OK
{"user_id":"demo1","status":"not_enough_data","estimates":[],"snapshots":[]}

$ curl -X POST http://127.0.0.1:8010/v1/coach/chat -H content-type: application/json -d {"user_id":"demo1","user_prompt":"hi"}
HTTP/1.1 501 Not Implemented
{"detail":"coach not available yet"}

$ curl http://127.0.0.1:8010/v1/user/export?user_id=a.b
HTTP/1.1 422 Unprocessable Content
{"detail":[{"type":"string_pattern_mismatch","loc":["query","user_id"],...}]}

$ TELEMETRY_DIR=<scratch>/ret .venv/Scripts/python -m backend.app.privacy.retention --days 30
{"files": 0, "kept": 0, "dropped": 0, "undated": 0, "removed_files": 0}
exit 0
```

The live check did not exercise the 503 or 413 paths. The tests do (`test_busy_lock_is_503` for all three routes, and `test_export_over_the_ceiling_is_413`).

## 6. Remaining backend gaps

- **BE-04 task service.**
  - Add `GET /v1/tasks/next` in `dynamic_cache/api.py`, with `user_id: Query(pattern=ID_PATTERN)` imported from `app.privacy.telemetry_store`. Generation is CPU-bound, so use a plain `def` route.
  - Add the `INTENTIONAL_OVERRIDES` entry in `backend/tests/test_app.py`.
  - Delete the stand-in and its 501 tests.
  - Port `apply_85_percent_rule` into the theta update.
- **BE-06 coach API.**
  - `/v1/coach/chat` and `/v1/coach/collaboration-score` in `ai_coach/api.py`, only with a backup (LLM-based) crisis classifier (R14). The held-out-recall xfail must turn into a pass first.
  - No default-cluster persona claims.
  - Add the override entries; delete the stand-ins.
- **BE-07 features.** Feature extraction from the JSONL. Not started.
- **BE-09/10/11.** These wait for the teammate's clustering and brain-twin work. BE-11 must:
  - compute the profile from JSONL through `psychometric_engine` and the Kalman filter, and persist the state;
  - never publish the dimensions marked `ponytail: not an estimate`;
  - handle partial weights through R;
  - add the profile and clustering overrides.

  Until then, the profile stays `not_enough_data` and clustering stays 501.
- **Smaller open items.**
  - The Docker image is still unbuilt.
  - Retention is not scheduled anywhere; it is documented as a daily cron or Task Scheduler job.
  - These frontend items are not mine to change:
    - The Privacy page purge is still local only, and does not call `DELETE /v1/user/telemetry`.
    - `apiClient` still calls the profile without `user_id`.
    - The `types.ts` comments still name `assessment_engine/api/routes/telemetry.py`.
  - The profile route echoes `user_id` as given, not lowercased. It reads no data today, so this is harmless; BE-11 should go through `user_key()`.
