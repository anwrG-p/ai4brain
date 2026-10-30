# Understanding my work: Member 1, Assessment Execution & Telemetry

This guide explains what I built, how the pieces fit together, and why each design choice was made. If you only read one section, read "The big picture".

> Other files cover different needs:
> - [`README.md`](README.md): exact contracts and run commands.
> - [`HANDOVER.md`](HANDOVER.md): what teammates need to know.
>
> This file is the explanation.

---

## 1. The big picture

The platform (CISTAC / SynapseTwin) is a **closed loop** that measures how someone thinks, models it, and adapts what they practise next:

```
 ┌──────────────── Member 1 (me) ────────────────┐
 │  Browser: shows an exercise → records how the │
 │  user responds (speed, errors, hesitation)    │
 └───────────────┬───────────────────────────────┘
                 │ telemetry events  (POST /v1/telemetry/event)
                 ▼
        Member 3: Brain Twin model + clustering
                 │ "this user is archetype k"
       ┌─────────┴──────────┐
       ▼                    ▼
 Member 5: picks the   Member 2: AI coach
 next exercise         explains changes
       │                    │
       │ task JSON          ▼
       │ (GET /v1/tasks/next)   Member 4: dashboard
       └──────► back to me (Member 1)
```

My job has two halves:
1. **Execution:** render each exercise Member 5 sends, take the user's answers, and know whether each answer was right.
2. **Telemetry:** turn every trial into one small, clean, **non-biometric** event and get it to the server reliably, without ever making the UI lag.

Everything I built is in `assessment_engine/`, except the maintained client, which lives in the UI app:

| Folder | Role |
|---|---|
| `api/` | Python **FastAPI** server that **receives** telemetry and saves it |
| `frontend/src/features/assessment/` (repo root) | **The maintained client**: the 8 exercises, the tracker and the task source, running inside the team UI (SynapseTwin) at `/task/:dimId` |
| `client/` | **Frozen reference**: the original standalone React + TypeScript app (Vite). Only it has the voice opt-in |
| `README.md` | Contracts + run commands |
| `HANDOVER.md` | Notes for teammates' agents |

---

## 2. One trial, end to end

Following a single answer through the system is the fastest way to understand the code:

