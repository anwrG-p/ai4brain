# Frontend–Backend API Contracts (`docs/ui/contracts.md`)

This document mirrors `frontend/src/contracts/` and bridges our UI with the 5-member system architecture defined in the root `README.md` and `assessment_engine/`.

- **Single Switch Flag**: `VITE_USE_MOCKS=true` (default for static demo & offline reliability) vs `VITE_USE_MOCKS=false` (live FastAPI backend via `/v1/*`).

---

## 1. Discovered Existing Backend Endpoints (Verified in Repo)

| Endpoint | Owner | Status in Repo | Payload / Contract Summary |
| :--- | :--- | :--- | :--- |
| `POST /v1/telemetry/event` | Member 1 (`backend/app/api/routes/v1_telemetry.py`) | **Implemented & Tested** | Accepts single `TelemetryEvent` or `Batch` ($\le 100$). Validates `user_id`, `session_id`, `task_id`, `trial_index`, `dimension`, `score_norm` ($0..1$), `response_time_ms`, `error_flag`, `error_burst`, `hesitation_jitter`, `keystroke_latency_ms`, `trial_meta`, `voice_opt_in`, `voice_latency_ms`, `vocal_pace_hz`, `client_ts`. Returns `202 {"accepted": n}`. |
| `GET /v1/tasks/next` | Member 5 (`dynamic_cache`) | Specified in `README.md` (Mocked in UI) | Returns `TaskPayload`: `{ task_id, dimension, schema_type, params, surface_seed }`. |
| `GET /v1/dashboard/profile` | Member 3 & 2 (`brain_twin_jepa`, `ai_coach`) | Specified in `README.md` (Mocked in UI) | Returns `{ profile_pct, uncertainty_sigma, collab_score, predictions }` + extended history & archetypes. |
| `DELETE /v1/user/telemetry` | Member 4 / API (`privacy.py`) | Specified in `README.md` (Mocked in UI) | Purges `data/raw/telemetry/{user_id}.jsonl` and resets profile state. |

---

## 2. Dimension Registry Bridge (`[VERIFY-01]`)

To ensure 100% compatibility between our **Section 3 Team Plan (7 dimensions)**, the **6-dimension intake preset**, and **Member 1's Pydantic `Dimension` Literal**, every entry in `DimensionRegistry` carries both its UI `id` and its `backendDimensionKey` + `schemaTypes`:

| UI Slot | 7-Dimension Default (Section 3 Plan) | 6-Dimension Preset (Intake / Backend) | Member 1 `Dimension` Key | Member 1 `SchemaType` Stimuli |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Working Memory** (`WM`) | Working Memory | `working_memory` | `n_back` (Position/Symbol + rule switch) |
| **2** | **Inhibition Control** (`IC`) | Inhibitory Control | `executive_function` | `stroop` (Color-word interference) |
| **3** | **Cognitive Flexibility (Set-Shifting)** (`CF`) | Cognitive Flexibility | `executive_function` | `n_back` (`switch` trials) / `stroop` |
| **4** | **Attention Networks** (`AN`) | Attention | `processing_speed` | `ufov` (Central + peripheral target) |
| **5** | **Divided Perceptual Speed** (`PS`) | Processing Speed | `processing_speed` | `ufov` (QUEST+ duration staircase) |
| **6** | **Episodic Pattern Separation** (`EP`) | *(Merged or 6th in Member 1)* | `episodic_memory` | `mst` (Old / Lure / New polygon memory) |
| **7** | **Visuospatial Planning & $G_f$** (`VP`) | Reasoning | `pattern_induction` / `spatial_orientation` | `matrix`, `relational`, `tower`, `mental_rotation` |

*Note*: In Judge Mode, evaluators can switch live between **3, 6, 7, 8, and 10 dimensions** to verify Generalisation (10%).

---

## 3. Core Frontend TypeScript Contracts (`frontend/src/contracts/`)

