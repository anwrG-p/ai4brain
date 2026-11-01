# Member 1 handover: for the other members' agents

Member 1 (`assessment_engine/`) delivers tasks to the user and turns every trial into a telemetry event. Read this before you integrate with it. The source of truth for every field, limit and command is [`README.md`](README.md); this file only adds what the code can't tell you.

- Server contract: `backend/app/api/routes/v1_telemetry.py` (`TelemetryEvent`, `POST /v1/telemetry/event`)
- Client contract: `frontend/src/features/assessment/telemetry/types.ts` (`TaskPayload`, the `*Params` types)
- Mock tasks you can copy: `frontend/src/features/assessment/tasks/fixtures.json` (one per `schema_type`)
- The exercises run inside the team UI (`frontend/`). `assessment_engine/client/` is a frozen reference; see "The UI" below.

Find your section and skip the rest.

## Member 3 (Brain Twin): you consume the telemetry

**Where events land:** one JSON line per trial in `data/raw/telemetry/{user_id}.jsonl` at the repo root. `TELEMETRY_DIR` overrides the location. The folder is git-ignored; keep it that way, because it is user data. Each line is one `TelemetryEvent` plus the `received_at` the server adds.

**Delivery is at-least-once.** Dedupe on `(session_id, trial_meta.item_id, trial_meta.stream)`. `client_ts` is not unique: the two N-back stream events share it.

**Per-task details that affect your features:**
- **N-back** sends **two events per trial**, one per stream (`trial_meta.stream` = `position` | `symbol`). Since R16, scoring follows the on-screen hint: only the rule's stream (`NBACK_RULE_STREAM` in `types.ts`: `position` → position, `symbol` and `parity` → symbol) expects a press. The **rule-stream event** carries the payload's `trial_type` (`target`, `lure_minus`, `lure_plus`, …) and the trial's verdict: `error_flag` is false only when the rule key's press-or-withhold matches `answer[rule stream]` and the off-rule key was not pressed, so an off-rule press makes a noise trial a false alarm and a target trial a miss. The **off-rule event** expects no press: `trial_type` is `lure_stream` when that stream matched n back, else `standard`, and `error_flag` means its key was pressed. For d′ and lure false-alarm rates, filter on `stream` matching the rule's stream.
- **N-back** `error_burst` counts per stream event, not per trial. Every other screen counts per trial.
- **Tower**: `score_norm = min(1, l_min / l_user)` when solved, else 0. It is not binary. A problem also ends unsolved `time_limit_ms` (default 60000) after the move-count prediction; then `l_user < 3 × l_min` and `response_time_ms` = planning + limit.
- **UFOV** runs QUEST+. It estimates a display-duration threshold and does not hold accuracy at 85%; only Relational's staircase targets 85%. Use `trial_meta.shown_ms` (measured, a whole number of frames), not `requested_ms`. `quest_threshold_ms` appears only on the last event of a UFOV task, and is missing if that trial was aborted. You can recompute it from `shown_ms` and correctness.
- **MST**: `trial_meta.response` can be `none` (timeout).
- **Timing fields:**
  - `keystroke_latency_ms` = onset → first key or pointer press. Mouse movement doesn't count.
  - `hesitation_jitter` includes pointer movement, throttled to one sample per 50 ms.
  - `response_time_ms` is capped at 600000.
- **Voice fields** (`voice_latency_ms`, `vocal_pace_hz`) never come from the UI: voice is not shipped there (D1), so `voice_opt_in` is always `false`. Only the frozen `client/` can produce them, on Stroop, with opt-in.

**Scoring formulas** (from `docs/research/2026-10-30-member1-evidence-review.md`):
- **N-back d′:** apply the log-linear correction to every user, not only to extreme rates (Hautus 1995): `H = (hits + 0.5) / (N_signal + 1)`, `FA = (FAs + 0.5) / (N_noise + 1)`, `d′ = z(H) − z(FA)`. Lure trials (`trial_type` `lure_minus` / `lure_plus`) are **excluded from the standard FA denominator**: `N_noise` counts the active rule's non-target trials minus the lures. Score lure false alarms as a separate FA class, with its own rate over the lure trials (design inference, as the evidence review labels it: not a verified claim).
- **MST:** `LDI = P("similar" | kind=lure) − P("similar" | kind=new)`, from `trial_meta.kind` and `trial_meta.response`.
- **Stroop:** interference = mean RT(incongruent) − mean RT(congruent), on correct trials only, split by `trial_meta.congruent`. Prefer this RT cost over the error cost, pool across sessions, and show uncertainty: single-session reliability is only ICC ≈ .6 (Hedge 2018).
- **Mental rotation:** the intercept (overall speed) is the main score. The slope over `trial_meta.angle_deg` needs blocked presentation and ≥50 trials per condition (second-hand heuristic, not a primary-source figure); treat it as secondary.

**Dimensions:** there are 6, not the README's 4: `processing_speed` (UFOV) and `episodic_memory` (MST) were added. Confirm with Member 4 and tell Member 1 if you want them mapped differently.

