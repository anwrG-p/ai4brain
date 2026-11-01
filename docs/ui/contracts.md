# Frontend–server API contracts

The types live in code, not here:
- **Telemetry event and task payload:** `frontend/src/features/assessment/telemetry/types.ts`, validated on the server by `backend/app/api/routes/v1_telemetry.py`.
- **App types:** `frontend/src/types/index.ts`.

`VITE_USE_MOCKS=true` (the default) uses local fixtures; `false` calls the server. The Vite dev server proxies `/v1` to `http://localhost:8000`.

## Endpoints (`backend/app`, the one server)

| Endpoint | Status | Contract |
| :--- | :--- | :--- |
| `POST /v1/telemetry/event` | Live | One event or a batch of up to 100. Fields: `user_id`, `session_id`, `task_id`, `trial_index`, `dimension`, `score_norm` (0..1), `response_time_ms`, `error_flag`, `error_burst`, `hesitation_jitter`, `keystroke_latency_ms`, `trial_meta`, `client_ts`, plus optional voice fields that require `voice_opt_in`. Returns `202 {"accepted": n}`. Sent only after "Save my answers". |
| `DELETE /v1/user/telemetry?user_id=` | Live | Deletes everything stored for the id. Returns the counts actually removed: `{"deleted_events", "deleted_chat_turns", "deleted_files"}`. Covers every per-user store (telemetry, chat history, task registry, state bus). No certificate. |
| `GET /v1/user/export?user_id=` | Live | The stored events as JSONL, then one tagged line per other store (`"record": "coach_turn"`, `"task_registry"`, `"state_bus"`); 404 when nothing is stored. |
| `GET /v1/tasks/next` | Live (BE-04) | `{ task_id, dimension, schema_type, params, surface_seed }`. Served from the user's practice-style pool once the state bus knows it (BE-11). The full contract is the `dynamic_cache/api.py` docstring. |
| `GET /v1/dashboard/profile` | Live (BE-11) | The 5 skills (latest and average, with uncertainty), the practice style, the forecast in shadow mode, the collaboration score and the "why this" trail. See [Profile](#get-v1dashboardprofile) below. |
| `POST /v1/coach/chat` | Live (BE-06) | Loti's AI mode. Only with the keyword crisis gate, then the backup classifier, a configured key and `VITE_LOTI_COACH=on` (R14). Never carries Momo's mood ([ADR 0002](../adr/0002-no-server-side-emotion-inference.md)). The contract is the `ai_coach/api.py` docstring. |
| `GET /v1/coach/collaboration-score` | Live (BE-06) | Computed from real chat history only. |
| `POST /v1/clustering/evaluate` | Live (BE-11) | The user's practice style, through the hysteresis gate. See [Evaluate](#post-v1clusteringevaluate) below. |

User ids are anonymous device ids, lowercased on the server (R13). A route that cannot compute a value answers 501 or `not_enough_data`, never a placeholder (R15).

## `GET /v1/dashboard/profile`

`GET /v1/dashboard/profile?user_id=<id>&h=<1..6>`. `h` is the forecast horizon in sessions (default 1); any other value is 422. The profile is computed from the user's stored telemetry on every call.

**Statuses:**
- 200 is the answer, including for an unknown user.
- 413 means the stored telemetry is over the read limit.
- 503 + `Retry-After` means the store is busy; retry.

**Not enough data.** Returned when no session has scored any skill yet (an unknown user included):

```json
{"user_id": "u1", "status": "not_enough_data", "sessions": 0, "min_sessions": 1}
```

**OK.** Every key is always present. A section that cannot be computed is `null`, and its `*_reason` says why:

```json
{
  "user_id": "u1",
  "status": "ok",
  "sessions": 4,
  "min_sessions": 1,
  "pillars": {
    "focus":   {"latest": 62.1, "uncertainty": 14.2, "average": 58.4, "sessions": 4},
    "agility": {"latest": 51.0, "uncertainty": 20.1, "average": 49.7, "sessions": 4},
    "impulse": null,
    "memory":  {"latest": 75.0, "uncertainty": 34.6, "average": 60.0, "sessions": 2},
    "visual":  {"latest": 72.0, "uncertainty": 17.3, "average": 60.3, "sessions": 4}
  },
  "archetype": {"name": "Methodical solver", "confidence": 0.97, "model_id": "ea1e3e86bbd09c97"},
  "archetype_reason": null,
  "forecast": {"status": "ok", "validated": false, "mode": "shadow", "source": "synthetic: ...", "h": 1, "...": "BE-10 payload"},
  "forecast_reason": null,
  "collaboration": {"status": "not_enough_data"},
  "why_this": [
    {"kind": "harder", "reason": "Memory Gauntlet got a little harder because your recent rounds went well.", "at": "2026-11-01T10:54:02+00:00"},
    {"kind": "style", "reason": "Your practice style reads as Methodical solver.", "at": "2026-11-01T10:50:00+00:00"}
  ]
}
```

**`pillars`.** The keys are the 5 skill ids. A skill no session has scored yet is `null`. All values are 0–100 points:
- `latest`: the most recent session's score.
- `uncertainty`: that session's 95% half-width. This is the app's own method (`pillars.ts`, ported to `brain_twin_jepa/features.py`), so the server and the UI agree. Hamza's Kalman filter is not used: its noise terms are fixed constants with no data behind them, so its sigma would claim precision nobody measured.
- `average`: the mean over every session that scored the skill.
- `sessions`: how many sessions scored it.

R12 still applies: the UI shows ranges only in "View as table".

**`archetype`.** The practice style, a plain consumer name from the clustering engine (BE-09), or "Mixed profile". It changes only after 3 finished sessions confirm a new style (the hysteresis gate). A session counts as finished once a later one starts, or after 30 minutes with no new answers. `confidence` is the style's posterior on the latest finished session. `archetype_reason` takes one of these values:
- `no_model`: no clustering model is installed.
- `invalid_model`: the model file does not load.
- `not_enough_data`: no finished session has scored all 5 skills yet.

**`forecast`** (R17, shadow mode). This is BE-10's twin forecast for the session `h` sessions ahead:
- It always says `validated: false` and `mode: "shadow"`, plus the `source` its calibration came from.
- **The UI shows measured values only.** It must not draw this forecast until `validated` is true.
- Below 3 sessions it is `{"status": "not_enough_data", "validated": false, "mode": "shadow", ...}`.
- `null` with a `forecast_reason`: `no_model` (no checkpoint), `outdated_model` (a checkpoint from before the calibrated-range format: retrain), `not_installed` (no torch) or `invalid_model`.

**`collaboration`.** BE-06's score from the stored chat history, the same body as `GET /v1/coach/collaboration-score` (`{"status": "not_enough_data"}` until there is enough). `{"status": "unavailable"}` means the chat store was busy. Its archetype weights are not applied, because they assume cluster ids ordered from beginner to advanced, and the practice styles have no such order.

**`why_this`.** The last 5 adaptation decisions, newest first, as plain reasons with no numbers:
- `harder` / `easier`: a staircase moved the difficulty of one exercise.
- `style`: the practice style was set or changed.

**No brain-region names, ever** (U5). The keys are skill ids.

How the README names map: `profile_pct` is `pillars.*.latest`, `uncertainty_sigma` is `pillars.*.uncertainty`, `collab_score` is `collaboration` and `predictions` is `forecast`.

## `POST /v1/clustering/evaluate`

The body is `{"user_id": "<id>"}` and nothing else. Any other field is 422: the server clusters what it measured, never a vector a client sends.

The call runs the user's profile through the state bus (GMM posteriors, then the hysteresis gate) and answers:
- `200 {"user_id", "status": "ok", "archetype": {"name", "confidence", "model_id"}, "frames", "transition_occurred"}`. `frames` counts the finished sessions seen. `transition_occurred` is true only on the call whose new session confirmed a style change.
- `200 {"user_id", "status": "not_enough_data"}` before the first finished session that scored all 5 skills.
- `501 {"detail": "no clustering model is installed"}`.
- 413 and 503 as for the profile.

The models are made by `python -m brain_twin_jepa.bootstrap`, which `scripts/run_dev.ps1` and the Docker build run (see `scripts/README.md`).

## Dimensions and skills

Telemetry events carry one of 6 **dimension** keys: `working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`, `processing_speed`, `episodic_memory`. The UI never shows them. It shows the **5 skills** (pillars), which `frontend/src/features/insights/pillars.ts` computes from per-exercise scores (`taskScores.ts`). See the [glossary](../GLOSSARY.md) for which exercise feeds which skill.

*Rewritten 2026-10-31. The earlier version (7-dimension registry, `WhyThisTrail`, `BrainTwinProfile`, the requests to the backend team) is in git history.*
