# Ticket BE-13 report: LLM pool worker

## Review round 1 (this section wins over the rest where they disagree)

- **Merged first.** `ce15688` merges main `feat/ui-calm-clean` (`1ad9e5f`, BE-04 `86670de` hot pools included) into this branch. Every fix below was made on the merged tree. On it, 7 of the 45 old tests failed with `KeyError` in `_take`, because the old `offer` extended the deque without `_key_bytes`.
- **Fix commit:** `386beb5`, no AI attribution. The report commit follows it.
- **Tests:** one `pytest -q` from the repo root on the merged tree gives **1449 passed, 1 failed, 1 xfailed, 0 warnings**.
  - **The one failure is not BE-13's.** It is `dynamic_cache/tests/test_tasks_api.py::test_the_port_matches_task_source_ts`, BE-04's drift guard, and it fails on main `1ad9e5f` too.
  - F-D (`e50298e`) changed `taskSource.ts` to ``/v1/tasks/next?user_id=${...}${cvd ? '&inks=cvd_safe' : ''}``, and the guard still expects the old URL template.
  - The server also ignores `inks`, so `cvd_safe` is never served. Routed to BE-04 / F-D, see Requests.
  - `test_llm_worker.py` now has **57 tests** (all pass).

### CRITICAL: `offer()` on hot pools (`cache_dispatcher.py`, inside `offer`/`pool_stock` only; `_sweep` untouched)

1. It returns 0 when the pool does not exist (`self._pools.get`, no `setdefault`), when `_floor(pool_key, now) == 0`, or after `close()`.
2. Every entry is stocked through `self._add`, so `_key_bytes`, `_pool_bytes` and `pool_bytes_max` hold. The offer stops at the first refusal. The byte cap and the growth budget are checked **before** a procedural entry is evicted, so a refused offer never costs stock.
3. Room is bounded by `_want(pool_key, now)`. When the pool is at its target, an LLM entry takes the place of the rightmost procedural entry (via `_take`). It stops when only paid entries are left. **Why:** at steady demand the pool sits at its target, so `want - len(pool)` alone would almost always be 0 and every paid variant would be wasted. The length never passes `_want`. Entries landing above the floor count into `_growth_bytes`, as `_refilled` counts them. An evicted entry above the floor is subtracted.
4. **LLM entries go to the left** (`_add`, then `appendleft(pop())`). They are served first, and `_sweep` trims from the right, so they are never what it trims while the pool is in use. An idle pool (floor 0) is emptied whole, as before.
5. `_active_at`, `_demand` and `_inflight` are not touched (tested).
6. `pool_stock()` lists only pools in use (floor > 0).
7. Docstrings: the module docstring and `offer`.

**Tests (merged tree):**

| Requirement | Test |
|---|---|
| `_pool_bytes == sum(len(body))` after offers and pops | `test_pool_bytes_stay_exact_through_offers_and_pops`; also checks `_key_bytes` per pool, LLM first, the three procedural entries that made way, and the served order |
| Offered entries survive a sweep at low demand | `test_offered_entries_survive_a_sweep_at_low_demand`: wave target 20, 3 offers, demand decays, sweep to 8, and the 3 paid entries stay |
| An offer stops at `pool_bytes_max` | `test_an_offer_stops_at_pool_bytes_max`: cap 25 000, 10 kB entries, 2 taken |
| An offer to a pool created by a request's `setdefault` doesn't KeyError | `test_offer_to_a_pool_created_by_a_request_does_not_raise`: then 5 pops, with the tallies exact after each |
| Pools not in use | `test_offer_needs_a_pool_in_use` (no pool, an idle pool, closed; `pool_stock` excludes idle pools) |
| Other cases | `test_a_full_pool_of_paid_entries_takes_no_more`, `test_an_offer_is_not_demand` |

### IMPORTANT 1: term safety is structural

- **Renaming.** After validation and before hashing, `rename_terms` gives every relational item fresh procedural tokens: `relational._token`, so CONSONANTS × VOWELS × CONSONANTS minus `BLOCKED`.
  - The renaming is consistent within each item (a term keeps one new name across its premises and question).
  - It is seeded by the content, so equal LLM output still gives an equal variant and id.
