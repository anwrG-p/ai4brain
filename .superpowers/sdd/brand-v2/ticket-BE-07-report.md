# BE-07 report: session features + golden vectors

## Branch and commits
- Branch `worktree-agent-a0cfe3da667340075`, reset to `ae67522` (BE-PORT tip).
- `80bd80e` feat(brain_twin): BE-07 session features, read_events with dedupe, golden vectors.
- The report is in the commit that follows it.

## Files (all inside BE-07's Owns column)
- `brain_twin_jepa/telemetry_io.py`:
  - `read_events(user_id, directory=None)`: uses `user_key`, then reads `{key}.jsonl` under `telemetry_lock`, then dedupes. A missing user gives `[]`, a bad id raises `ValueError`, and a torn line is skipped.
  - Also `dedupe`, `dedupe_key`, `group_sessions`, `read_sessions`, `Session` and `client_time`.
- `brain_twin_jepa/features.py`: the port of `taskScores.ts` and `pillars.ts`.
  - Functions: `task_scores`, `pillar_scores`, `unified_score`, `session_features`, `schema_of`, `probit`, `d_prime`, `ldi`.
  - Every constant is ported: `D_PRIME_MAX`, `D_PRIME_GATE`, `SWITCH_COST_MAX`, `STROOP_COST_MAX_MS`, `STROOP_CHANCE`, `PLAN_SHARE`, `PLAN_TIME_MAX_MS`, `UFOV_MIN_MS`/`UFOV_MAX_MS`, `PILLAR_WEIGHTS` (in TS order), `MIN_COVERAGE`, `MAX_UNCERTAINTY` and `UNSOURCED_INPUTS`.
- `scripts/golden/make_golden.mjs` and `data/fixtures/golden_sessions.json`: 20 cases, about 440 KB, one event per line.
- Tests: `brain_twin_jepa/tests/test_features.py` and `test_telemetry_io.py` (35 tests).
- `scripts/README.md`: a row for the golden script.

## Port details
- **Gates ported:**
  - d′ is floored at 0 when the raw hit rate is ≤ the raw false-alarm rate.
  - The switch cost is gated by min(1, d′).
  - The Stroop gate is (acc − 0.25)/0.75. `ANT_Conflict` is 0 with `st.length` trials when nothing is correct.
  - Tower perfect means `l_user ≤ l_min`; a missing planning time counts as 30 s.
  - Relational is hop-weighted.
  - `MST_LDI` is clamped.
  - The UFOV threshold is the mean over the events that carry it.
  - `ErrorRecovery` leaves out tasks played at chance.
  - Pillar coverage must reach 0.3, weights are renormalised over the inputs present, and the uncertainty formula is the TS one, capped at 50.
- **Rounding:** neither TS file rounds anything; display rounding lives in the UI. So the port has no rounding rule to copy.
- **JS semantics kept:**
  - `===` on `trial_meta` (`is True` / `is False`).
  - A bool is not a number (JS `typeof`), so `hops: true` falls back to 1.
  - Sums are evaluated left to right in event order, and inputs come out in the TS insertion order.

## R16 (rule-stream-only n-back): implemented now
- `ruleStream` keeps the events where `stream === RULE_STREAM[rule]`, with `{position: position, symbol: symbol, parity: symbol}` (your follow-up). At `8b8c859` the filter was `stream === rule`, which dropped parity trials.
- Signal is a rule-stream target. Noise is every other non-switch rule-stream event, other-stream lures included.
- An off-rule press makes the rule event wrong. On a target that is a **miss** (it only lowers hits), not a hit plus a false alarm. Tested in `test_r16_offrule_press_on_a_target_is_a_miss_not_a_false_alarm` and in the golden case `nback_offrule_press_on_target`.
- `ErrorRecovery` reads only the rule-stream event of each n-back trial. Tested in `test_r16_error_recovery_reads_only_the_rule_stream` and the golden case `nback_offstream_error_only`.
- **Golden provenance:** generated from `8b8c859`'s `frontend/src`, with `taskScores.ts` taken from the parallel R16 agent's worktree (`agent-a3c032f17386db758`, ErrorRecovery change). I patched one line on top: the `RULE_STREAM` filter, which had not landed in that file yet.
  - The LF sha256 of both TS files is in the file's `source` field (`taskScores.ts` `90785277…`, `pillars.ts` `9d288f74…`).
  - Checked against the unpatched `8b8c859` TS, `--check` fails on exactly the R16 cases: `nback_parity`, `nback_offstream_error_only` and `fuzz_81` (which has parity). Every other case matches.
- **For the R16 agent:** once its `taskScores.ts` lands, `npx --yes tsx@4.19.2 scripts/golden/make_golden.mjs --check` against `frontend/` must pass unchanged. If it doesn't, the merged TS differs from the semantics above, and one side needs fixing.