**Decide with Member 1:** the root README's `x_t` has two spellings. This module uses `score_norm` / `response_time_ms` / `error_flag` / `hesitation_jitter`, not `score` / `rt_ms` / `error` / `jitter`.

## Member 5 (Generator & Cache): you serve the tasks

**Endpoint the client calls:** `GET /v1/tasks/next?user_id=<id>` → `{ task_id, dimension, schema_type, params, surface_seed }`. The `params` shape for each of the 8 `schema_type`s is in README "Task payload contract". The matching TypeScript types are in `types.ts`, and a valid example of each is in `fixtures.json`.

**Rules the client enforces.** Breaking one shows the user a retry screen, or makes the server reject telemetry:
- `task_id` must match `^[\w:.-]{1,48}$`. The 48-character limit exists because `item_id = "{task_id}:{trial}"` must fit the 64-char meta string limit.
- `dimension` must be one of the 6; `schema_type` one of the 8.
- **Every trial carries its verified answer.** The client never computes correctness, so your solver's answer is the truth:
  - `answer` fields for most tasks
  - Tower: `goal` + `optimal_moves` + `counter_intuitive`
  - UFOV: `central` + `peripheral_dir` (0..7)
- **Colours are CSS colour names** (`"blue"`), not hex. Screen readers read them aloud.
- **Stroop colours must be `red`, `green`, `blue`, `yellow` or `black`** (in `colors`, `ink` and `answer`). The UI maps only those five to theme tokens. A block whose `colors` include `black` (the generator's `cvd_safe` preset) draws its words on a light plate in both themes, so black stays readable on a dark screen. Any other name renders in the normal text colour, with no error, so the ink can't be seen and the trial is unanswerable. The server serves `cvd_safe` when the request carries `inks=cvd_safe` (`GET /v1/tasks/next`; classic is the default, any other value is a 422).
- **Staircased Relational** expects `levels: Trial[][]`, easiest first.
- **UFOV** expects `duration_grid_ms` (non-empty, roughly log-spaced 17–500). `similarity` and `mask_noise` must be in [0,1] and are fixed per block. Adapt them between blocks from Member 1's telemetry.
- **N-back difficulty** (`n`, lure density) changes only between blocks, so you adapt it from the telemetry.

**Gotchas:**
- In React dev mode (StrictMode) the UI sends two `GET /v1/tasks/next` each time an exercise mounts, and keeps only the second reply. If your endpoint has side effects, such as advancing a schedule or marking a variant as seen in the Bloom filter, make it idempotent per `(user_id, session)`, or dev sessions will skip tasks. Production builds send one.
- **Open question (R2):** the UI page is per dimension (`/task/:dimId`), but real mode ignores the dimension because your generator decides. Should `GET /v1/tasks/next` accept a `schema_type` filter?
- **Known open issue (frozen `client/` only):** if `params` is malformed in a way that crashes a screen, the frozen client skips to the next task immediately, with no delay; if every task you serve is broken, each open frozen client polls your endpoint in a tight loop. The UI does not loop: `SkipOnError` shows an error card, and only the user's Retry fetches again. Either way, validate `params` against `types.ts` before serving.
- MST has no `time_limit_ms`. The client uses 5000 ms. Add the field to the contract if you want control over it.
- Tower takes an optional `time_limit_ms` per problem (client default 60000, the TOL-F limit). Send it if you want a different limit.

**Block designs the research asks for** (`docs/research/2026-10-30-member1-evidence-review.md` §2, row 5):
- **Stroop:** every block mixes congruent and incongruent trials, so the interference cost can be computed.
- **MST:** a real block follows the oMST mix, about 20 repeats / 44 lures / 20 foils. The fixture (3 study + 5 test) is a demo.
- **Mental rotation:** blocked presentation, ≥50 trials per condition (second-hand heuristic), if the angle slope is wanted.
- **Tower:** a TOL-F series, not a single problem: 2 two-move comprehension and 4 three-move practice items, then 24 test problems (8 each at 4, 5 and 6 minimum moves, in increasing difficulty), 60 s each.

## Member 4 (Dashboard & Privacy)

- **The privacy routes exist** (BE-02, ported in BE-PORT). `DELETE /v1/user/telemetry?user_id=` removes `{TELEMETRY_DIR}/{user_id}.jsonl` and every `{user_id}.*` file and returns `{deleted_events, deleted_files}`. `GET /v1/user/export?user_id=` returns the stored JSONL (404 if none, 413 above 50 MB). Both answer 503 with `Retry-After: 1` when the telemetry lock stays busy. The logic is in `backend/app/privacy/telemetry_store.py` (no FastAPI); the routes are thin wrappers. On the server, nothing else stores telemetry.
- **User ids are case-insensitive.** The store lowercases them (`user_key()`), so `U1` and `u1` share `u1.jsonl` on every filesystem.
- **The UI's delete is local only.** "Delete my data" on `/privacy` clears the tracker queue (`tracker.clear()`, memory and `localStorage`) and the consent choice, the saved sessions, goals, Loti's talk and the anonymous id; it keeps the theme and reduce-motion settings. It does not call the delete route yet.
- **The 30-day retention job** works on the same files under the same lock. Each line has a `received_at` UTC timestamp. Run it from the repo root: `python -m backend.app.privacy.retention --days 30`.
- **Shared FastAPI app:** `backend/app/main.py` is the one API server (BE-00). It mounts one router per module; privacy routes go in `backend/app/api/routes/v1_privacy.py`. It also adds a custom 422 handler that leaves the rejected `input` out of the response, so NaN values don't turn into 500 errors. Keep that handler.
- **Voice consent:** the UI ships without voice (D1), so there is no consent to manage there. The opt-in toggle exists only in the frozen `client/`. If voice comes back, your governance UI should own its consent; tell Member 1.
- **Radar axes:** there are 6 dimensions; see Member 3's section.

## Member 2 (AI Coach)

You don't consume Member 1 directly. If your coach text mentions specific tasks, use the names the UI shows (`frontend/src/features/assessment/names.ts`; each screen's `<section aria-label>`):

