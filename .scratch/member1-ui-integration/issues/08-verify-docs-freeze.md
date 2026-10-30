# 08: Verify end to end, update docs, freeze the old client

Status: ready-for-agent
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