## Dedupe and sessions
- **Key:** `(session_id, trial_meta.item_id, trial_meta.stream)`, first row kept, file order preserved. A row without `item_id` falls back to `task_id:trial_index`, which is how `tracker.ts` builds `item_id`.
- **The frontend has no dedupe key of its own** (checked at `8b8c859`): `taskScores` never dedupes, and `ExerciseFrame`'s `seen` set only counts progress. So the spec's key is the contract. The script applies the same key (`dedupe()` in `make_golden.mjs`) before it runs the TS.
- **Why `stream` is in the key:** n-back logs both streams under one `item_id`. A test checks that the two streams of one trial are not counted as a duplicate.
- **Sessions:** a session is one `session_id` (the client mints one per page load). Sessions are ordered by their earliest `client_ts`, parsed as a datetime, with a missing offset treated as UTC. Events inside a session keep append order.
  - This is the page-load session, not the frontend's per-run `SessionRecord` (`saveRun`, keyed by `newId()`). Running `task_scores` per `task_id` subset gives per-run scores if BE-11 needs them.

## Golden vectors
- **20 cases** cover all 8 exercises:
  - `empty`
  - n-back: `nback_r16`, `nback_parity`, `nback_offrule_press_on_target`, `nback_offstream_error_only`, `nback_chance_nonresponder`
  - Stroop: `stroop`, `stroop_at_chance` (exactly 1 in 4), `stroop_all_wrong`
  - `tower`
  - `matrix_only_below_coverage` (focus is null at 0.25 coverage), `fluid_matrix_relational`
  - `mst`, `ufov_two_tasks`, `rotation_only`
  - `full_session` (all 8 exercises)
  - `duplicates` (191 rows, 159 unique)
  - `fuzz_81`, `fuzz_82`, `fuzz_83`
- **Shape of each case:** `{name, description, expected: {unique_events, inputs, pillars, unified}, events}`. Top-level fields are `tolerance: 1e-6`, `dedupe_key` and `source`.
- **Regenerate** from the repo root: `npx --yes tsx@4.19.2 scripts/golden/make_golden.mjs [--frontend <dir>]`. The default is `./frontend`.
- **Check without writing:** add `--check`. It exits 1 on any drift above 1e-6, and the frontend can use that later. A missing frontend prints `Usage:` and exits 2. The same instructions are in the script header and in `scripts/README.md`.
- Every golden event validates against the server's `TelemetryEvent` model (tested).

## Tests
- `pytest -q` from the repo root: **893 passed, 1 xfailed, 0 warnings**. The baseline was 858 passed, so BE-07 adds 35.
- **Golden:** each of the 20 cases is a parametrised test. It matches inputs (score within 1e-6, trials, proxy, key order), pillars (score, uncertainty, coverage, proxies) and the unified score.
- **Duplicates counted once:**
  - The `duplicates` case: raw scoring differs from deduped scoring, and dedupe is idempotent and drops exactly 32 rows.
  - A retried batch through `append_events` reads back once.
  - Two n-back streams of one trial are not duplicates.
  - The same item in two sessions is not a duplicate.
- **Sessions grouped:** interleaved sessions with mixed offsets come back ordered by start, with the right `task_ids`, start and end times.
- **End to end:** the golden `duplicates` events are POSTed to `/v1/telemetry/event` through `TestClient`, then `read_sessions` and `session_features` reproduce the golden values.
- **Mutation check (done by hand, not committed):**
  - Setting `STROOP_CHANCE` to 0.26 fails 6 tests.
  - Setting `RULE_STREAM` parity to `parity` fails 3 tests.

## Acceptance criteria
| AC | Where |
|---|---|
| `read_events(user_id)` with dedupe on (session_id, item_id, stream) | `telemetry_io.read_events` / `dedupe`; `test_retried_batch_is_read_once`, `test_duplicates_are_counted_once` |
| Python port of taskScores + pillars | `features.py`; `test_golden_case_matches_the_ts[*]` |
| `golden_sessions.json` generated from the TS once | `scripts/golden/make_golden.mjs`; the file records the TS hashes |
| FE can later assert against the same file | `--check` mode, plus the documented format |
| Golden match to 1e-6; duplicates once; sessions grouped | the tests above |

## Curl evidence
BE-07 adds no route; BE-11 will expose these features. The ingest-to-features round trip is tested in-process (`test_ingest_to_features_round_trip_matches_golden`).

## Notes and requests
- No new per-user data is stored: the module only reads the existing JSONL, so delete and export are unchanged.
- No new dependencies. The golden script uses `npx tsx@4.19.2`, which needs network on the first run. It needs no `frontend/node_modules`, because the two TS files only import types plus `config/dimensions.ts`.
- **Request (R16 agent / controller):** after R16 merges into `wave-integration`, run the `--check` command against `frontend/` and add a vitest that loads `data/fixtures/golden_sessions.json`.
- **Request (BE-11):** use `read_sessions(user_id)` and then `session_features(session.events)`. The output dicts mirror the TS `TaskScores` and `PillarScore` shapes.
