# BE-07 report: session features + golden vectors

## Branch and commits
- Branch `worktree-agent-a0cfe3da667340075`, reset to `ae67522` (BE-PORT tip).
- `80bd80e` feat(brain_twin): session features, read_events with dedupe, golden vectors.
- `ede346b` docs(sdd): BE-07 report.
- The review follow-up commit (below) comes after these. Its sha is given in the reply.

## Files (all inside BE-07's Owns column)
- `brain_twin_jepa/telemetry_io.py`:
  - `read_events(user_id, directory=None, max_bytes=None)`: checks the id with `user_key`, reads `{key}.jsonl` under `telemetry_lock` with a size bound, then dedupes.
  - A missing user returns `[]`. A bad id raises `ValueError`. A file over the cap raises `EventsTooLarge`. A busy lock raises `LockTimeout`. A torn line is skipped.
  - It is sync and blocking: call it from a sync route or a threadpool, never inside `async def`. This is written in the docstring.
  - Also `dedupe`, `dedupe_key`, `group_sessions`, `read_sessions`, `Session`, `client_time` and `READ_MAX_BYTES` (equal to `EXPORT_MAX_BYTES`).
- `brain_twin_jepa/features.py`: the port of `taskScores.ts` and `pillars.ts`.
  - Functions: `task_scores`, `pillar_scores`, `unified_score`, `session_features`, `schema_of`, `on_rule_stream`, `probit`, `d_prime`, `ldi`.
  - Every constant is ported, including `NBACK_RULE_STREAM` and `PILLAR_WEIGHTS` (in TS order).
- `scripts/golden/make_golden.mjs` and `data/fixtures/golden_sessions.json`: 22 cases.
- Tests: `brain_twin_jepa/tests/test_features.py` and `test_telemetry_io.py` (41 tests).
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
- **Rounding:** neither TS file rounds anything; display rounding lives in the UI.
- **JS semantics kept:**
  - `===` on `trial_meta`, including `on_rule_stream`'s fallback: bool ≠ number, 1 === 1.0, and undefined is distinct from null.
  - A bool is not a number (JS `typeof`).
  - Sums are evaluated left to right in event order, and inputs come out in TS insertion order.
  - The dedupe key compares the way the JS `JSON.stringify` key does. Stream `true` and stream `1` are different, while 1 and 1.0 are the same. A plain Python tuple would have merged `True` with `1`, and the new golden case caught that.

## R16 (rule-stream-only n-back)
- `on_rule_stream` mirrors the merged `taskScores.ts` `onRuleStream`.
  - The wanted stream is `NBACK_RULE_STREAM[rule]` (`telemetry/types.ts`; position → position, symbol → symbol, parity → symbol) when `rule` is a string and an own key of the map.
  - Otherwise the wanted stream is `rule` itself, compared with JS strict equality.
- Signal is a rule-stream target. Noise is every other non-switch rule-stream event, other-stream lures included.
- An off-rule press on a target is a **miss**, not a hit plus a false alarm.
- `ErrorRecovery` reads only the rule-stream event of each n-back trial.

## Golden vectors
- **Source:** generated with `--frontend C:\Users\mazen\OneDrive\Documents\Aura\ai4brain\frontend`, the main checkout at `cad4ad1` (feat/ui-calm-clean, R16 merged).
  - `source` records the LF sha256 of `insights/taskScores.ts` (`de5d88d0…`), `insights/pillars.ts` (`e3de51c4…`) and `assessment/telemetry/types.ts` (`b4e4627d…`). The last is included because `NBACK_RULE_STREAM` is now a runtime import.
  - All three hashes equal the files committed in `cad4ad1`. I checked them against an archive of that commit's `frontend/src`, and `--check` also passes against that archive.
- **22 cases** cover all 8 exercises:
  - `empty`
  - n-back: `nback_r16`, `nback_parity`, `nback_offrule_press_on_target`, `nback_offstream_error_only`, `nback_unknown_rule` (new), `nback_chance_nonresponder`
  - `error_recovery_stroop_chance_nback_counted` (new)
  - Stroop: `stroop`, `stroop_at_chance`, `stroop_all_wrong`
  - `tower`
  - `matrix_only_below_coverage`, `fluid_matrix_relational`
  - `mst`, `ufov_two_tasks`, `rotation_only`
  - `full_session`
  - `duplicates` (191 rows, 159 unique)
  - `fuzz_81`, `fuzz_82`, `fuzz_83`