- **Re-check.** The renamed payload goes through `validate_payload` again; a failure there would be a renaming bug, and the variant is still not served. The task_id is the hash of what is served.
- **Stroop** stays an allowlist.
- **Denylist** stays as defence in depth. It gains the four-letter-plus slurs (`kike`, `spic`, `coon`, `chink`, `gook`, `wetback`, ...), which it lacked.
- **Tests:**
  - `test_relational_terms_are_always_procedural_tokens`: a variant using kike, spic, coon, chink, gook, wetback, patient, iq, killab and black is **served**. None of those strings is in its body, every term is a procedural CVC outside `BLOCKED`, and answers, hops, inversions and relations are unchanged.
  - `test_the_denylist_still_flags_bad_relational_terms[6]` checks the denylist directly.

### IMPORTANT 2: per-pool cool-down

- A call that accepts 0 variants (parse failure or all rejected) puts its pool on a cool-down: `POOL_COOL_FIRST_S = 300 s`, doubling up to 1 h. An accepted variant clears it.
- `_target` skips cooling pools.
- **Test:** `test_a_pool_that_is_always_rejected_does_not_starve_the_others`. Over 12 cycles at 30 s, the always-wrong relational pool gets 2 calls (0 s and 300 s) and the stroop pool gets 10, with 20 variants accepted.

### Minors

- **More blocked words.** `vag vaj zeb fak fok git fek nit dum nul jip neg kut lul kuk pik kus` are added to `relational.BLOCKED` and to the worker denylist. The relational golden hash is re-recorded as `04fe4f0e…`.
- **Budget, unreadable file:** it is logged once and rewritten as `{day: today, calls: cap}`. Today counts as spent, and the next UTC day starts at 0. Test: `test_an_unreadable_budget_is_spent_today_and_rewritten` (one warning, no call today, a call tomorrow).
- **Budget and archive writes** use a per-pid tmp name plus `os.replace` (`test_writes_use_a_per_process_tmp_name`).
- **`VariantArchive.get` re-runs the content gate** on replay (`test_a_replay_runs_the_content_gate_again`).
- **The purge removes stale `*.tmp`** files older than `STALE_TMP_S = 1 h` (`test_the_purge_removes_stale_tmp_files`).
- **Report corrected.** All 22 first-round `BLOCKED` additions were servable and being served: every one is a CVC the generator can spell. They were not limited to the 4 my 300-seed sample happened to show. The same holds for the 17 added in this round. That makes 39 in total. The section below is corrected.

### Merge with BE-04's last-minors round

- My dispatcher edits in this round are only inside `offer()` and `pool_stock()`, plus their docstring and the one module-docstring bullet.
- The hook from round 0 stays: `Entry.source`, the `variants` lookup in `_replay`, and `source` in the session recipe.
- The "one line needed after the merge" note further down is obsolete: the merge is done, and `offer` uses `_add`.

- **Branch:** `worktree-agent-acbeb86e4db59c962`, reset to `e36227e` (as instructed, not `ae67522`).
- **Commits** (no AI attribution):
  - `3851670 fix(dynamic_cache): relational terms never spell slurs or rude words`. A BE-03 fix found by this ticket. It is a separate commit so it can be reviewed, or dropped, on its own.
  - `9806dd3 feat(dynamic_cache): LLM pool worker: validated Gemini task variants join the pools (BE-13)`
  - `6bc29ee refactor(dynamic_cache): place the BE-13 variants hook apart from the hot-pools edits`. This moves two lines so the merge with `98f1381` is clean.
  - The report commit.
- **Tests:** one `pytest -q` from the repo root at `9806dd3` gives **1415 passed, 1 xfailed, 0 warnings**. After `6bc29ee` (two lines moved), the LLM worker, dispatcher and tasks-API suites pass again.
  - That is the base plus 45 new tests.
  - The new files and the dispatcher, API, generator and Gemini suites also pass with `-W error`.
  - The base run had 2 timing failures under machine load (`test_background_refill_keeps_the_pool_warm`, `test_p99_..._paced`). Both pass on re-run and in the final full run.
- **Venv:** `.venv` in the worktree, built from the root `requirements.txt` on CPython 3.13.14. No new dependencies.

## Files

