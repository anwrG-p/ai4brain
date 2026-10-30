# 08: Verify end to end, update docs, freeze the old client

Status: resolved
Blocked by: 07
Spec: `../spec.md` ("Done when")

## Verify

1. From `frontend/`, run `npm run qa:checks`. It must be green.
2. From `frontend/`, run `npm run qa:e2e`, at least `e2e/taskRunner.spec.ts`.
   - Axe must report zero violations, light and dark, and there must be no overflow at 375 and 768 px.
   - If Playwright browsers are missing, install them with `npx playwright install chromium`, but do not add dependencies.
3. **Real smoke test:**
   - Start the API (`assessment_engine/api`, uvicorn :8000) and `frontend` (`npm run dev`).
   - In a headless browser (gstack `/browse`), play one task of each of the 8 schema types through the evaluator buttons. Include a pause and resume, and one simulated offline period (`context.setOffline` if available).
   - Check the repo-root `data/raw/telemetry/<uid>.jsonl`:
     - all 8 schema types are present
     - the API log has 0 responses of 422
     - there are no duplicate `(session_id, item_id, stream)` triples except at most one beacon/fetch overlap
     - Stroop events have `congruent`, rotation events have `angle_deg`
   - Put the check script in the scratchpad and paste its output into Comments.

## Docs

- **`assessment_engine/README.md` and `GUIDE.md`:**
  - The client now lives in `frontend/src/features/assessment/`.
  - Update the run commands: API plus `frontend` dev.
  - Voice is not shipped in the UI (D1).
- **`assessment_engine/client/README.md`:** new, one paragraph. "Frozen reference. The maintained copy is `frontend/src/features/assessment/`. Voice opt-in lives only here."
- **`assessment_engine/HANDOVER.md`:** add a UI section covering ExerciseHost, `?schema=`, the Tracker as the single sink, and `tracker.clear()` on purge.
- **`docs/ui/DECISIONS.md`:** propose a DEC entry (status "proposed", for the UI owner to accept) recording D1–D3 and R3.

## Done when

All checks pass and the docs are committed with no AI attribution. Set this ticket and the spec to `Status: resolved`.

## Comments

**2026-10-30, smoke run (ticket 08).** API on :8000, `frontend` dev on :5176 (5173 was taken by another process, left alone), mock tasks (UI default). Driver: a Playwright script on installed Edge, headless (`smoke.cjs` in the agent scratchpad), clicking the evaluator buttons (`• WM`, `■ IC`, `◆ AN`, `⬢ EP`, `★ VP` + `Exercise: <schema>`). Stroop had an Escape pause + Resume; Matrix and Mental rotation were played with `context.setOffline(true)`. Check script: `check_jsonl.py` in the same scratchpad.

Driver output:

```
01:12:40 user_id a4ea5493-8376-4e9c-a7fc-87e83b8d2057
01:12:41 start n_back (url /task/working_memory, h1 "Dual-Stream Spatial & Symbol N-Back")
01:13:00 done  n_back: Telemetry: 20 recorded · 2 waiting to send
01:13:00 start stroop (url /task/inhibition_control, h1 "Color-Word Stroop & Conflict Suppression")
01:13:00   paused via Escape; exercise unmounted: true
01:13:00   resumed; fresh task mounted: true
01:13:01 done  stroop: Telemetry: 5 recorded · queue empty
01:13:02 start ufov (url /task/attention_networks, h1 "Focused Target & Peripheral Cue Detection")
01:13:05 done  ufov: Telemetry: 4 recorded · queue empty
01:13:06 start mst (url /task/episodic_pattern_separation, h1 "Mnemonic Similarity Task (Old / Similar Lure / New)")
01:13:13 done  mst: Telemetry: 5 recorded · 5 waiting to send
01:13:13 OFFLINE on
01:13:14 start matrix (url /task/visuospatial_planning_gf?schema=matrix, h1 "Matrix Induction, Relational Hops & Tower Planning")
01:13:14 done  matrix: Telemetry: 1 recorded · 6 waiting to send · offline
01:13:14 start mental_rotation (url /task/visuospatial_planning_gf?schema=mental_rotation, h1 "Matrix Induction, Relational Hops & Tower Planning")
01:13:15 done  mental_rotation: Telemetry: 4 recorded · 9 waiting to send · offline
01:13:18 offline banner: Connection dropped: Your answers are saved locally on this device (9 in buffer).
01:13:18 offline sync line: Telemetry: 4 recorded · 9 waiting to send · offline
01:13:18 OFFLINE off
01:13:18 start relational (url /task/visuospatial_planning_gf?schema=relational, h1 "Matrix Induction, Relational Hops & Tower Planning")
01:13:20 done  relational: Telemetry: 10 recorded · 1 waiting to send
01:13:20 start tower (url /task/visuospatial_planning_gf?schema=tower, h1 "Matrix Induction, Relational Hops & Tower Planning")
01:13:21 done  tower: Telemetry: 11 recorded · 2 waiting to send
01:13:22 final sync line: Telemetry: 11 recorded · queue empty
01:13:22 played: n_back, stroop, ufov, mst, matrix, mental_rotation, relational, tower
01:13:22 POST /v1/telemetry/event statuses seen by the page: {"202":15}
UID=a4ea5493-8376-4e9c-a7fc-87e83b8d2057
```

Check output:

```
rows: 45  user_id: a4ea5493-8376-4e9c-a7fc-87e83b8d2057
events per schema: {'n_back': 20, 'stroop': 5, 'ufov': 4, 'mst': 5, 'matrix': 1, 'mental_rotation': 3, 'relational': 6, 'tower': 1}
all 8 schemas present: True 
sessions: Counter({'cee431e4-ada0-4bee-8fab-aac18b12d1a1': 45})
tasks (task_id: events): {'mock-nback-1.cee431e4.2': 20, 'mock-stroop-1.cee431e4.5': 1, 'mock-stroop-1.cee431e4.7': 4, 'mock-ufov-1.cee431e4.10': 4, 'mock-mst-1.cee431e4.13': 5, 'mock-matrix-1.cee431e4.17': 1, 'mock-rotation-1.cee431e4.20': 3, 'mock-relational-1.cee431e4.23': 6, 'mock-tower-1.cee431e4.26': 1}
duplicate (session_id, item_id, stream) triples: 0 
stroop events with congruent: 5/5 [False, False, True, False, False]
rotation events with angle_deg: 3/3 [(90, False), (180, True), (270, False)]
events with voice data: 0
dimensions by schema: [('matrix', 'pattern_induction'), ('mental_rotation', 'spatial_orientation'), ('mst', 'episodic_memory'), ('n_back', 'working_memory'), ('relational', 'pattern_induction'), ('stroop', 'executive_function'), ('tower', 'executive_function'), ('ufov', 'processing_speed')]
API log POST /v1/telemetry/event statuses: {'202': 30}
API log 422 count (any route): 0
```

The API log covers two full runs (the first run differed only in how it read the offline banner): 30 POSTs, all 202, zero 422. Playwright `taskRunner.spec.ts` passed via a scratch config with `channel: msedge` (Chrome is not installed), plus axe on the completed screen with "Show details" open: 0 violations light and dark.