- **`nback_unknown_rule`** contains:
  - rule `shape` on stream `shape`, which counts
  - numeric rule `1` on stream `1`, which counts
  - rule `true` on stream `1`, which does not count
  - rule `true` on stream `true`, which counts
- **Regenerate** from the repo root: `npx --yes tsx@4.19.2 scripts/golden/make_golden.mjs [--frontend <dir>]`. The default is `./frontend`.
- **`--check`** compares instead of writing:
  - It matches cases **by name**.
  - It also requires the committed **events** to be identical.
  - It reports cases that are missing on either side.
  - It exits 1 on any drift above 1e-6.
  - Verified with a mutated copy, in reversed order with one event changed: only `nback_offrule_press_on_target.events` was flagged, exit 1.
- **Requested check result:** `npx --yes tsx@4.19.2 scripts/golden/make_golden.mjs --frontend C:\Users\mazen\OneDrive\Documents\Aura\ai4brain\frontend --check` printed `golden: 22 cases match`, exit 0.

## Tests
- `pytest -q` from the repo root: **899 passed, 1 xfailed, 0 warnings**. The baseline was 858, so BE-07 adds 41.
- **Golden:** each of the 22 cases is a parametrised test. It matches inputs (score within 1e-6, trials, proxy, key order), pillars (score, uncertainty, coverage, proxies) and the unified score.
- **Duplicates counted once:**
  - The `duplicates` case: raw scoring differs from deduped scoring, and dedupe is idempotent and drops exactly 32 rows.
  - A retried batch through `append_events` reads back once.
  - Two n-back streams of one trial are not duplicates.
  - Stream `true` and stream `1` are not duplicates.
  - The same item in two sessions is not a duplicate.
- **Sessions grouped:** interleaved sessions with mixed offsets come back ordered by start.
- **End to end:** golden events are POSTed to `/v1/telemetry/event`, then `read_sessions` and `session_features` reproduce the golden values.
- **New in the follow-up:**
  - The unknown-rule strict-equality fallback.
  - `ErrorRecovery` leaves out the Stroop task played at chance and still counts the n-back task (2 of 3).
  - `read_events` raises `LockTimeout` while the lock is held, and works again once it is released.
  - `EventsTooLarge` is raised one byte over the cap; a file exactly at the cap is fine.
- **Mutation checks (done by hand, not committed):**
  - `STROOP_CHANCE` set to 0.26 fails 6 tests.
  - Parity mapped to `parity` fails 3 tests.
  - The unknown-rule fallback set to None fails 2 tests.

## Acceptance criteria
| AC | Where |
|---|---|
| `read_events(user_id)` with dedupe on (session_id, item_id, stream) | `telemetry_io.read_events` / `dedupe`; `test_retried_batch_is_read_once`, `test_duplicates_are_counted_once` |
| Python port of taskScores + pillars | `features.py`; `test_golden_case_matches_the_ts[*]` |
| `golden_sessions.json` generated from the TS once | `make_golden.mjs`, run on `cad4ad1`; `source` holds the hashes |
| FE can later assert against the same file | `--check` (by name, events included) plus the documented format |
| Golden match to 1e-6; duplicates once; sessions grouped | the tests above |

## Curl evidence
BE-07 adds no route; BE-11 will expose these features. The ingest-to-features round trip is tested in-process.

## Notes and requests
- No new per-user data is stored, so delete and export are unchanged.
- No new dependencies.
- **Request (frontend):** add a vitest that loads `data/fixtures/golden_sessions.json`, or run the `--check` command in CI.
- **Request (BE-11):**
  - Call `read_sessions(user_id)` from a sync route, or through `run_in_threadpool`, then `session_features(session.events)`.
  - Map `EventsTooLarge` to 413 and `LockTimeout` to 503, as export does.
  - A session is one page load (`session_id`). Score each `task_id` subset separately if per-run scores are needed.
