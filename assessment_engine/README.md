# assessment_engine (Member 1)

Browser exercises that produce per-trial telemetry for the brain twin. Eight exercise screens across
six cognitive dimensions send one event per trial to a small FastAPI endpoint, which appends them to
`{TELEMETRY_DIR}/{user_id}.jsonl`. Nothing biometric is collected by the UI (the frozen `client/`
has an opt-in voice probe; see Privacy below).

The exercises run inside the team UI (`frontend/`, SynapseTwin) at `/task/:dimId`. Their maintained
code lives in **`frontend/src/features/assessment/`**, a folder Member 1 owns inside the UI app.
`client/` is a **frozen reference** (see [`client/README.md`](client/README.md)).

```
backend/app/api/routes/v1_telemetry.py   POST /v1/telemetry/event -> JSONL sink, in the one API server (repo root; source of truth)
frontend/src/features/assessment/     maintained: 8 task screens, tracker, staircase / QUEST+, task source, ExerciseHost   (repo root)
client/                               frozen reference: the original standalone app, including the voice opt-in
```

**Voice is not shipped in the UI** (decision D1 in `.scratch/member1-ui-integration/spec.md`). The UI
always sends `voice_opt_in: false` and no voice fields. The voice toggle and probe exist only in the
frozen `client/`.

## Run

