# Frontend–server API contracts

The types live in code, not here:
- **Telemetry event and task payload:** `frontend/src/features/assessment/telemetry/types.ts`, validated on the server by `backend/app/api/routes/v1_telemetry.py`.
- **App types:** `frontend/src/types/index.ts`.

`VITE_USE_MOCKS=true` (the default) uses local fixtures; `false` calls the server. The Vite dev server proxies `/v1` to `http://localhost:8000`.

## Endpoints (`backend/app`, the one server)

| Endpoint | Status | Contract |
| :--- | :--- | :--- |
| `POST /v1/telemetry/event` | Live | One event or a batch of up to 100. Fields: `user_id`, `session_id`, `task_id`, `trial_index`, `dimension`, `score_norm` (0..1), `response_time_ms`, `error_flag`, `error_burst`, `hesitation_jitter`, `keystroke_latency_ms`, `trial_meta`, `client_ts`, plus optional voice fields that require `voice_opt_in`. Returns `202 {"accepted": n}`. Sent only after "Save my answers". |
| `DELETE /v1/user/telemetry?user_id=` | Live | Deletes everything stored for the id. Returns the counts actually removed: `{"deleted_events", "deleted_files"}`. No certificate. |
| `GET /v1/user/export?user_id=` | Live | The stored events as JSONL; 404 when nothing is stored. |
| `GET /v1/tasks/next` | 501 until BE-04 | `{ task_id, dimension, schema_type, params, surface_seed }`. |
| `GET /v1/dashboard/profile` | `not_enough_data` until BE-11 | Will carry the 5 skills, their uncertainty, the archetype and the forecast. |
| `POST /v1/coach/chat` | 501 until BE-06 | Loti's AI mode. Only with the keyword crisis gate, then the backup classifier, a configured key and `VITE_LOTI_COACH=on` (R14). Never carries Momo's mood ([ADR 0002](../adr/0002-no-server-side-emotion-inference.md)). |
| `GET /v1/coach/collaboration-score` | 501 until BE-06 | Computed from real chat history only. |
| `POST /v1/clustering/evaluate` | 501 until BE-11 | Archetype from the clustering engine. |

User ids are anonymous device ids, lowercased on the server (R13). A route that cannot compute a value answers 501 or `not_enough_data`, never a placeholder (R15).

## Dimensions and skills

Telemetry events carry one of 6 **dimension** keys: `working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`, `processing_speed`, `episodic_memory`. The UI never shows them. It shows the **5 skills** (pillars), which `frontend/src/features/insights/pillars.ts` computes from per-exercise scores (`taskScores.ts`). See the [glossary](../GLOSSARY.md) for which exercise feeds which skill.

*Rewritten 2026-10-31. The earlier version (7-dimension registry, `WhyThisTrail`, `BrainTwinProfile`, the requests to the backend team) is in git history.*