1. **`ExerciseHost.tsx`** (mounted by the UI's `TaskRunnerPage`) asks `taskSource.ts` for the next task (`GET /v1/tasks/next`, or a built-in fixture in mock mode). In the frozen `client/`, `App.tsx` plays this role.
2. **`TaskRunner.tsx`** looks at `schema_type` (e.g. `"stroop"`) and mounts the matching screen (`Stroop.tsx`).
3. The screen calls **`recorder.start(i)`** when the stimulus appears. That moment is time zero.
4. While the user thinks, **`useInputCapture`** quietly records every key press, mouse press and (throttled) mouse movement into the recorder. That data becomes *hesitation* and *keystroke latency*.
5. The user answers. The screen compares the answer with the **correct answer that came inside the task JSON** (the client never works out the truth itself) and calls **`recorder.finish({correct, meta})`**.
6. `finish()` builds one **telemetry event** and hands it to **`tracker.push(event)`**. `push` returns instantly: no waiting on the network.
7. The **Tracker** batches events and sends them every 2 s, or when 20 are waiting, or when the page is hidden or closed (via `sendBeacon`).
8. On the server, **`routes/telemetry.py`** validates the batch strictly and appends one JSON line per event to `data/raw/telemetry/<user_id>.jsonl`.
9. Member 3 reads those files.

---

## 3. The server (`api/`)

There is one endpoint: `POST /v1/telemetry/event`. The interesting part is how strict it is, on purpose:

- **`extra="forbid"`**: any field not in the contract is rejected (HTTP 422). Nobody can smuggle in something like `audio_b64`, so the "non-biometric" promise is enforced by code, not just by good intentions.
- **ID patterns**: `user_id` and `session_id` must match `[A-Za-z0-9_-]{1,64}`. The user id becomes a **filename**, so this blocks path tricks like `../../x`.
- **`allow_inf_nan=False`**: `NaN`/`Infinity` would write invalid JSON into the log files, so they are rejected.
- **Voice rule**: voice numbers are accepted **only if** `voice_opt_in` is true.
- **`trial_meta`** (extra per-task info) is a flat object of at most 16 keys, simple values only, with strings of at most 64 chars.
- **Batches**: 1 to 100 events per request. A batch is all-or-nothing: one bad event rejects the whole batch.
- **Storage**: one `.jsonl` file per user under `data/raw/telemetry/`, a git-ignored folder (`telemetry_dir()` resolves it from the code's own location, so it doesn't depend on where you start the server). Deleting a user = deleting one file.
- `main.py` adds a custom 422 handler that doesn't echo the rejected input back, which also stops `NaN` from crashing the error response.

The 22 tests live in `api/tests/test_telemetry.py`. Each "hostile input" case has a test.

---

## 4. The client (`frontend/src/features/assessment/`)

The paths below are relative to `frontend/src/features/assessment/`, the maintained copy inside the team UI. The frozen `client/src/` has the same layout, plus `App.tsx` (its own session loop) and `voice/`.

### 4.1 Telemetry core: `telemetry/`

| File | What it does |
|---|---|
| `types.ts` | TypeScript mirror of the server's event shape, plus the `params` type of each exercise |
| `metrics.ts` | Two small pure functions: `hesitationJitter` and `nextErrorBurst` |
| `tracker.ts` | `TrialRecorder` (one trial → one event) and `Tracker` (buffer + send) |
| `useInputCapture.ts` | React hook: listens for key/press/move while a trial is live |
| `useTimedTrials.ts` | Shared "show trial → wait for answer or timeout → next" loop used by most screens, plus `pressProps` (keyboard-accessible buttons) |

**The fields in each event, and what they mean.** This is what Member 3 builds on.

| Field | Meaning |
|---|---|
| `score_norm` | 1 = correct, 0 = wrong (Tower: `min(1, l_min / l_user)`) |
| `response_time_ms` | stimulus onset → committed answer (or the time window on timeout); capped at 600 000 |
| `error_flag` | true if wrong |
| `error_burst` | how many errors in a row, including this one |
| `keystroke_latency_ms` | onset → **first key or mouse press** (mouse *movement* doesn't count) |
| `hesitation_jitter` | how irregular the gaps between inputs are (std-dev in ms). Steady = low, stop-start = high |
| `trial_meta` | per-exercise details (lure type, number of reasoning steps, frames shown…) |

**Why the Tracker is built the way it is:**
- **`push` never waits.** Network delays can't slow the exercise. That is the "no client lag" requirement.
- **It keeps events until the server confirms them.** If the network is down, it retries later. The buffer is capped at 500 events; when full, the oldest are dropped, so memory can't grow forever.
- **It uses `sendBeacon` on `pagehide` and when the page becomes hidden.** The browser delivers these even while the tab is closing.
- **A rejected batch (4xx) is dropped, not retried forever.** One broken event would otherwise block every event behind it. Network errors, 5xx, 408 and 429 are retried.
- Duplicates can happen (a beacon while a normal send is in flight), so Member 3 dedupes on `(session_id, item_id, stream)`.
- **In the UI it is the single telemetry sink.** The buffer is mirrored to `localStorage`, so pending events survive a reload. `subscribe`/`getStatus` feed the offline banner its real pending count, and the Privacy page's purge calls `tracker.clear()`. The UI's old `telemetryQueue.ts` was deleted.

### 4.2 Getting tasks: `tasks/taskSource.ts`, `TaskRunner.tsx`, `ExerciseHost.tsx`

- `fetchNextTask` calls Member 5's API and **validates** the reply: a known `schema_type`, one of the 6 dimensions, and a `task_id` of at most 48 characters. Anything invalid shows a "try again" screen instead of sending events that the server would reject.
- **Mock mode** is the UI default (`VITE_USE_MOCKS` unset; set it to `false` for real tasks). The page picks the fixture: the dimension's first exercise, or the one named by `?schema=<schema_type>`. Use it while Member 5's API doesn't exist. (The frozen `client/` uses `VITE_MOCK_TASKS=1` and plays the fixtures in order.)
- `getUserId` creates an anonymous random ID kept in the browser (no login yet).
- `ExerciseHost.tsx` fetches one task, gives it its own `TrialRecorder` (with the payload's `dimension`, never the UI registry's), and wraps the exercise in an error boundary (`SkipOnError`): a broken task shows the page's retry screen instead of blanking the app.
- **Pause = unmount.** Escape, the pause button or a tab blur unmounts the exercise; the unfinished trial is never sent. Resume fetches a fresh task with a new `task_id`, so `item_id`s never repeat.

### 4.3 The 8 exercises: `tasks/*.tsx`

The README's 4 assessment tests come first, then the brief's 5 training exercises. The interference N-back covers both.

| Screen | Dimension | What the user does | Extra telemetry (`trial_meta`) |
|---|---|---|---|
| **NBack** | working_memory | Watches a 3×3 grid + a symbol; presses **A** if the position matches n steps back and **L** if the symbol does. Some trials are **lures** (match n−1 or n+1 back) and some **switch the rule** | `trial_type`, `rule`, `stream`; **2 events per trial** (one per stream) |
| **Stroop** | executive_function | Word "RED" printed in blue → pick the **ink** colour (keys 1–9) | `congruent` |
| **Matrix** | pattern_induction | 3×3 pattern with one gap → pick the missing piece | — |
| **MentalRotation** | spatial_orientation | Two block shapes: same shape rotated (**F**) or a mirror image (**J**)? | `angle_deg`, `mirrored` |
| **Relational** | pattern_induction | Facts about made-up words ("ZUP is OPPOSITE to KEV") → true/false question; an amber border means the rule is **inverted** | `hops`, `inverted`, `level` |
| **Tower** | executive_function | Predict the move count first, then move discs to match the goal | `l_min`, `l_user`, `planning_time_ms`, `conflict_latency_ms`, … |
| **Ufov** | processing_speed | A display flashes very briefly → name the centre letter **and** where the outer target was | `requested_ms`, **`shown_ms`**, `frames`, … |
| **Mst** | episodic_memory | Study shapes, then judge each test shape: **old**, **similar** (slightly changed) or **new** | `kind`, `delta`, `response` |

`svg.tsx` draws all the shapes from numbers, never HTML, so a task payload can never inject code. `frames.ts` measures the screen's refresh rate for UFOV.

### 4.4 Adaptive difficulty: `adaptive/`

Two different tools, used for two different goals:

- **`staircase.ts`: weighted up-down staircase (Kaernbach).** Used by **Relational**. A correct answer makes it 1 step harder; a wrong answer makes it 0.85/0.15 ≈ **5.67 steps easier**. These two forces balance exactly when the user is right **85%** of the time, so the difficulty settles where they're right about 85% of the time.
- **`quest.ts`: QUEST+ (Bayesian).** Used by **UFOV**. It keeps a probability map of the user's *threshold* (the shortest display time they can handle). Each trial it picks the display duration that will teach it the most about that threshold. It **estimates the threshold**; it does **not** hold accuracy at 85%.

**Why UFOV timing is special.** A screen only changes on a refresh (every 16.7 ms at 60 Hz, 8.3 ms at 120 Hz). Asking for 50 ms really means "show for N whole frames". So UFOV logs **`shown_ms`** (what was actually on screen, measured from `requestAnimationFrame` timestamps), and QUEST+ learns from `shown_ms`, not from the requested value.

### 4.5 Voice opt-in: `voice/` (frozen `client/` only)

Voice is **not shipped in the UI** (decision D1): the UI never asks for the microphone and always sends `voice_opt_in: false`. What follows describes the frozen `client/`.


- **`VoiceToggle.tsx`**: off by default and off again on every page load. Turning it on asks for the microphone; if refused, it switches back off and says why.
- **`voiceProbe.ts`**: listens to the mic **only to measure loudness**. It notes the moment speech starts, then derives *voice latency* (how fast you start speaking) and *vocal pace*. **No recording and no audio kept**: a test scans the file and fails if it ever contains `MediaRecorder`, `fetch(`, `sendBeacon`, `XMLHttpRequest` or `WebSocket`. The mic is released when you switch it off or leave the app.
- Only **Stroop** uses it, and its instruction then says "Say the ink color aloud, then pick it."

---

## 5. Principles that run through the code

| Principle | Where you see it |
|---|---|
| **The client renders; the generator decides truth** | Every trial's correct answer arrives in the task JSON; screens only compare |
| **Non-biometric by construction** | Strict server schema, voice = numbers only and opt-in, source-scan test |
| **Never lag the user** | `push()` returns instantly; batching + beacon |
| **Don't lose data silently** | Retry on network errors, beacon on close, payload validation, clamps (score 0–1, RT ≤ 600 s) |
| **Accessible** | Every answer works from the keyboard (`pressProps`); text labels, not colour alone; ≥ 4.5:1 contrast |
| **Measure what was shown** | `shown_ms` from real frames; `keystroke_latency` = presses only |
| **Non-clinical wording** | No brain-region names or diagnostic words in the UI |

---

## 6. Running and testing it

```powershell
# API (terminal 1)
cd assessment_engine\api
.\.venv\Scripts\python -m uvicorn main:app --port 8000     # docs: http://localhost:8000/docs
.\.venv\Scripts\python -m pytest -q                          # 22 tests

# UI (terminal 2): mock tasks are the default
cd frontend
npm run dev                                                  # http://localhost:5173 (or the next free port)
# open /task/inhibition_control, or /task/visuospatial_planning_gf?schema=tower
npm run qa:checks     # lint:tokens, lint:copy, check:contrast, vitest, build
npm run qa:e2e        # Playwright; its config uses the Chrome channel, so Chrome must be installed
```

To see the data your answers produce, open `data\raw\telemetry\<id>.jsonl` at the repo root after playing a few trials.

The frozen `client/` still runs on its own (`cd assessment_engine\client; $env:VITE_MOCK_TASKS = "1"; npm run dev`), but it is no longer maintained.

---

## 7. Decisions still open with the team

These are listed in full in `README.md` → "Open questions":

1. **Field names**: the root README spells the event two ways; I used `score_norm / response_time_ms / error_flag / hesitation_jitter`. Member 3 must agree.
2. **6 dimensions, not 4**: I added `processing_speed` (UFOV) and `episodic_memory` (MST).
3. **Task JSON format**: Member 5 must produce exactly the `params` shapes in `types.ts`, including the answers.
4. **Integration with the new UI** (`frontend/`): done. The exercises run at `/task/:dimId`, my Tracker replaced the UI's own telemetry queue, and every trial is accepted by the server (0 × 422 in the end-to-end smoke). That smoke used the mock task fixtures only: `GET /v1/tasks/next` does not exist yet, so real generated tasks are untested. Still open: the UI owner has to accept the proposed DEC entry in `docs/ui/DECISIONS.md`, and Member 5 should say whether `GET /v1/tasks/next` takes a `schema_type` filter.

---

## 8. How it was built (for context)

The code was written in 13 planned tasks (`docs/superpowers/plans/2026-10-23-member1-assessment-telemetry.md`). Each task was written test-first, checked by a separate reviewer, and fixed until clean, with a final review of the whole branch. Bugs found along the way are good examples of what to watch for:

- `NaN` sneaking into log files
- one bad event blocking the whole queue
- answer buttons that didn't work from the keyboard
- white-on-white Tower discs
- mouse movement counted as a "keystroke"
- telemetry saved to a folder git didn't ignore
