# Member 1: Assessment Execution & Telemetry Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser app that renders the README's 4 assessment tests plus the brief's 5 training exercises from task JSON. It adapts difficulty in-browser toward 85% accuracy and captures non-biometric per-trial telemetry, including the exercise-specific data later scoring needs, without blocking the UI. That telemetry is posted to `POST /v1/telemetry/event`, which validates it and appends it to a per-user log that Member 3 reads.

**Architecture:** The client is a "dumb renderer". Each payload spells out every stimulus **and its verified answer**. Generators and solvers belong to Member 5 / the coach, so the client never generates or verifies puzzles and never executes code from a payload. Every trial goes through one `TrialRecorder`, which produces the core fields plus a small `trial_meta` object. A `Tracker` buffers events and flushes them asynchronously (`fetch`, falling back to `sendBeacon` on page hide). Per-trial adaptation (weighted staircase, QUEST+) runs client-side because a server round-trip per trial would add lag. The server is one FastAPI route with a strict Pydantic model that appends JSON lines to `data/raw/telemetry/{user_id}.jsonl`. That file is the ingestion queue for Member 3 and is easy to delete for Member 4.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest + httpx. Node 20+, Vite + React 18 + TypeScript, Vitest + @testing-library/react + jsdom.

**Spec:** `README.md` → "Member 1" section and the interfaces table, plus the team brief "AI-Generated Training Exercises" (§4) and the "End-to-End Agent Loop" (§5). §4–5 **add to** the README tests; they do not replace them.

## Global Constraints