| Path | What |
|---|---|
| `dynamic_cache/llm_worker.py` (new) | The worker. Also: the prompt, the Gemini response schema, the four gates, the variant archive and the daily budget |
| `dynamic_cache/cache_dispatcher.py` | **The hook, +35 lines**, listed below |
| `dynamic_cache/api.py` | Server wiring: `variants=VariantArchive().get` in `make_dispatcher`, and `start_llm_pool`/`stop_llm_pool` as `app.lifecycle` hooks named `llm_pool` |
| `ai_coach/llm_gemini.py` | `generate(..., max_output_tokens=MAX_OUTPUT_TOKENS)`. Loti's default (256) is unchanged; the worker asks for more because it needs whole task blocks |
| `conftest.py` (root) | Every test runs with `LLM_POOL_RPM=0` and a temporary `LLM_VARIANT_DIR`. A developer's key in `backend/.env` can never start the worker in a test |
| `backend/.env.example`, `backend/Dockerfile`, `docker-compose.yml` | `LLM_POOL_RPM`, `LLM_POOL_DAILY_CAP`, `LLM_VARIANT_DIR`. `/data/llm_variants` is owned by uid 10001, on its own named volume |
| `dynamic_cache/generators/relational.py`, `tests/test_generators.py` | 22 rude or slur spellings added to `BLOCKED`. The relational golden hash is re-recorded |
| `dynamic_cache/tests/test_llm_worker.py` (new) | 45 tests. Gemini is mocked at the HTTP transport (`httpx.MockTransport`), so the real `GeminiRunner` runs |

Not touched: `brain_twin_jepa/**`, `docs/ui/contracts.md`, the `v1_interop` stand-ins, `frontend/`, `main.py`.

## The dispatcher hook (kept small for the `98f1381` hot-pools merge)

