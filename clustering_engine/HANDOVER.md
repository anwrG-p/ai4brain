# Member 3 Handover: for the other members' agents

Member 3 (`clustering_engine/` and `brain_twin_jepa/`) provides the end-to-end cognitive modeling pipeline:
1. **Brain Twin SAT-JEPA:** 12D Telemetry Featurizer, 64-unit pure NumPy GRU Context Encoder ($f_\theta$), EMA Target Encoder ($f_{\bar{\theta}}$), and Latent Trajectory Predictor ($g_\phi$).
2. **Temporal State Smoothing:** Leaky Integrator ($\eta = 0.12$) with LRU session tracking and NaN guardrails.
3. **Dynamic User-Generated Archetypes:** Zero fixed archetypes by default; bootstraps and spawns archetypes dynamically from user behavioral patterns.
4. **Soft GMM Posteriors:** Continuous archetype probabilities $\sum \gamma_k = 1.0 \pm 10^{-5}$ via Log-Sum-Exp.
5. **Anti-Chattering Gate:** Schmitt-trigger hysteresis filter ($\delta_{\text{hyst}} = 0.15, N_{\text{confirm}} = 3$).
6. **Centroid Explainability (XAI):** Non-clinical narrative generation and calibrated cognitive radar scores.
7. **Predictive Growth Trajectory:** Forward forecast ribbons ($\hat{s}_{t+h}, \sigma_{t+h}$) for dashboard curves and proactive caching.

Read this before integrating with Member 3.

---

## 📡 Primary HTTP Endpoints

All endpoints are served by FastAPI.

### 1. Ingest Telemetry Step: `POST /v1/brain-twin/step`
Consumes Member 1's per-trial telemetry directly, steps the JEPA context encoder, evaluates GMM posteriors, and returns:

```json
{
  "user_id": "usr_test_01",
  "active_cluster_id": 1,
  "cluster_name": "User Archetype 1",
  "cluster_probabilities": {
    "C1": 1.0
  },
  "has_transitioned": false,
  "transition_event": null,
  "radar_scores": {
    "working_memory": 78.4,
    "pattern_induction": 82.0,
    "executive_function": 71.5,
    "spatial_orientation": 68.2,
    "processing_speed": 79.0,
    "episodic_memory": 65.0
  },
  "uncertainty_band": 4.5,
  "latent_state": [0.12, -0.04, ..., 0.31],
  "input_dimension": "working_memory"
}
```

### 2. Forward Trajectory Forecast: `GET /v1/brain-twin/forecast/{user_id}?horizon=5`
Returns step-by-step forecasted states, predicted dominant archetypes, predicted radar scores, and uncertainty ribbons ($\hat{\sigma}_{t+h}$):

```json
{
  "user_id": "usr_test_01",
  "forecast_horizon": 5,
  "steps": [
    {
      "step_offset": 1,
      "predicted_cluster_id": 1,
      "cluster_name": "User Archetype 1",
      "cluster_probabilities": { "C1": 0.96 },
      "predicted_radar_scores": { "working_memory": 79.0, ... },
      "uncertainty_sigma": 1.15,
      "latent_vector": [0.124, -0.042, ...]
    }
  ]
}
```

### 3. Reset Session: `POST /v1/brain-twin/reset/{user_id}`
Clears both SAT-JEPA recurrent memory and clustering smoother/gate streak memory for the user.

---

## 👥 Inter-Member Integration Details

### Member 1: Assessment Execution & Telemetry Ingestion (Layer A)
- **Direct Telemetry Ingestion:** Member 1 can post raw trial event payloads directly to `POST /v1/brain-twin/step`. 
- **Featurizer Mapping:** Member 3's `TelemetryFeaturizer` automatically handles your 6 dimensions (`working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`, `processing_speed`, `episodic_memory`), log-scaled response times, error bursts, and hesitation jitter without blocking client loops.

### Member 2: AI Coach & Collaboration Engine (Layer B)
- **What you consume:** `has_transitioned`, `transition_event` (`from_cluster`, `to_cluster`, `delta_vector`, `dominant_driver`, `xai_explanation`), and `cluster_probabilities`.
- **Explainability Injection:** When `has_transitioned: true`, inject `transition_event.xai_explanation` directly into your coach prompt to explain why task difficulty or pacing adapted.
- **Dynamic Collaboration Scoring ($S_{\text{collab}}$):** Use `cluster_probabilities` to smoothly blend weights across archetypes instead of hard step-functions.
- **Strict Non-Clinical Safety:** Member 3 explanations are strictly free of clinical diagnostic terms (e.g. *deficit*, *impairment*, *dysfunction*, *ADHD*, *patient*). Maintain this policy in your conversational feedback.

### Member 4: Adaptive Dashboard & Visual Analytics (Layer C)
- **Cognitive Radar Chart:** Render `radar_scores` (0–100 scale) for each configured dimension.
- **Uncertainty Ribbon:** Render visual ribbons using `uncertainty_band` ($\pm \sigma$).
- **Predictive Trajectory Projection:** Fetch `GET /v1/brain-twin/forecast/{user_id}` to render forward trajectory progress ribbons and predicted future cognitive velocity curves.

### Member 5: Dynamic Assessment Generator & Cache Dispatcher (Model 1)
- **Active Centroid Retrieval:** Call `evaluator.clusterer.get_centroid(active_cluster_id)` or `evaluator.clusterer.get_all_centroids()` to retrieve $\mu_k \in \mathbb{R}^d$ for continuous task parameter projection $\mathbf{\theta}_{\text{cluster}}$ (complexity, distractor ratios, time limits).
- **Proactive Task Blueprint Prefetching:** Consume `GET /v1/brain-twin/forecast/{user_id}` to identify which archetype the user is heading toward in the next 1–5 trials and pre-generate task blueprints before the user arrives.
- **Hysteresis Guarantee:** Member 3's Schmitt-trigger hysteresis gate guarantees that `active_cluster_id` will **never chatter** rapidly between trials (requires $>0.15$ probability margin across $\ge 3$ consecutive evaluation frames).

---

## 🔌 Python In-Process Bridge

```python
from brain_twin_jepa import BrainTwinClusteringBridge
from clustering_engine import CognitiveEvaluator

# Initialize bridge
bridge = BrainTwinClusteringBridge()

# 1. Process trial telemetry event directly
result = bridge.process_telemetry("usr_123", telemetry_event_dict)

# 2. Forecast future cognitive growth trajectory
forecast = bridge.predict_trajectory("usr_123", horizon=5)

# 3. Reset user session
bridge.reset_user("usr_123")
```

---

## 🛡️ Error Handling & Operational Rules

- **Finite Vectors:** All input telemetry events and latent vectors must contain only finite numbers. Payloads containing `NaN` or `Inf` return HTTP 422 (or raise `ValueError` in Python).
- **Session Memory:** In-memory sessions are tracked using an LRU cache with a maximum capacity of 10,000 users. Inactive sessions are automatically evicted to prevent memory leaks.
- **Reset Endpoint:** Call `POST /v1/brain-twin/reset/{user_id}` when a user finishes a session to free resources immediately.