- Non-biometric by default: allowed signals are reaction time, error bursts, keystroke latency, and hesitation jitter. No raw audio or video, no face data, and no audio samples ever leave the browser.
- Voice latency and vocal pacing are opt-in and off by default. They are computed in-browser and only the numbers are sent.
- Endpoints: `POST /v1/telemetry/event` (ours). `GET /v1/tasks/next` returns `{ task_id, dimension, schema_type, params, surface_seed }` (Member 5's).
- Dimensions are the README 4 (`working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`) plus `processing_speed` (UFOV) and `episodic_memory` (MST). **Confirm the two new ones with Members 3 and 4.**
- Event field names follow the README `x_t` list: `score_norm`, `response_time_ms`, `error_flag`, `hesitation_jitter`.
- Payloads are data only. Render with SVG/canvas from numbers and strings. No `dangerouslySetInnerHTML`, `eval`, or `new Function`.
- Adaptive target accuracy is 0.85 (the brief's 80–85% band, using the "85% rule").
- User-facing text never names brain regions or uses diagnostic words. Those belong to Member 2's guardrails; the UI copy is ours.
- Trial loops never `await` the network.
- All code lives under `assessment_engine/`. The README's `src/client/...` and `src/api/...` paths are mirrored inside it.

## Review Focus

1. **Tab closed mid-exercise.** Buffered events must still go out via `sendBeacon` on `pagehide`. Test in Task 3.
2. **API down or offline.** Events stay buffered and retry. The buffer is capped at 500 and drops the oldest. Test in Task 3.
3. **Hostile input at the endpoint.** A `user_id` like `../x` becomes a filename, an unknown field like `audio_b64` could carry biometric data, voice fields might arrive without opt-in, and `trial_meta` might be nested or oversized. All return 422 before any file I/O. Test in Task 1.
4. **Held-down key or double press.** Key-repeat must not register as two responses, and only the first response per stream per trial counts. Test in Task 5.
5. **UFOV on a 120 Hz or slow display.** The requested duration (e.g. 50 ms) is not what gets shown. The renderer must round to whole frames and log the measured `shown_ms`, and QUEST+ must be updated with `shown_ms`, not the requested value. Test in Task 11.

---

## File Structure

```
assessment_engine/
  api/
    requirements.txt, main.py
    routes/telemetry.py         TelemetryEvent model + POST /v1/telemetry/event + JSONL sink
    tests/test_telemetry.py
  client/
    package.json, vite.config.ts (proxy /v1 -> :8000), index.html, tsconfig.json
    src/main.tsx, src/App.tsx   session loop
    src/telemetry/types.ts      event + payload types
    src/telemetry/metrics.ts    hesitationJitter, nextErrorBurst
    src/telemetry/tracker.ts    TrialRecorder + Tracker
    src/adaptive/staircase.ts   WeightedStaircase (85% target)
    src/adaptive/quest.ts       QuestPlus over display duration
    src/tasks/taskSource.ts, fixtures.json, TaskRunner.tsx
    src/tasks/NBack.tsx         interference + rule-switch + dual stream
    src/tasks/Stroop.tsx, Matrix.tsx, MentalRotation.tsx      README assessments
    src/tasks/Relational.tsx, Tower.tsx, Ufov.tsx, Mst.tsx    brief exercises
    src/tasks/svg.tsx           shared GlyphView / PolyView / GraphView renderers
    src/voice/voiceProbe.ts, VoiceToggle.tsx
    src/**/*.test.ts(x)
```

## Task payload contract (proposed to Member 5)

Every trial carries its verified `answer`, so the client compares against it and never computes truth. Staircased exercises send `levels: Trial[][]`, easiest first, and the client picks from `levels[staircase.level]`.

| dimension | schema_type | params |
|---|---|---|
| working_memory | `n_back` | `{ n, stimulus_ms, interval_ms, streams: ("position"\|"symbol")[], trials: { pos: [r,c]\|null, symbol: string\|null, rule: "position"\|"symbol"\|"parity", trial_type: "target"\|"standard"\|"lure_minus"\|"lure_plus"\|"switch", answer: { position?: boolean, symbol?: boolean } }[] }`. The grid is 3×3. A `switch` trial shows the cue banner for the new rule. |
| executive_function | `stroop` | `{ colors: string[], trials: {word, ink, answer: string}[], time_limit_ms }` |
| pattern_induction | `matrix` | `{ cells: (Glyph\|null)[9] /* one null */, options: Glyph[], answer: number, time_limit_ms }`, where `Glyph = {shape: "circle"\|"square"\|"triangle"\|"diamond", count: 1..3, color, rotation_deg}` |
| spatial_orientation | `mental_rotation` | `{ trials: {cells: [x,y][], angle_deg, mirrored, answer: "same"\|"different"}[], time_limit_ms }` |
| pattern_induction | `relational` | `{ n_trials, time_limit_ms, levels: { premises: {a, rel, b}[], question: {a, rel, b}, inverted: boolean, hops: number, answer: boolean }[][] }`, where `rel` ∈ `same, opposite, more, less, before, after, contains`, `more`/`less` are drawn as ▷/◁, and tokens are nonsense strings. When `inverted`, the frame flashes amber; `answer` already accounts for the inversion. |
| executive_function | `tower` | `{ capacities: number[], start: string[][], goal: string[][], l_min, optimal_moves: [from,to][], counter_intuitive: number[] /* indices into optimal_moves */ }` |
| processing_speed | `ufov` | `{ duration_grid_ms: number[], similarity, mask_noise, trials: { central: "A"\|"B", peripheral_dir: 0..7, distractors: {dir, ring}[] }[] }`. `similarity` and `mask_noise` are fixed per block by Member 5 (see Task 9). |
| episodic_memory | `mst` | `{ encode_ms, encode: Poly[], test: { item: Poly, kind: "old"\|"lure"\|"new", delta: number }[] }`, where `Poly = {points: [x,y][], edges: [i,j][]}` and the generator has already applied the perturbation |

## Telemetry: one event per trial

Core fields:
- `score_norm`: 1/0 for correct/incorrect. Tower uses `l_min / l_user` instead.
- `response_time_ms`: time from stimulus onset to the committed response, or the trial window on timeout or non-response.
- `keystroke_latency_ms`: time from onset to the first keydown or pointerdown, or `null`.
- `hesitation_jitter`: population std-dev (ms) of the intervals between input timestamps (keydown, pointerdown, pointermove throttled to 50 ms). It is 0 when there are fewer than 3 inputs.
- `error_burst`: length of the current run of consecutive errors within the task (0 when correct).

`trial_meta` keys by schema_type. These are exactly what Member 3 needs for d′, ms-per-hop slope, optimality, QUEST+ threshold, the tuning curve, and IRT/DDM:

| schema_type | trial_meta |
|---|---|
| all | `item_id` (string, `${task_id}:${index}`), plus `level` (number) when staircased |
| n_back | `trial_type`, `rule`, `stream` (one event **per stream** per trial) |
| relational | `hops`, `inverted` |
| tower | `l_min`, `l_user`, `predicted_moves`, `planning_time_ms`, `conflict_latency_ms` (mean pause before moves matching a `counter_intuitive` step, 0 if none), `solved` |
| ufov | `requested_ms`, `shown_ms`, `frames`, `similarity`, `mask_noise`, `central_ok`, `peripheral_ok` |
| mst | `kind`, `delta`, `response` (`old`/`similar`/`new`) |

---

### Task 1: Ingestion endpoint

**Files:** Create `assessment_engine/api/{requirements.txt, main.py, routes/__init__.py, routes/telemetry.py}`. Test `assessment_engine/api/tests/test_telemetry.py`.

**Interfaces:**
- Produces: `class TelemetryEvent(BaseModel)` with `ConfigDict(extra="forbid")`:
  `user_id`, `session_id` (both pattern `^[A-Za-z0-9_-]{1,64}$`), `task_id: str (1..128)`, `trial_index: int >= 0`,
  `dimension: Literal[<6 dimensions above>]`, `score_norm: float in [0,1]`, `response_time_ms: float in [0, 600000]`, `error_flag: bool`, `error_burst: int >= 0`, `hesitation_jitter: float >= 0`, `keystroke_latency_ms: float >= 0 | None = None`,
  `trial_meta: dict[str, str | int | float | bool] = {}`, with keys matching `^[a-z0-9_]{1,32}$`, at most 16 keys, and string values of at most 64 chars,
  `voice_opt_in: bool = False`, `voice_latency_ms: float >= 0 | None = None`, `vocal_pace_hz: float >= 0 | None = None`, `client_ts: datetime`.
  A `model_validator` raises if either voice field is non-null while `voice_opt_in` is False.
- Produces: `POST /v1/telemetry/event`. The body is one event or `list[TelemetryEvent]` (max 100). It returns `202 {"accepted": n}` and appends one JSON line per event, plus `received_at` (UTC ISO), to `{TELEMETRY_DIR}/{user_id}.jsonl`. `TELEMETRY_DIR` comes from env (read per request) and defaults to `data/raw/telemetry`.

- [ ] **Step 1: Failing tests** (`monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path))`)

```python
def test_single_event_appended(client, tmp_path):
    r = client.post("/v1/telemetry/event", json=EVENT)
    assert r.status_code == 202 and r.json() == {"accepted": 1}
    line = json.loads((tmp_path / "u1.jsonl").read_text().splitlines()[0])
    assert line["score_norm"] == 1.0 and "received_at" in line

def test_batch_accepted(client):                 # 3 events -> {"accepted": 3}, 3 lines
def test_batch_over_100_rejected(client):        # 101 -> 422
def test_path_traversal_user_id_rejected(client, tmp_path):  # "../x" -> 422, tmp_path empty
def test_extra_field_rejected(client):           # + {"audio_b64": "AAAA"} -> 422
def test_voice_without_opt_in_rejected(client):  # voice_latency_ms=300 -> 422
def test_voice_with_opt_in_accepted(client):     # + voice_opt_in True -> 202
def test_new_dimensions_accepted(client):        # "processing_speed", "episodic_memory" -> 202
def test_bad_dimension_rejected(client):         # "memory" -> 422
def test_score_out_of_range_rejected(client):    # 1.5 -> 422
def test_trial_meta_scalars_accepted(client):    # {"hops": 3, "inverted": True, "kind": "lure"} -> 202
def test_trial_meta_nested_rejected(client):     # {"x": {"y": 1}} -> 422
def test_trial_meta_too_many_keys_rejected(client):  # 17 keys -> 422
def test_trial_meta_bad_key_rejected(client):    # {"Bad-Key": 1} -> 422
```

- [ ] **Step 2:** `cd assessment_engine/api && pip install -r requirements.txt && pytest -q`. Expected: FAIL.
- [ ] **Step 3:** Implement. Add `# ponytail: single-line appends are fine for one uvicorn worker; Redis Streams if multiple workers.`
- [ ] **Step 4:** `pytest -q`. Expected: 14 passed.
- [ ] **Step 5:** Commit `feat(assessment_engine): telemetry ingestion endpoint with strict non-biometric schema`

### Task 2: Client scaffold, types, metrics

**Files:** Vite React-TS project in `assessment_engine/client/` with dev deps `vitest jsdom @testing-library/react @testing-library/user-event`, `test.environment = "jsdom"`, and proxy `/v1 → http://localhost:8000`. Create `src/telemetry/types.ts` and `src/telemetry/metrics.ts`. Test `src/telemetry/metrics.test.ts`.

**Interfaces:**
- `types.ts`: `Dimension`, `TelemetryEvent` (snake_case, mirrors Task 1), `TrialMeta = Record<string, string | number | boolean>`, `TaskPayload = { task_id; dimension; schema_type: "n_back"|"stroop"|"matrix"|"mental_rotation"|"relational"|"tower"|"ufov"|"mst"; params: unknown; surface_seed: number }`, and one `*Params` type per row of the contract table, plus `Glyph`, `Poly`.
- `metrics.ts`: `hesitationJitter(inputTimes: number[]): number`, `nextErrorBurst(prev: number, correct: boolean): number`.

- [ ] **Step 1: Failing tests**

```ts
expect(hesitationJitter([])).toBe(0);
expect(hesitationJitter([0, 100])).toBe(0);
expect(hesitationJitter([0, 100, 200, 300])).toBe(0);
expect(hesitationJitter([0, 100, 400])).toBeCloseTo(100); // intervals 100,300
expect(nextErrorBurst(2, false)).toBe(3);
expect(nextErrorBurst(2, true)).toBe(0);
```

- [ ] **Step 2–4:** `npx vitest run` → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): client scaffold and telemetry metrics`

### Task 3: TrialRecorder + Tracker

**Files:** `src/telemetry/tracker.ts`, `src/telemetry/tracker.test.ts`.

**Interfaces:**
- `class TrialRecorder { constructor(ctx: {user_id; session_id; task_id; dimension; voice_opt_in: boolean}, now = () => performance.now()); start(trialIndex: number): void; input(): void; finish(r: {correct: boolean; score?: number; windowMs?: number; meta?: TrialMeta; voice?: {voice_latency_ms: number|null; vocal_pace_hz: number|null}}): TelemetryEvent; abort(): void }`.
  `score` overrides the 1/0 `score_norm` (used by Tower). `windowMs` replaces the measured RT. `trial_meta = {item_id: \`${task_id}:${trialIndex}\`, ...meta}`. `input()` is ignored when no trial is active. Tasks call `abort()` on `visibilitychange` → hidden.
- `class Tracker { constructor(opts: {endpoint? = "/v1/telemetry/event"; flushMs? = 2000; batchSize? = 20; maxBuffer? = 500; fetchFn?; beacon?}); push(e): void; flush(): Promise<void>; flushBeacon(): void; destroy(): void }`. It never awaits in `push`, POSTs at most 100 events per request as a JSON array, re-queues on failure, beacons on `pagehide`, and drops the oldest on overflow. `export const tracker = new Tracker()`.

- [ ] **Step 1: Failing tests** (fake `now`, fake `fetchFn`, fake timers)

```ts
test("finish computes rt, latency, jitter, burst")  // inputs @100,200,400, finish(false)@500 -> rt 500, latency 100, jitter 50, burst 1, score 0
test("timeout uses windowMs")                       // finish({correct:false, windowMs:3000}) -> rt 3000, latency null
test("score override and meta merge")               // finish({correct:false, score:0.6, meta:{l_min:5}}) -> score_norm 0.6, trial_meta {item_id:"t1:0", l_min:5}
test("abort emits nothing")                         // start, abort, finish throws
test("push flushes at batchSize")                   // 20 pushes -> one fetch with 20 events
test("failed flush keeps events for retry")
test("buffer caps at maxBuffer dropping oldest")    // maxBuffer 3, push 5 offline -> events 3,4,5
test("pagehide sends beacon")                       // 2 buffered -> beacon called with 2-item JSON
```

- [ ] **Step 2–4:** `npx vitest run src/telemetry` → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): non-blocking telemetry tracker with beacon fallback`

### Task 4: Task source, fixtures, runner, session loop

**Files:** `src/tasks/taskSource.ts`, `src/tasks/fixtures.json`, `src/tasks/TaskRunner.tsx`, `src/tasks/svg.tsx`, modify `src/App.tsx`. Test `src/tasks/taskSource.test.ts`.

**Interfaces:**
- `fetchNextTask(userId: string, fetchFn = fetch): Promise<TaskPayload>` calls `GET /v1/tasks/next?user_id=...`. With `VITE_MOCK_TASKS=1` it cycles through `fixtures.json`. A non-2xx response throws.
- `getUserId(): string` is an anonymous `crypto.randomUUID()` kept in `localStorage["aura_uid"]` (try/catch, fresh ID if storage throws).
- `<TaskRunner task recorder onDone />` switches on `schema_type`. Every task component takes `{ params; recorder: TrialRecorder; onDone: () => void }` and calls `tracker.push(recorder.finish(...))` per trial.
- `svg.tsx`: `GlyphView({glyph})` (count × shape, `aria-label` like "2 blue triangles"), `PolyView({poly, size})` (lines plus node circles), `CellsView({cells, angle_deg, mirrored})`.
- `App.tsx`: `session_id` per page load, then fetch → run → next. On a fetch error, show a message and a retry button.

- [ ] **Step 1: Failing tests:** mock mode cycles fixtures and wraps around. Real mode hits `/v1/tasks/next?user_id=u1`. A 500 rejects. `fixtures.json` has one valid entry per schema_type (all 8). Each fixture trial has an `answer`. The matrix has exactly one `null` cell.
- [ ] **Step 2–4:** Run → FAIL → implement (unknown `schema_type` renders "Unsupported task" and calls `onDone`) → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): task source with mock fixtures and session loop`

### Task 5: Interference N-back with rule switching (working_memory)

**Files:** `src/tasks/NBack.tsx`, `src/tasks/NBack.test.tsx`.

Behavior: a 3×3 grid lights `pos` and a centre glyph shows `symbol` for `stimulus_ms`, with each trial lasting `interval_ms`. Response keys: `A` = position match and `L` = symbol match. In a `parity` rule, `L` means "even". On `trial_type: "switch"`, a banner names the new rule for the whole trial. Each trial emits **one event per stream in `streams`**: correct = (pressed === `answer[stream]`), and no press uses `windowMs = interval_ms`. Meta is `{trial_type, rule, stream}`. Keydown with `e.repeat` is ignored, and only the first press per stream per trial counts.

- [ ] **Step 1: Failing tests** (fake timers, spy `tracker.push`):
  - 3 dual-stream trials → 6 events, each with `trial_meta.stream` set.
  - Pressing `A` on a `lure_minus` trial whose `answer.position` is false gives a position event with `score_norm 0` and `trial_type "lure_minus"`.
  - A held `A` (repeat events) produces one response.
  - A `switch` trial renders the rule banner.
  - `onDone` fires after the last trial.
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): interference N-back with lures and rule switching`

### Task 6: Stroop, matrix, and mental rotation (README assessments)

**Files:** `src/tasks/{Stroop,Matrix,MentalRotation}.tsx` and a `.test.tsx` for each.

All three: one event per trial, correct = response === `answer`, and a timeout calls `finish({correct:false, windowMs: time_limit_ms})`.
- **Stroop:** the word is shown in `ink`. There is one button per color, labelled with its name (not color alone), on keys `1..9`.
- **Matrix:** a 3×3 grid of `GlyphView` with "?" in the empty cell and the options below.
- **Mental rotation:** `CellsView` original on the left, transformed on the right. `F` = same, `J` = different.

- [ ] **Step 1: Failing tests:**
  - Stroop: `{word:"RED", ink:"blue", answer:"blue"}`, clicking blue → 1 and red → 0. A timeout gives `response_time_ms === time_limit_ms`. Two errors in a row → `error_burst 2`.
  - Matrix: clicking `options[answer]` → 1, and the grid has 8 glyphs + "?".
  - Rotation: `J` on a `different` trial → 1.
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): Stroop, matrix and mental rotation assessments`