API (Python 3.13). The ingest lives in the one API server, `backend/app` (BE-00). From the repo root:

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # whole Python workspace; .venv/bin/pip on macOS/Linux
.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
```

`backend/app/main.py` mounts one router per module (`app/api/routes/v1_telemetry.py`, `v1_privacy.py`, `v1_auth.py`,
`dynamic_cache/api.py`, `ai_coach/api.py`, `brain_twin_jepa/api.py`). New routes go in the module's router, not in `main.py`.

Events go to the repo-root `data/raw/telemetry/` (gitignored), whatever the working directory.
Set `TELEMETRY_DIR` to override it, e.g. a scratch folder for testing.

UI (Node 24), in a second terminal:

```bash
cd frontend
npm install
npm run dev                         # http://localhost:5173 (or the next free port); proxies /v1 to :8000
VITE_USE_MOCKS=false npm run dev    # real mode: tasks come from GET /v1/tasks/next (Member 5)
```

- Mock tasks are the UI default (`VITE_USE_MOCKS` unset). Telemetry is real in both modes: events go to the API.
- Open `/task/<dimension id>`, e.g. `/task/inhibition_control` (Stroop) or `/task/episodic_pattern_separation` (MST).
  In mock mode, `?schema=<schema_type>` picks one of the dimension's exercises, e.g.
  `/task/visuospatial_planning_gf?schema=tower`. The "Evaluator controls" drawer at the bottom of the
  page has one "Exercise: …" button per exercise of the current dimension.
- Real mode ignores `dimId` and `?schema=`: the generator decides what comes next.

PowerShell: `$env:VITE_USE_MOCKS='false'; npm run dev` and `$env:TELEMETRY_DIR='C:\path\to\scratch'`.

Tests and checks:

```bash
.venv/Scripts/python -m pytest -q backend/tests   # API suite, from the repo root
.venv/Scripts/python -m pytest -q                 # from the repo root: every Python suite (root pytest.ini)
cd frontend && npm run qa:checks    # lint:tokens, lint:copy, check:contrast, vitest, build
cd frontend && npm run qa:e2e       # Playwright; its config uses the Chrome channel, so Chrome must be installed
```

The frozen `client/` still builds and runs on its own (`cd assessment_engine/client && npm run dev`;
`VITE_MOCK_TASKS=1` for mock tasks), but it is no longer maintained.

## Endpoints

- `POST /v1/telemetry/event` (ours): one event or a batch of up to 100. Returns `202 {"accepted": n}`.
  Unknown fields, bad ids, voice fields without opt-in, oversized or nested `trial_meta`, NaN/Infinity
  all get `422` before any file I/O.
- `GET /v1/tasks/next?user_id=...` (Member 5): returns `{ task_id, dimension, schema_type, params, surface_seed }`.

## Task payload contract (proposed to Member 5)

Every trial carries its verified `answer`; the client compares against it and never computes truth.
Staircased exercises send `levels: Trial[][]`, easiest first, and the client picks from `levels[staircase.level]`.

| dimension | schema_type | params |
|---|---|---|
| working_memory | `n_back` | `{ n, stimulus_ms, interval_ms, streams: ("position"\|"symbol")[], trials: { pos: [r,c]\|null, symbol: string\|null, rule: "position"\|"symbol"\|"parity", trial_type: "target"\|"standard"\|"lure_minus"\|"lure_plus"\|"switch", answer: { position?: boolean, symbol?: boolean } }[] }`. 3×3 grid. A `switch` trial shows the cue banner for the new rule. |
| executive_function | `stroop` | `{ colors: string[], trials: {word, ink, answer: string}[], time_limit_ms }`. Colours must be from `red`, `green`, `blue`, `yellow`: the UI maps only those to theme tokens; any other ink renders in the text colour and the trial becomes unanswerable. |
| pattern_induction | `matrix` | `{ cells: (Glyph\|null)[9] /* one null */, options: Glyph[], answer: number, time_limit_ms }`, `Glyph = {shape: "circle"\|"square"\|"triangle"\|"diamond", count: 1..3, color, rotation_deg}` |
| spatial_orientation | `mental_rotation` | `{ trials: {cells: [x,y][], angle_deg, mirrored, answer: "same"\|"different"}[], time_limit_ms }` |
| pattern_induction | `relational` | `{ n_trials, time_limit_ms, levels: { premises: {a, rel, b}[], question: {a, rel, b}, inverted: boolean, hops: number, answer: boolean }[][] }`. `rel` ∈ `same, opposite, more, less, before, after, contains`; `more`/`less` drawn as ▷/◁; tokens are nonsense strings. When `inverted`, the frame flashes amber and `answer` already accounts for it. |
| executive_function | `tower` | `{ capacities: number[], start: string[][], goal: string[][], l_min, optimal_moves: [from,to][], counter_intuitive: number[] /* indices into optimal_moves */, time_limit_ms? }`. `time_limit_ms` is per problem, counted from the move-count prediction; the client defaults to 60000 (TOL-F). On expiry the trial ends unsolved. |
| processing_speed | `ufov` | `{ duration_grid_ms: number[], similarity, mask_noise, trials: { central: "A"\|"B", peripheral_dir: 0..7, distractors: {dir, ring}[] }[] }`. `similarity` and `mask_noise` are fixed per block by Member 5. |
| episodic_memory | `mst` | `{ encode_ms, encode: Poly[], test: { item: Poly, kind: "old"\|"lure"\|"new", delta: number }[] }`, `Poly = {points: [x,y][], edges: [i,j][]}`, perturbation already applied by the generator |

Payloads are data only: rendered with SVG from numbers and strings, no `dangerouslySetInnerHTML`, `eval` or `new Function`.

## Telemetry event (one per trial)

Field names follow the top-level README `x_t` list. The server appends `received_at`.

| field | definition |
|---|---|
| `user_id`, `session_id` | anonymous per-browser UUID (localStorage `aura_uid`); one session UUID per page load. `[A-Za-z0-9_-]{1,64}` |
| `task_id`, `trial_index`, `dimension` | from the task payload; `dimension` is one of the six above |
| `score_norm` | 1/0 for correct/incorrect. Tower uses `min(1, l_min / l_user)`. Clamped to [0, 1] |
| `response_time_ms` | stimulus onset to committed response, or the trial window on timeout / non-response; capped at 600000 |
| `error_flag` | `true` when the trial was wrong |
| `error_burst` | length of the current run of consecutive errors within the task (0 when correct) |
| `hesitation_jitter` | population std-dev (ms) of intervals between input timestamps (keydown, pointerdown, pointermove throttled to 50 ms); 0 with fewer than 3 inputs |
| `keystroke_latency_ms` | onset to first keydown or pointerdown, or `null` |
| `trial_meta` | flat map, ≤16 keys, values are short strings / numbers / booleans (table below) |
| `voice_opt_in` | always `false` from the UI (voice is not shipped, D1). Only the frozen `client/` can send `true` |
| `voice_latency_ms`, `vocal_pace_hz` | absent from UI events. The frozen `client/` sends them on Stroop only, and only with `voice_opt_in` |
| `client_ts` | ISO timestamp when the trial finished |

Events are buffered and flushed every 2 s (or at 20 events) without blocking the trial loop. On
`pagehide` or when the page becomes hidden, the buffer goes out via `sendBeacon`. Network errors,
5xx, 408 and 429: events stay buffered and retry. Any other 4xx means the server will never accept
that batch, so it is dropped with a `console.error`. The buffer is capped at 500 and drops the oldest.
In the UI the buffer is also mirrored to `localStorage` (`synapsetwin_telemetry_queue_v2`), so
pending events survive a reload, and the Privacy page's purge empties it (`tracker.clear()`).

Delivery is at-least-once (a retried or beaconed batch may arrive twice); dedupe on
`(session_id, trial_meta.item_id, trial_meta.stream)`.

### `trial_meta` by schema_type

| schema_type | trial_meta |
|---|---|
| all | `item_id` (`${task_id}:${index}`), plus `level` (number) when staircased |
| n_back | `trial_type`, `rule`, `stream` (one event **per stream** per trial) |
| stroop | `congruent` (word names the ink colour) |
| mental_rotation | `angle_deg` (number), `mirrored` (boolean) |
| relational | `hops`, `inverted` |
| tower | `l_min`, `l_user`, `predicted_moves`, `planning_time_ms`, `conflict_latency_ms` (mean pause before moves matching a `counter_intuitive` step, 0 if none), `solved` |
| ufov | `requested_ms`, `shown_ms` (measured), `frames`, `similarity`, `mask_noise`, `central_ok`, `peripheral_ok` |
| mst | `kind`, `delta`, `response` (`old`/`similar`/`new`, or `none` on timeout) |

UFOV rounds the requested duration to whole display frames and logs the measured `shown_ms`; QUEST+
is updated with `shown_ms`, not the requested value. QUEST+ estimates the display-duration threshold
(`quest_threshold_ms`); it picks the most informative duration each trial and does not hold accuracy
at 85%. The 85% target applies to Relational's weighted staircase.

## Privacy

- Non-biometric by default: reaction time, error bursts, keystroke latency, hesitation jitter. No raw
  audio or video, no face data.
- Voice is not shipped in the UI (D1): the UI never asks for the microphone. In the frozen `client/`,
  voice is opt-in, off on every page load and never persisted; when on, the microphone is analysed in
  the browser and only two numbers (`voice_latency_ms`, `vocal_pace_hz`) are sent. No audio samples
  leave the browser; the server rejects voice fields without `voice_opt_in` and any unknown field.
- User-facing text never names brain regions or uses diagnostic words.

## Open questions for the team

1. **Field names** (Member 3): the top-level README has two `x_t` versions; we use `score_norm`,
   `response_time_ms`, `error_flag`, `hesitation_jitter`. Agree on those and on `trial_meta`.
2. **New dimensions** (Members 3, 4): `processing_speed` (UFOV) and `episodic_memory` (MST) add two
   radar axes and two model inputs.
3. **Payload contract** (Member 5): produce the `answer`s, `levels` ladders and Tower
   `optimal_moves`/`counter_intuitive` with your solvers. Answers in the payload are readable in
   devtools; fine for non-clinical self-training, move scoring server-side if that ever matters.
4. **85% rule granularity**: per-trial 85% adaptation for Relational only; UFOV adapts per trial
   too, but to estimate a duration threshold (QUEST+), not to hold 85%. N-back `n` and lure
   density can only change between blocks, so Member 5 adapts them from our telemetry. MST keeps a
   fixed spread of `delta` for the tuning curve.
5. **Shared FastAPI app**: does Member 4 own `main.py`? Their delete route removes
   `{TELEMETRY_DIR}/{user_id}.jsonl`.
6. **Identity**: anonymous per-browser UUID for now; no accounts.
7. **Science wording**: keep brain-region names and "neuroplastic" claims out of the UI.
