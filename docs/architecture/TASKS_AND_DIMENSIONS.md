# Exercises, dimensions and the 5 skills

> **Source of truth:** `frontend/src/features/assessment/names.ts` (names), `frontend/src/features/assessment/tasks/fixtures.json` (each exercise's telemetry dimension), `frontend/src/features/insights/taskScores.ts` and `pillars.ts` (scoring), `dynamic_cache/generators/` (server task generators).

Three layers of naming:
- **Exercise:** what the user plays (consumer name, `schema_type`).
- **Dimension:** the telemetry key on every event. Never shown in the UI.
- **Skill (pillar):** what the UI shows. Computed on the device from scoring inputs, with the weights in `PILLAR_WEIGHTS`.

## 1. Exercises

| Exercise | `schema_type` | Telemetry dimension | Scoring inputs → skill |
| :--- | :--- | :--- | :--- |
| Logic Web | `relational` | `pattern_induction` | FluidMatrices → Focus & Strategy |
| Pattern Puzzle | `matrix` | `pattern_induction` | FluidMatrices → Focus & Strategy |
| Strategic Blueprint | `tower` | `executive_function` | OTS_Planning → Focus & Strategy; OTS_Execution → Impulse Control |
| Memory Gauntlet | `n_back` | `working_memory` | OSPAN (n-back d′) → Focus & Strategy; DCCS_SwitchCost → Mental Agility |
| Color Clash | `stroop` | `executive_function` | Proxies, only when the session lacks the exercise below: ANT_Conflict → Mental Agility (without Arrow Focus); SST_SSRT → Impulse Control (without Stop Light) |
| Shape Turn | `mental_rotation` | `spatial_orientation` | none of its own |
| Precision Archive | `mst` | `episodic_memory` | MST_LDI → Deep Memory |
| Perceptual Radar | `ufov` | `processing_speed` | UFOV_SOA, ANT_Orienting → Visual Radar |
| Stop Light | `stop_signal` | `executive_function` | SST_SSRT (stop-signal reaction time, integration method) → Impulse Control |
| Pair Finder | `pal` | `episodic_memory` | PAL_FirstTrialMemory (first-attempt memory score) → Deep Memory |
| Arrow Focus | `flanker` | `executive_function` | ANT_Conflict (flanker cost) → Mental Agility |

ErrorRecovery (→ Mental Agility) uses the trial after an error in every exercise except Stop Light (its staircase makes stop errors by design) and Pair Finder. DDM_Caution has no source yet, so it is left out. A skill below 30% coverage shows "Not measured yet".

The Train tab lists each exercise under one skill (`frontend/src/features/train/catalog.ts`); the scoring above is what the numbers use. The **baseline** plays 6: Logic Web, Memory Gauntlet, Color Clash, Strategic Blueprint, Perceptual Radar, Precision Archive. Stop Light, Pair Finder and Arrow Focus are in Train only. Their fixtures follow published designs: Stop Light 200 trials with 25% stop signs (Verbruggen et al. 2019), Pair Finder rounds of 2, 4, 6 and 8 shapes (CANTAB PAL), Arrow Focus 96 trials, one ANT block (Fan et al. 2002).

## 2. Dimension presets (judge tool)

`frontend/src/config/dimensions.ts` keeps the earlier dimension registry (3, 6, 7, 8 and 10 dimensions) for the Generalisation criterion. Its switch shows only in the exercise runner under `?judge=1`. Users see the 5 skills.

## 3. Measurement biases

| Bias | Status |
| :--- | :--- |
| Display refresh rate | **Done.** UFOV records the actually rendered duration (`shown_ms`). |
| Disengaged or random answering | **Done.** Chance gates: a non-responder scores about 0, not a perfect difference score. |
| Hidden tab or interruption | **Done.** Hiding the tab pauses the exercise; a paused attempt is never scored or sent. |
| Colour vision | **Partly.** The server serves a `cvd_safe` Stroop ink set (blue, yellow, red, black) on `GET /v1/tasks/next?inks=cvd_safe`; the UI maps black and draws that block on a light plate. |
| Practice effects | **Planned (F-A).** No "real improvement" before session 3, with a practice-adjusted reliable-change check. |
| Too few trials | **Planned (F-A).** Minimum trials per input, and "Building your profile" below it. |
| Input device and timing | **Planned (F-A).** Device and input logging, and flags for very fast answers. |

Evidence for each: [research 2026-10-31](../research/2026-10-31-improvement-opportunities.md).

## 4. Telemetry event (`POST /v1/telemetry/event`)

One event per trial, sent only after "Save my answers". Full contract: [contracts](../ui/contracts.md).

```json
{
  "user_id": "a1b2c3d4",
  "session_id": "sess_20261029_01",
  "task_id": "nback_wm_03",
  "trial_index": 4,
  "dimension": "working_memory",
  "score_norm": 1.0,
  "response_time_ms": 482.5,
  "error_flag": false,
  "error_burst": 0,
  "hesitation_jitter": 24.2,
  "keystroke_latency_ms": 210.0,
  "trial_meta": {},
  "voice_opt_in": false,
  "client_ts": "2026-10-29T09:00:00.000Z"
}
```

`hesitation_jitter` and `keystroke_latency_ms` are for task scoring only. The server must not infer emotion from them ([ADR 0002](../adr/0002-no-server-side-emotion-inference.md)).

*Rewritten 2026-10-31. The earlier version (6 "skills", tasks that were never built, Doodle framing) is in git history.*