### Task 7: Adaptive engines (staircase + QUEST+)

**Files:** `src/adaptive/staircase.ts`, `src/adaptive/quest.ts`, and a `.test.ts` for each.

**Interfaces:**
- `class WeightedStaircase { constructor(nLevels: number, target = 0.85, step = 1, start = 0); get level(): number; update(correct: boolean): void }`. This is a weighted up-down staircase (Kaernbach). Correct → `x += step`, error → `x -= step * target / (1 - target)`, and `x` is clamped to `[0, nLevels-1]`. `level = Math.round(x)`. The rule balances where accuracy equals `target`.
- `class QuestPlus { constructor(durationsMs: number[], opts?: {thresholds?: number[]; slopes?: number[]; guess?: number /* 1/16 */; lapse?: number /* 0.02 */}); next(): number; update(shownMs: number, correct: boolean): void; thresholdMs(): number }`.
  The model is `p(d) = guess + (1-guess-lapse)·(1 - exp(-(d/θ)^β))`, where θ is a log-spaced grid over 17–500 ms and β ∈ {1,2,3,4}. The posterior starts uniform over (θ, β). `next()` returns the grid duration that minimizes the expected posterior entropy over both outcomes. `update` uses the actual `shownMs`, not snapped to the grid. `thresholdMs()` is the posterior mean of θ.
  `// ponytail: QUEST+ over duration only; similarity and mask_noise step per block (Member 5). Full 3-D stimulus space if the team needs it.`