### 3.1 `BrainTwinProfile` & `DimensionEstimate`
```ts
export interface DimensionEstimate {
  dimensionId: string;
  backendDimensionKey:
    | 'working_memory'
    | 'pattern_induction'
    | 'executive_function'
    | 'spatial_orientation'
    | 'processing_speed'
    | 'episodic_memory';
  scorePct: number;          // 0..100
  ciLowerPct: number;        // Clamped [0, 100], e.g. scorePct - 1.96 * sigma
  ciUpperPct: number;        // Clamped [0, 100], e.g. scorePct + 1.96 * sigma
  uncertaintySigma: number;  // Standard error / epistemic uncertainty
  confidence: number;        // 0..1 (below 0.60 triggers hatched band & low-confidence UI)
  isLowConfidence: boolean;  // confidence < 0.60
  sampleSize: number;        // Completed trials count
  meanRtMs: number;
  errorRatePct: number;
  hesitationJitterMs: number;
  speedAccuracyProfile: 'fast_accurate' | 'deliberate' | 'impulsive_error' | 'fatigued_slow';
  trendDeltaPct: number;     // Change vs previous snapshot
  lastUpdatedIso: string;
}

export interface ArchetypeClusterInfo {
  clusterId: number;         // k in 1..9 (3x3 GMM)
  archetypeName: string;     // Non-clinical growth label, e.g., "Steady Analytical Builder"
  posteriorProb: number;     // gamma_k = P(C_k | s_t)
  hysteresisStable: boolean; // Schmitt-trigger confirmed (delta_hyst = 0.15, N = 3)
  deltaVectorSummary: string[]; // Human-readable prototype differential vector (Delta c)
}
```

### 3.2 `WhyThisTrail` (Mandatory Explainability Contract)
```ts
export interface WhyThisTrail {
  id: string;
  observedData: string[];    // Concrete telemetry facts (e.g., "Mean RT rose +140ms in late blocks")
  inference: string;         // Non-clinical interpretation grounded in Delta c
  recommendation: string;    // Why this specific exercise/advice was chosen
  confidence: number;        // 0..1
  counterfactual: string;    // "What would change this recommendation?"
  sourceModule: 'sat_jepa_delta_c' | 'quest_staircase' | 'collab_scorer' | 'deterministic_fallback';
}
```

### 3.3 `CollaborationScorePayload`
```ts
export interface CollaborationSubScore {
  key: 'clarification' | 'verification' | 'iteration' | 'autonomy' | 'responsible_use';
  label: string;
  defaultWeightPct: 20 | 25 | 20 | 20 | 15;
  activeDynamicWeightPct: number; // Member 2's dynamic archetype-tuned weight w_i(s_t)
  score: number;                  // 0..100
  evidenceCount: number;
  recentEvents: string[];
  howToImprove: string;
}

export interface CollaborationScorePayload {
  totalScore: number;             // 0..100
  ciRange: [number, number];
  statusBadge: 'Design proposal, not validated';
  formulaLatex: string;           // S_collab = \sum_{i=1}^5 w_i(s_t) \cdot V_i
  subScores: CollaborationSubScore[];
  whyThis: WhyThisTrail;
}
```

---

## 4. Requests to Backend Team (To Raise at Mon 26/10 Sync)

1. **`[REQ-BE-01]` Dimension Enum Alignment (`backend/app/api/routes/v1_telemetry.py`)**:
   - Confirm whether `Dimension` stays as the 6 snake_case keys (`working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`, `processing_speed`, `episodic_memory`) or adds a 7th key (e.g., `cognitive_flexibility` / `attentional_control`) to match the 7-dimension list. Our UI supports both via `DimensionRegistry`.
2. **`[REQ-BE-02]` Explainability Object (`WhyThisTrail`) in Coach & Plan Responses**:
   - Please include `{ observed_data: string[], inference: string, advice_rationale: string, confidence: float, what_would_change: string }` in Member 2's `POST /v1/coach/chat` and plan endpoints so the `<WhyThisPanel />` renders live backend reasoning when `VITE_USE_MOCKS=false`.
3. **`[REQ-BE-03]` Historical Snapshots Array in `GET /v1/dashboard/profile`**:
   - Please include `snapshots: Array<{ snapshot_id, timestamp_iso, trigger_event, profile_pct, uncertainty_sigma, cluster_id }>` so `<BrainTwinTimeTravel />` can scrub through real user history.
4. **`[REQ-BE-04]` Session Fatigue Heatmap Grid**:
   - In `GET /v1/dashboard/profile`, expose recent session blocks grouped by `day_of_week` / `time_of_day_bucket` (or trial block index) with `mean_rt_ms` and `error_rate` for Member 4's Session Fatigue Heatmap.
