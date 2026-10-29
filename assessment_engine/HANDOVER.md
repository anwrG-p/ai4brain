# Member 1 handover: for the other members' agents

Member 1 (`assessment_engine/`) delivers tasks to the user and turns every trial into a telemetry event. Read this before you integrate with it. The source of truth for every field, limit and command is [`README.md`](README.md); this file only adds what the code can't tell you.

- Server contract: `assessment_engine/api/routes/telemetry.py` (`TelemetryEvent`, `POST /v1/telemetry/event`)
- Client contract: `assessment_engine/client/src/telemetry/types.ts` (`TaskPayload`, the `*Params` types)
- Mock tasks you can copy: `assessment_engine/client/src/tasks/fixtures.json` (one per `schema_type`)

Find your section and skip the rest.

## Member 3 (Brain Twin): you consume the telemetry

**Where events land:** one JSON line per trial in `data/raw/telemetry/{user_id}.jsonl` at the repo root. `TELEMETRY_DIR` overrides the location. The folder is git-ignored; keep it that way, because it is user data. Each line is one `TelemetryEvent` plus the `received_at` the server adds.

**Delivery is at-least-once.** Dedupe on `(session_id, trial_meta.item_id, trial_meta.stream)`. `client_ts` is not unique: the two N-back stream events share it.

**Per-task details that affect your features:**
- **N-back** sends **two events per trial**, one per stream (`trial_meta.stream` = `position` | `symbol`). `trial_type` (`target`, `lure_minus`, `lure_plus`, …) refers to the active rule's stream. For lure false-alarm rates, filter on `stream` matching the rule's stream.
- **N-back** `error_burst` counts per stream event, not per trial. Every other screen counts per trial.
- **Tower**: `score_norm = min(1, l_min / l_user)` when solved, else 0. It is not binary. A problem also ends unsolved `time_limit_ms` (default 60000) after the move-count prediction; then `l_user < 3 × l_min` and `response_time_ms` = planning + limit.
- **UFOV** runs QUEST+. It estimates a display-duration threshold and does not hold accuracy at 85%; only Relational's staircase targets 85%. Use `trial_meta.shown_ms` (measured, a whole number of frames), not `requested_ms`. `quest_threshold_ms` appears only on the last event of a UFOV task, and is missing if that trial was aborted. You can recompute it from `shown_ms` and correctness.
- **MST**: `trial_meta.response` can be `none` (timeout).
- **Timing fields:**
  - `keystroke_latency_ms` = onset → first key or pointer press. Mouse movement doesn't count.
  - `hesitation_jitter` includes pointer movement, throttled to one sample per 50 ms.
  - `response_time_ms` is capped at 600000.
- **Voice fields** (`voice_latency_ms`, `vocal_pace_hz`) are absent unless the user opted in. They are only produced on Stroop.

**Scoring formulas** (from `docs/research/2026-10-30-member1-evidence-review.md`):
- **N-back d′:** apply the log-linear correction to every user, not only to extreme rates (Hautus 1995): `H = (hits + 0.5) / (N_signal + 1)`, `FA = (FAs + 0.5) / (N_noise + 1)`, `d′ = z(H) − z(FA)`. Score lure false alarms (`trial_type` `lure_minus` / `lure_plus`) as a separate FA class.
- **MST:** `LDI = P("similar" | lure) − P("similar" | foil)`, from `trial_meta.kind` and `trial_meta.response`.
- **Stroop:** interference = mean RT(incongruent) − mean RT(congruent), on correct trials only, split by `trial_meta.congruent`. Prefer this RT cost over the error cost, pool across sessions, and show uncertainty: single-session reliability is only ICC ≈ .6 (Hedge 2018).
- **Mental rotation:** the intercept (overall speed) is the main score. The slope over `trial_meta.angle_deg` needs blocked presentation and about 50 trials per condition; treat it as secondary.

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
- **Staircased Relational** expects `levels: Trial[][]`, easiest first.
- **UFOV** expects `duration_grid_ms` (non-empty, roughly log-spaced 17–500). `similarity` and `mask_noise` must be in [0,1] and are fixed per block. Adapt them between blocks from Member 1's telemetry.
- **N-back difficulty** (`n`, lure density) changes only between blocks, so you adapt it from the telemetry.

**Gotchas:**
- In React dev mode (StrictMode) the client sends two `GET /v1/tasks/next` on page load. If your endpoint has side effects, such as advancing a schedule or marking a variant as seen in the Bloom filter, make it idempotent per `(user_id, session)`, or dev sessions will skip tasks.
- **Known open issue:** if `params` is malformed in a way that crashes a screen, the client skips to the next task immediately, with no delay. If every task you serve is broken, each open client will poll your endpoint in a tight loop. Validate `params` against `types.ts` before serving.
- MST has no `time_limit_ms`. The client uses 5000 ms. Add the field to the contract if you want control over it.
- Tower takes an optional `time_limit_ms` per problem (client default 60000, the TOL-F limit). Send it if you want a different limit.

**Block designs the research asks for** (`docs/research/2026-10-30-member1-evidence-review.md` §2, row 5):
- **Stroop:** every block mixes congruent and incongruent trials, so the interference cost can be computed.
- **MST:** a real block follows the oMST mix, about 20 repeats / 44 lures / 20 foils. The fixture (3 study + 5 test) is a demo.
- **Mental rotation:** blocked presentation, at least 50 trials per condition, if the angle slope is wanted.
- **Tower:** a TOL-F series, not a single problem: 2 two-move comprehension and 4 three-move practice items, then 24 test problems (8 each at 4, 5 and 6 minimum moves, in increasing difficulty), 60 s each.

## Member 4 (Dashboard & Privacy)

- **Deleting a user's telemetry** (`DELETE /v1/user/telemetry`) = delete `{TELEMETRY_DIR}/{user_id}.jsonl`. Use the resolver `telemetry_dir()` in `routes/telemetry.py`, so your route and ingestion agree on the location. Nothing else stores telemetry.
- **The 30-day retention job** works on the same files. Each line has a `received_at` UTC timestamp.
- **Shared FastAPI app:** `assessment_engine/api/main.py` currently mounts only the telemetry router. It also adds a custom 422 handler that leaves the rejected `input` out of the response, so NaN values don't turn into 500 errors. Agree with Member 1 who owns the app before adding `privacy.py`. Keep that handler.
- **Voice consent:** the opt-in toggle is in the client. It is off by default and not saved, so it is off again on every page load. If your governance UI should own consent, it needs to drive `voice_opt_in` in the client. Tell Member 1.
- **Radar axes:** there are 6 dimensions; see Member 3's section.

## Member 2 (AI Coach)

You don't consume Member 1 directly. If your coach text mentions specific tasks, use the names the UI shows (each screen's `<section aria-label>`):

| schema_type | UI name |
|---|---|
| n_back | N-back |
| stroop | Color naming |
| matrix | Pattern puzzle |
| mental_rotation | Shape turning |
| relational | Word relations |
| tower | Tower puzzle |
| ufov | Quick look |
| mst | Shape memory |

Keep brain-region names out of user-facing text. Member 1's UI has none.

## Run it locally

Use the commands in README "Run". `VITE_MOCK_TASKS=1` serves `fixtures.json` in order, starting with N-back, so you can test without Member 5's API.