- [ ] **Step 1: Failing tests:**
  - Staircase: start 20 of 40 levels, then 17 correct + 3 errors in any order → `level === 20`. These starting values mean no order hits a clamp.
  - Staircase: it never goes below 0 or above `nLevels-1`.
  - QUEST+: `next()` is always a member of `durationsMs`.
  - QUEST+: a simulated observer with θ = 80 ms (seeded PRNG, 80 trials) gives `thresholdMs()` within [50, 130].
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): weighted staircase and QUEST+ adaptive engines`

### Task 8: Relational reasoning (RFT, pattern_induction)

**Files:** `src/tasks/Relational.tsx`, `src/tasks/Relational.test.tsx`.

**Consumes:** `WeightedStaircase(levels.length)`.

Behavior: run `n_trials` trials. Each one takes the next unused trial from `levels[staircase.level]`, wrapping around if that level runs out. It shows the premises as sentences ("ZUP is SAME as KEV", "MIB ▷ ZUP") and the question, with True (`T`) and False (`F`) buttons. If `inverted`, the frame has an amber border with an accessible text label "Rule inverted". Correct = response === `answer`. Meta is `{hops, inverted, level}`. Call `staircase.update(correct)` after each trial.

- [ ] **Step 1: Failing tests:**
  - Answering correctly 3 times in a row moves the shown trials to a higher level (check `trial_meta.level`).
  - An inverted trial shows the "Rule inverted" label.
  - An event carries `hops` from the trial.
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): relational reasoning exercise with staircase`