| schema_type | UI name | Skill (pillar) |
|---|---|---|
| relational | Logic Web | Focus & Strategy |
| tower | Strategic Blueprint | Focus & Strategy |
| matrix | Pattern Puzzle | Focus & Strategy |
| n_back | Memory Gauntlet | Mental Agility |
| mental_rotation | Shape Turn | Mental Agility |
| stroop | Color Clash | Impulse Control |
| mst | Precision Archive | Deep Memory |
| ufov | Perceptual Radar | Visual Radar |

Keep brain-region names out of user-facing text (U5). Member 1's UI has none. Loti's replies are scripted for now: no AI-generated reply reaches a user until a second, AI-based crisis check runs on every message (R14, DEC-011).

## The UI (`frontend/`): where the exercises run, and when telemetry leaves the device

The maintained client is `frontend/src/features/assessment/`. Member 1 owns that folder; the UI team owns the rest of `frontend/` (DEC-001). The design and the routes are in `docs/design/BRAND-V2.md`; the decision is DEC-011.

**The flow.**
1. `/` Welcome: Loti says hi, one button, Start.
2. `/baseline`: **six exercises in a row** (R10): Logic Web, Memory Gauntlet, Color Clash, Strategic Blueprint, Perceptual Radar, Precision Archive. One session is saved on the device at the end.
3. `/results`: the 5-skill chart blurred, Momo's leap, then the data choice, then the chart un-blurs.
4. `/dashboard` (Home).

A **returning device** (one saved session or more) skips Welcome and the baseline: `/` and `/baseline` redirect to Home. `/baseline?again=1` is the retake.

**Where the exercises appear.**
- In the baseline (above).
- On `/train`: every exercise, under the skill it trains. Each row opens `/task/:dimId?schema=<schema_type>` (`TaskRunnerPage`), one exercise at a time; a finished run is saved as a session too, so it reaches Home.
- In judge mode (`?judge=1`, R6), the task runner's "Evaluator controls" switch exercise, dimension and stage.

**The consent gate (R3, U4).** The Tracker holds every event on the device until the user chooses, on Results (or later on `/privacy`):
- **Before the choice** (`pending`): events are buffered and kept in `localStorage` (`synapsetwin_telemetry_queue_v2`), but **never sent**. The beacon, the timer and the flush paths all respect this.
- **"Save my answers"** (`granted`): the held events are released and flushed to `POST /v1/telemetry/event`; later events are sent as usual.
- **"Keep them on this device only"** (`denied`): the queue is cleared and nothing is sent. The results still show, from the scores saved on the device.
- The choice is stored as `synapsetwin_consent_v1`. Users stay anonymous (R13): the `user_id` is a random device id, with no account.

**How an exercise runs.**
- **`ExerciseHost`** (`features/assessment/ExerciseHost.tsx`) is the one entry point, used by both `BaselinePage` and `TaskRunnerPage`. It fetches one task, builds a `TrialRecorder` for it and renders the screen through `TaskRunner`, inside `SkipOnError` and the jsPsych-style `ExerciseFrame`: instruction (how to play, a small demo, Begin) → a 500 ms fixation "+" → trials with progress dots → end card. Events use the payload's `dimension`, never the UI registry's.
- **`?schema=<schema_type>`** picks the exercise in mock mode. Real mode ignores it (see Member 5's open question).
- **Pause** (Escape, the Pause button, a hidden tab) discards a started block: the exercise unmounts and the unfinished attempt is never scored or sent. The Pause button shows only after Begin. **Resume** fetches a fresh task with a new `task_id`.
- **The Tracker is the single telemetry sink**; `onEvent` feeds the judge-mode events table.
- **Voice is not shipped** (D1): `voice_opt_in` is always `false`.
- While trials run, the exercise's container has `data-timed-trial="true"` (animations off) and the page's own keys are off; only Escape (pause) stays.

## Run it locally

Use the commands in README "Run": the API on :8000 plus `frontend` (`npm run dev`). Mock tasks are the UI default, so you can test without Member 5's API; `?schema=` picks the exercise.