- `Entry` gains `source: str = "procedural"` (a NamedTuple default, so every existing constructor still works). `PROCEDURAL` is a new constant.
- The constructor gains `variants: Callable[[str], bytes | None]`, a task_id → body lookup for replays. It sits next to `archetype`, away from the hot-pools edits.
- The session recipe now records `"source": entry.source` (BE-04's request). `_replay` reads a recipe that is not procedural through `variants` and does not rebuild from the seed. When the variant is missing, the session gets a new task, the same fallback as a runtime mismatch.
- `offer(archetype, schema_type, level, entries) -> int` adds non-procedural entries only, up to 2 × `pool_size` per pool. It refuses everything after `close()`.
- `pool_stock()` returns `{pool_key: (entries, llm_entries)}`, so the worker fills only pools that are in use.

**Merge with `98f1381` (checked).**
- `git merge-tree` shows no conflict.
- I trial-merged in this worktree, ran the LLM worker, dispatcher and tasks-API suites (163 passed, `-W error`), then aborted the merge.
- **One line is needed after the merge**, because hot pools count pool bytes and decrement them on every pop. In `offer`, after `pool.extend(taken)`, add:
  ```python
  self._pool_bytes += sum(len(e.body) for e in taken)
  ```
- After the merge, the reviewer may also want the cap at `self.pool_max` rather than `2 * self.pool_size`.

## How it works

**Cycle.** `run_once()`, on one daemon thread named `llm-pool`:
1. It does nothing while paused (backoff) or paced (RPM).
2. It picks a target: of the pools in use for `relational`, `stroop` or `matrix`, the one holding the fewest LLM variants, and fewer than `LLM_PER_POOL = 8`. With no such pool there is no call.
3. It spends one call from the daily budget. If the budget is spent or the count cannot be written, there is no call.
4. It asks Gemini for N variants (relational 1, stroop 2, matrix 6), through BE-06's `GeminiRunner`:
   - the same key handling (`x-goog-api-key` header, never in the URL, a log or `repr`);
   - the same deadline mechanics and safe `GeminiError` messages;
   - its own runner with a 90 s timeout and `maxOutputTokens` per schema.
   - `responseMimeType: application/json` plus a `responseSchema`, converted from the BE-03 draft-07 definition: `$ref` inlined, null as `nullable`, tuple items given a fixed length, and keys Gemini does not take dropped.
5. It runs the gates on every variant, archives each one that passes, and calls `offer()`.

**The prompt.** It carries only the schema, the level's shape (trial counts, levels, time limit, colours, option count) and the theta guidance (reversal, shuffle and inversion rates as the generator uses them). It also carries a shortened format example taken from the procedural payload at that level.

**The gates.** A variant that fails one is dropped, counted in `stats["rejected_<reason>"]`, and never served.

| Reason | Check |
|---|---|
| `parse` | Strict JSON, exactly `{"variants": [...]}`, no duplicate keys, no NaN/Infinity |
| `schema` | BE-03 `validate_payload` with the **served** schema only (`allow_unserved` never set) |
| `solver` | The same call's solvers: a wrong relational truth, a Stroop answer ≠ ink, a wrong matrix option, colour-only options (FE-12), a repeated Stroop stimulus |
| `shape` | The procedural payload at that level, field by field. Relational: `n_trials`, time limit, hops per item per level. Stroop: colours in button order, time limit, trial count, congruent count. Matrix: option count, time limit, missing-cell position, number of varying attributes, and colour never varying alone. **Why:** an LLM variant must measure what a procedural one measures; only the content may differ |
| `content` | The visible text (relational terms, Stroop words):<br>• the shared banned-terms lint (`ai_coach/banned_terms.json`, `lint_text` over all rules);<br>• a profanity and harm list (English and French stems and whole words, plus identity words that would read as a slur in "X is less than Y");<br>• the relational generator's own `BLOCKED` list;<br>• Stroop words only from the served colour set |
| `duplicate` | Already in the archive, or twice in one reply |

**Ids and `source`.**
- `task_id = {schema}-llm-{sha256(schema|params)[:16]}`, at most 36 characters, and it matches `^[\w:.-]{1,48}$`.
- Equal content gives an equal id; different content never shares one.
- The literal `llm` segment can never collide with a procedural id, whose second segment is the seed in digits.
- The `{schema}-` prefix keeps `schema_of()` working, so trials on LLM variants step the staircase.
- `surface_seed` comes from the hash.
- `source: "llm"` lives in the pool `Entry`, the session recipe and the archive record. The **payload envelope is unchanged**: its schema has `additionalProperties: false` and the frontend contract has no such field.

**Archive (`LLM_VARIANT_DIR`, default `data/processed/llm_variants/`, gitignored).**
- One `{task_id}.json` per accepted variant, holding `{source, model, schema_type, theta, created_at, payload}`.
- It is task content only, never a user id (tested).
- `get()` re-derives the id from the content, so a tampered file is not replayed.
- Pruned after `ARCHIVE_DAYS = 15`, past the 14-day life of a session recipe.
- This is what makes an LLM session replay byte-identical after a restart (tested).

**Fail safe, rate and budget.**
- **No worker** (`LlmPoolWorker.from_env` → None, and no call ever) when any of these holds:
  - no `GEMINI_API_KEY`, or a blank one;
  - `LLM_POOL_RPM=0` or `LLM_POOL_DAILY_CAP=0`;
  - a non-numeric or NaN setting.
- **Defaults once the key is set:** 2 calls a minute (capped at 60) and 200 calls per UTC day.
- **The daily count survives restarts.** It is kept in `{LLM_VARIANT_DIR}/budget.json`. An unreadable file counts as spent, and an unwritable one means no call.
- **On failure the worker backs off and nothing enters the pools.** Failures are logged by status or type name only: an HTTP error, a Gemini safety block, a timeout, or no network.
  - The pause is 60 s, doubled per error in a row, capped at 1 h.
  - **After a 429 it starts at 300 s.**
- **The procedural refill is untouched** and keeps serving. A worker bug inside a cycle is caught, logged and backed off; it never reaches a request.

**Privacy (delete and export).**
- LLM variants hold **no user data**. The prompt has no user id, session or text; a test checks the request bytes.
- The archive holds task content shared by every user, so no `register_user_store` hook is needed.
- Which variant a user was served is in that user's task registry (`sessions[...].task_id`, `source`), which BE-04's delete and export already cover.
- R14 is not engaged: no user text reaches this LLM, and its output is gated by the solvers and the content checks before anyone sees it.

## Found and fixed: the procedural relational generator spelled slurs

- Running the procedural terms through this content check, as the bar both sources should meet, found hits. In a sample of 300 relational payloads (seeds 100–399), the CVC generator produced `fag` (90), `jew` (89), `tit` (92) and `fap` (73). Its `BLOCKED` list missed them.
- `3851670` adds them to `BLOCKED`, plus 18 more three-letter rude or slur spellings in English and French: dik, fuk, jap, jiz, kok, kon, kul, kum, lez, nig, nik, nip, nob, pak, pis, wog, wop, zob.
- **Correction (review round 1):** all 22 were being served, not only the 4 the sample showed. Every one is a CVC the generator can spell, so each appeared at some rate. Round 1 adds 17 more (39 in total).
- The relational golden hash is re-recorded; that is the only golden that changed.
- `test_procedural_terms_meet_the_same_bar` enumerates all 1280 CVC spellings and asserts that none left unblocked hits the worker's harm list.
- **Side effect:** an already-stored relational session recipe now rebuilds a different payload. `_replay` sees the id mismatch and serves a new task (BE-04's documented fallback).

## Acceptance criteria → evidence

| AC | Evidence |
|---|---|
| Background task asks Gemini for variants at a theta, reusing `GeminiRunner`, its key handling, deadline and safe errors | `LlmPoolWorker`, `from_env`. `test_valid_variants_enter_the_pool_and_are_served[3]` checks the request: key in the header and not in the body, JSON mime type, response schema, `maxOutputTokens`. `test_with_a_key_the_defaults_are_bounded` checks the 90 s runner and that `repr` hides the key. `test_the_server_starts_and_stops_the_worker_with_a_key` |
| Strictly structured JSON params for one schema | `response_schema`, `parse_variants`. `test_the_response_schema_is_what_gemini_accepts`, `test_garbage_replies_are_rejected_not_served` (non-JSON, an extra key, a duplicate key, NaN, the same variant twice) |
| `validate_payload` (served only) + solvers; reject, count, never serve | `check_variant`. `test_invalid_variants_are_rejected_and_counted` (schema 1, solver 1, nothing in the pool, the next serve is procedural), `test_a_wrong_relational_answer_is_caught_by_the_solver`, `test_a_wrong_matrix_answer_is_caught_by_the_solver` (5 of 6 accepted), `test_a_variant_of_the_wrong_shape_is_rejected` |
| `source: "llm"` + content-hash id (≤ 48, pattern, unique per Option B), same pools through a small hook | `test_source_is_recorded_and_ids_are_content_hashes` (recipe `source` is llm or procedural, 6 distinct ids, pattern, ≤ 48 even with the longest schema name, `schema_of`, same content gives the same id), `test_an_llm_session_replays_the_same_bytes_after_a_restart`, `test_a_tampered_archive_entry_is_not_replayed`, `test_old_archive_entries_are_purged`, `test_the_offer_hook_is_bounded`, `test_procedural_tasks_follow_once_the_llm_variants_are_used` |
| No key, error, rate limit or offline → nothing happens; procedural keeps serving | `test_without_a_key_or_with_the_pool_switched_off_there_is_no_worker[6]`, `test_no_key_means_no_call_from_the_server`, `test_errors_fail_safe_and_back_off[4]` (500, 429, ConnectError, safety block; the backoff doubles; tasks served meanwhile are procedural), `test_a_worker_error_never_reaches_the_request_path`, `test_no_pool_in_use_means_no_call` |
| Content safety: lint, profanity and harm, Stroop words from the colour set | `test_the_lint_blocks_bad_words_in_relational_terms[6]`: each case is otherwise valid, and `validate_payload` passes it. Banned-terms lint: `patient`, `iq`. Harm stem: `killab`. Harm words: `sex`, `black`. Generator list: `bad`. Also `test_stroop_words_come_only_from_the_colour_set`, `test_clean_variants_pass_the_content_check`, `test_procedural_terms_meet_the_same_bar` |
| Bounded rate and budget: `LLM_POOL_RPM`, daily cap, off unless the key is set | `test_the_rate_is_respected` (2 rpm: no call at 29 s, a call at 30 s), `test_the_daily_budget_is_respected_and_survives_a_restart` (cap 3: 3 calls, then 3 budget skips; a restarted worker on the same day makes 0 calls; the next UTC day makes 1), `test_an_unwritable_budget_means_no_call`, `test_with_a_key_the_defaults_are_bounded`, `test_a_full_llm_share_stops_the_calls` |
| Telemetry and export: no user data, so no delete hook; said so | Module docstring and the section above. `test_the_prompt_carries_no_user_data`, `test_the_variant_archive_holds_no_user_data` |

## Live evidence (uvicorn, no new routes)

`scratchpad/live_be13.py` starts `uvicorn app.main:app --app-dir backend` with temporary data dirs.

**No key:**
```
GET /v1/tasks/next?schema_type=relational -> 200 task_id=relational-3263985893-e817e66ed5 (45.9 ms)
GET /v1/tasks/next?schema_type=stroop -> 200 task_id=stroop-3439997954-979c0d76ab (3.2 ms)
GET /v1/tasks/next?schema_type=matrix -> 200 task_id=matrix-4114874060-840ed0ee44 (2.3 ms)
after 3 s: GET relational -> 200 task_id=relational-3131177986-57d4b0b1ab
--- variant dir: absent          (no worker, no budget file, no call)
--- server log lines mentioning the LLM pool: (none)
```

**A fake key, `LLM_POOL_RPM=60`:** a real request went to Google, and the fail-safe path ran.
```
GET /v1/tasks/next?schema_type=relational -> 200 task_id=relational-1164172516-3fdb0da826 (65.0 ms)
GET /v1/tasks/next?schema_type=stroop -> 200 task_id=stroop-3082854130-9a463b0cf8 (3.8 ms)
GET /v1/tasks/next?schema_type=matrix -> 200 task_id=matrix-1860782047-58ea0566f2 (2.1 ms)
after 40 s: GET relational -> 200 task_id=relational-3517220706-e342771b40
--- variant dir: ['budget.json']                     (one call counted)
--- server log lines mentioning the LLM pool:
LLM pool call failed (HTTP 400); procedural pools keep serving
key in log: False
```
The worker found no pool at boot and waited `IDLE_S` = 30 s. It then targeted the pools the requests had created. Google refused the bogus key (HTTP 400), the worker backed off, and serving went on procedurally.

**Not run: a live run with a real key.** None is configured here. Points to watch in that run:
- whether Gemini accepts every converted `responseSchema` (relational nests arrays two deep);
- the acceptance rate per schema;
- the latency of a 16k-token relational block.

`worker.stats` and the INFO log line `LLM pool: {...}` give the counts (calls, accepted, offered, rejected by reason, errors, rate_limited, budget_skips).

## Decisions to review

1. **Schemas: relational, Stroop and matrix only.**
   - Relational and Stroop carry the visible text the brief names. Matrix items are small puzzles the rule solver checks well.
   - n_back, mental_rotation, tower (36 board states), ufov and mst are geometry or timing grids where an LLM adds nothing over the generator.
   - **Stroop LLM variants add little;** they exist because the brief lists Stroop words.
2. **The shape gate is mine (not in the brief).** Without it, a valid but shorter Stroop or relational block would be served and scored like a full one.
3. **Archive on disk** rather than putting the body into the per-user registry. That keeps user files small and keeps content out of the export. It is bounded by the daily cap × 15 days: worst case about 200 relational blocks × 27 KB × 15 ≈ 80 MB.
4. **Defaults: 2 rpm and 200 calls a day.** Paid Flash costs pennies at that rate. On the free tier, 200 a day sits below its daily request quota, but it shares the key with the coach.
5. **The worker shares BE-06's Gemini thread pool** (8 threads, 16 slots). It makes one call at a time, so at worst it holds 1 thread for up to 90 s. If the coach saturates the pool, the worker gets "busy", backs off, and the coach is unaffected.
6. **Per-pool share:** at most 8 LLM variants are waiting in a pool. Each serves one user once; the Bloom filter still blocks repeats per user.
7. **The identity words in the harm list** (e.g. `jew`, `black`, `gay`) block those strings as nonsense terms only, because in "X is less than Y" they would read as a slur. They are not used anywhere else.

## Requests

- **BE-04 / F-D (round 1):** `test_the_port_matches_task_source_ts` fails on main `1ad9e5f`.
  - F-D added `&inks=cvd_safe` to the `taskSource.ts` URL, and the guard still expects the old template.
  - `GET /v1/tasks/next` has no `inks` parameter, so the cvd_safe setting does nothing on the server. FastAPI ignores unknown query parameters.
  - One of these is needed: the route accepts `inks` (with cvd_safe only once `black` is mapped), or the guard is updated.

- **Hot-pools merge (`98f1381`):** add the one `_pool_bytes` line in `offer` (above). Optionally cap at `pool_max`.
- **BE-03 owner / reviewer:** please confirm the `BLOCKED` additions and the re-recorded relational golden hash (`3851670`). Drop that commit if you would rather fix it differently, but all of those words were being served.
- **Ops:** the volume `llm_variants` is in compose. With a key set, watch the `LLM pool:` INFO line for the rejection mix. `LLM_POOL_RPM=0` switches the worker off without removing the key, so the coach keeps its LLM.
- **Live key run (whoever holds the key):** start the server with the key, request each of the three schemas once, wait about 2 minutes, and read `worker.stats` / the log. If Gemini rejects the converted schema for relational (HTTP 400 on every relational call), drop `responseSchema` for that schema and keep only the JSON mime type: the local gates do not depend on it.