### Task 9: Tower planning (executive_function)

**Files:** `src/tasks/Tower.tsx`, `src/tasks/Tower.test.tsx`.

Behavior: show the start and goal stacks. **Manipulation stays locked** until the user enters a predicted move count; the time spent before that is `planning_time_ms`. A move = click a source peg, then a destination peg. Illegal moves (empty source, full destination) are rejected and not counted. After each move, check whether the stacks deep-equal `goal`. The trial ends when they do, or after `3 × l_min` moves (unsolved). `finish({correct: l_user === l_min, score: solved ? l_min / l_user : 0, meta: {l_min, l_user, predicted_moves, planning_time_ms, conflict_latency_ms, solved}})`. `conflict_latency_ms` = mean pause before user moves that equal `optimal_moves[i]` for some `i` in `counter_intuitive`.

- [ ] **Step 1: Failing tests:**
  - Pegs are locked until a prediction is entered.
  - Playing `optimal_moves` exactly → `score_norm 1`, `l_user === l_min`.
  - One wasted move pair → `score_norm = l_min / (l_min + 2)`.
  - A move onto a full peg is ignored.
  - A pause of 400 ms before the counter-intuitive move → `conflict_latency_ms 400`.
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): tower planning exercise`

### Task 10: Mnemonic similarity (episodic_memory)

**Files:** `src/tasks/Mst.tsx`, `src/tasks/Mst.test.tsx`.

Behavior: the encoding phase shows each `encode` item via `PolyView` for `encode_ms` with no response and no events. The test phase then shows each `test.item` with Old (`1`), Similar (`2`) and New (`3`). Correct = response matches `kind` (lure → similar). Meta is `{kind, delta, response}`. There is no staircase here: the tuning curve needs the generator's spread of `delta` values.

- [ ] **Step 1: Failing tests:**
  - No events are emitted during encoding.
  - A lure with response "similar" → 1, and with "old" → 0 with `trial_meta.response "old"`.
  - Events carry `delta`.
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): mnemonic similarity exercise`

### Task 11: UFOV divided attention (processing_speed)

**Files:** `src/tasks/Ufov.tsx`, `src/tasks/Ufov.test.tsx`.

**Consumes:** `QuestPlus(duration_grid_ms)`.

**Interfaces:** `measureFrameMs(raf = requestAnimationFrame, n = 30): Promise<number>` returns the median frame interval. `framesFor(requestedMs: number, frameMs: number): number` = `max(1, round(requestedMs / frameMs))`.

Behavior: calibrate the frame interval once at mount. Each trial: `requested = quest.next()`. Draw on a canvas the central glyph (A or B), the peripheral target at `peripheral_dir`, and the distractors, all on rAF. Keep them up for `framesFor` frames, then draw a noise mask at `mask_noise`. `shown_ms` = rAF timestamp of the mask minus that of the stimulus. Then ask for the central identity (`A`/`B` buttons) and the peripheral location (click 1 of 8 spokes). Correct = both right. `quest.update(shown_ms, correct)`. Meta is `{requested_ms, shown_ms, frames, similarity, mask_noise, central_ok, peripheral_ok}`. At the end, add `quest_threshold_ms` to the last event's meta.

- [ ] **Step 1: Failing tests** (fake rAF that advances 8.33 ms per frame to simulate 120 Hz):
  - `framesFor(50, 16.67) === 3` and `framesFor(5, 16.67) === 1`.
  - At 120 Hz with a 50 ms request: 6 frames, `shown_ms ≈ 50`.
  - `quest.update` receives `shown_ms`, not `requested_ms` (spy).
  - Getting the central right and the peripheral wrong → score 0, `central_ok true`.
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): frame-locked UFOV exercise with QUEST+`

### Task 12: Voice opt-in (latency and pacing, no recording)

**Files:** `src/voice/voiceProbe.ts`, `src/voice/VoiceToggle.tsx`, `src/voice/voiceProbe.test.ts`. Modify `App.tsx` to render the toggle and set `voice_opt_in` in the recorder ctx. Modify `Stroop.tsx` to pass `voice: probe.measure()` when opted in.

**Interfaces:**
- `detectOnsets(rms: number[], frameMs: number, threshold = 0.02, minGapMs = 150): number[]`.
- `class VoiceProbe { static start(): Promise<VoiceProbe>; markOnset(): void; measure(): {voice_latency_ms; vocal_pace_hz}; stop(): void }`. It uses `getUserMedia({audio:true})` → `AnalyserNode` → RMS numbers only. **No `MediaRecorder`, no kept sample buffers, no network calls.**
- `<VoiceToggle value onChange />` is off by default. Its label reads "Optional: measure speaking speed. Audio never leaves your device and is not recorded." If permission is denied it reverts to off and shows why.

- [ ] **Step 1: Failing tests:**
  - Silence → `[]`.
  - Spikes at frames 10 and 12 (frameMs 16) → `[160]`.
  - Spikes 20 frames apart → 2 onsets.
  - The source of `voiceProbe.ts` contains neither `MediaRecorder` nor `fetch(`.
- [ ] **Step 2–4:** Run → FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(assessment_engine): opt-in non-biometric voice latency probe`

### Task 13: End-to-end smoke

- [ ] **Step 1:** `cd assessment_engine/api && uvicorn main:app --port 8000` and `cd assessment_engine/client && VITE_MOCK_TASKS=1 npm run dev`.
- [ ] **Step 2:** Complete all 8 fixtures. Run again and close the tab mid-N-back.
- [ ] **Step 3:** Check `data/raw/telemetry/<uid>.jsonl`:
  - It has events for all 6 dimensions, including the trials from just before the tab closed.
  - Every event has `trial_meta.item_id`.
  - UFOV events have a `shown_ms` that is a multiple of the frame interval.
  - Voice fields are `null` unless the toggle was on.
  - No audio data appears anywhere.
- [ ] **Step 4:** Write `assessment_engine/README.md` with the run commands and the payload, telemetry, and `trial_meta` tables. Commit `docs(assessment_engine): run instructions and contracts`.

---

## Open questions for the team

1. **Field names:** the README `x_t` has two versions; this plan uses `score_norm/response_time_ms/error_flag/hesitation_jitter`. Member 3 needs to agree, and also agree to `trial_meta`.
2. **New dimensions:** `processing_speed` and `episodic_memory` would add two radar axes for Member 4 and two model inputs for Member 3.
3. **Payload contract:** Member 5 has to produce the `answer`s, `levels` ladders, and Tower `optimal_moves`/`counter_intuitive` with their solvers. Because answers are in the payload, a user could read them in devtools. That's acceptable for non-clinical self-training; if it ever matters, move scoring server-side.
4. **85% rule granularity:** adaptation is per trial for Relational (staircase) and UFOV (QUEST+). For N-back, `n` and lure density can only change between blocks, so Member 5 adapts those from our telemetry. MST keeps a fixed spread of `delta` because the tuning curve needs it.
5. **Shared FastAPI app:** decide whether Member 4 owns `main.py`. Their delete route removes `{TELEMETRY_DIR}/{user_id}.jsonl`.
6. **Identity:** an anonymous UUID for now.
7. **Science wording:** keep brain-region names and "neuroplastic" claims out of the UI (see the review notes on the brief).
