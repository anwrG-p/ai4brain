# Brain Twin SAT-JEPA: Representation Learning & Trajectory Predictor

> **AI4Brain Challenge (CISTAC 1.0)** — IEEE ENIS / IEEE FSS SB Chapter / IEEE Tunisia Section  
> **Module:** `brain_twin_jepa/` (Member 3)  
> **Runtime Stack:** Pure NumPy & SciPy. Ultra-low CPU latency (<0.05 ms), zero PyTorch bloat, 100% portable.

---

## 📌 Overview

The **Brain Twin SAT-JEPA** (Soft-Anchored Temporal Joint Embedding Predictive Architecture) learns continuous, noise-filtered cognitive representations $s_t \in \mathbb{R}^{64}$ directly from sequential assessment telemetry ($x_t \in \mathbb{R}^{12}$). It also implements a latent predictor to forecast future cognitive states $\hat{s}_{t+h}$, fulfilling the competition's **Predictive Cognitive Growth Bonus**.

### Key Highlights:
1. **Zero Fixed Archetypes by Default:** In accordance with user-centric behavioral modeling, no static archetypes are hardcoded. The latent space is an open metric manifold where archetypes emerge dynamically from user observations.
2. **Pure NumPy / SciPy Runtime:** Zero heavyweight deep-learning dependencies (no 2.5 GB PyTorch). Single-step inference executes in **$< 0.05\text{ ms}$** on standard CPUs.
3. **Closed-Loop Integration:** Directly bridges Member 1 telemetry events to Member 3's Soft GMM Clustering Engine, Schmitt-Trigger Hysteresis Gate, and Centroid Explainability Decoder.
4. **Predictive Growth Forecasting:** Monotonically expanding uncertainty intervals power Member 4's **Predictive Trajectory Ribbons** and Member 5's **Dynamic Task Blueprint Caching**.

---

## 🏛️ System Architecture

```
                       Member 1: Telemetry Event Stream (x_t)
                                       │
                                       ▼
                   ┌───────────────────────────────────────┐
                   │    1. Telemetry Featurizer (12D)      │
                   │  One-hot Dim, log(RT), Jitter, Bursts │
                   └───────────────────┬───────────────────┘
                                       │ x_t ∈ ℝ^12
                                       ▼
                   ┌───────────────────────────────────────┐
                   │  2. Temporal Context Encoder f_θ      │
                   │  64-Unit Pure NumPy GRU + LayerNorm   │
                   │  Bounded LRU Memory (max_sessions)    │
                   └───────────────────┬───────────────────┘
                                       │ s_t ∈ ℝ^64 (Current Cognitive State)
                      ┌────────────────┴────────────────┐
                      │                                 │
                      ▼                                 ▼
    ┌───────────────────────────────────┐    ┌───────────────────────────────────┐
    │ 3. Latent Predictor g_φ           │    │ 4. Clustering & XAI Evaluator     │
    │ Inputs: (s_t, h, target_dim)      │    │ Leaky Integrator (η = 0.12)       │
    │ Residual MLP: ŝ_{t+h} = s_t + Δs  │    │ Dynamic User Archetype Spawning   │
    │ Monotonic Uncertainty σ_{t+h}²    │    │ Schmitt-Trigger Hysteresis Gate   │
    └─────────────────┬─────────────────┘    │ Centroid XAI Narrative Decoder    │
                      │                      └─────────────────┬─────────────────┘
                      ▼                                        ▼
          Forecasted Trajectories                    Active Archetype & Radar
           (Member 4 Dashboard &                      (Member 2 AI Coach &
            Member 5 Cache Head)                       Member 4 Visual UI)
```

---

## 📐 Mathematical Formulation

### 1. Telemetry Featurizer (`TelemetryFeaturizer`)
Transforms a raw `TelemetryEvent` or Python dictionary into a normalized 12-dimensional vector $x_t \in \mathbb{R}^{12}$:

| Index | Feature | Normalization & Formulation | Bounds |
| :--- | :--- | :--- | :--- |
| `[0:6]` | **Cognitive Dimension** | One-hot over 6 canonical dimensions (`working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`, `processing_speed`, `episodic_memory`) | $\{0.0, 1.0\}^6$ |
| `[6]` | **Normalized Score** | $x_{\text{score}} = \text{clip}(\text{score\_norm}, 0.0, 1.0)$ | $[0.0, 1.0]$ |
| `[7]` | **Log Response Time** | $x_{\text{rt}} = \frac{\ln(1 + \text{rt\_ms})}{\ln(1 + 600000.0)}$ | $[0.0, 1.0]$ |
| `[8]` | **Error Flag** | $x_{\text{err}} = 1.0 \text{ if error else } 0.0$ | $\{0.0, 1.0\}$ |
| `[9]` | **Error Burst** | $x_{\text{burst}} = \text{clip}(\text{burst} / 10.0, 0.0, 1.0)$ | $[0.0, 1.0]$ |
| `[10]` | **Hesitation Jitter** | $x_{\text{jitter}} = \text{clip}\left(\frac{\ln(1 + \max(0, \text{jitter}))}{10.0}, 0.0, 1.0\right)$ | $[0.0, 1.0]$ |
| `[11]` | **Trial Cadence** | $x_{\text{trial}} = \text{clip}(\text{trial\_index} / 100.0, 0.0, 1.0)$ | $[0.0, 1.0]$ |

Numerical validation strictly validates `np.all(np.isfinite(x_t))`, immediately rejecting `NaN` or `Inf`.

---

### 2. Context Encoder (`TemporalContextEncoder`)
Maintains sequential cognitive trial state using a 64-unit Gated Recurrent Unit (GRU):
$$r_t = \sigma(W_{xr} x_t + W_{hr} h_{t-1} + b_r)$$
$$z_t = \sigma(W_{xz} x_t + W_{hz} h_{t-1} + b_z)$$
$$\tilde{h}_t = \tanh(W_{xh} x_t + W_{hh} (r_t \odot h_{t-1}) + b_h)$$
$$h_t = (1 - z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t$$
$$s_t = \operatorname{LayerNorm}(W_{\text{proj}} h_t + b_{\text{proj}}) \in \mathbb{R}^{64}$$

* **Numerical Stability:** Recurrent weights $W_{hr}, W_{hz}, W_{hh}$ are initialized using QR orthonormal decomposition.
* **Session Cache:** Bounded `OrderedDict` LRU cache (`max_sessions = 10000`) prevents memory leaks under web load.

---

### 3. EMA Target Encoder (`TargetEncoder`)
Provides stationary target representations for self-supervised training without contrastive negative pairs:
$$\bar{\theta} \leftarrow \tau \bar{\theta} + (1 - \tau) \theta \quad (\tau = 0.996)$$

---

### 4. Latent Predictor (`LatentPredictor`)
A 2-layer residual MLP with Gaussian Error Linear Unit (GELU) predicting forward state displacements and monotonic uncertainty:
$$\mathbf{u} = [s_t; h / 10.0; c_{t+h}] \in \mathbb{R}^{71}$$
$$\mathbf{z}_1 = \operatorname{GELU}(W_1 \mathbf{u} + b_1), \quad \mathbf{z}_1 \in \mathbb{R}^{64}$$
$$\Delta \hat{s} = W_2 \mathbf{z}_1 + b_2$$
$$\hat{s}_{t+h} = s_t + \Delta \hat{s} \in \mathbb{R}^{64}$$
$$\hat{\sigma}_{t+h} = \exp\left(0.5 \cdot \text{clip}(W_{\text{var}} \mathbf{z}_1 + b_{\text{var}}, -4, 4)\right) \cdot (1.0 + 0.15 \cdot h)$$

---

### 5. Dynamic User Archetype Bootstrapping & Anchoring
* When starting with zero archetypes ($k=0$), the very first user trial automatically spawns **Centroid 1 (`C1: User Archetype 1`)** centered at that user's state.
* Subsequent trials that fall outside existing density boundaries ($\max_k \text{affinity} < \tau_{\text{novel}}$) dynamically spawn **Centroid 2, Centroid 3**, etc.
* `SATJEPAModel.anchor_to_user_centroids(centroids)` dynamically calibrates the projection matrix $W_{\text{proj}} = M^T (H_{\text{proto}}^\dagger)^T$ whenever user clusters are discovered or updated.

---

## 🔌 Python Bridge API

```python
from brain_twin_jepa import BrainTwinClusteringBridge, SATJEPAModel
from clustering_engine import CognitiveEvaluator

# Initialize bridge (supports zero default archetypes or dynamic K)
evaluator = CognitiveEvaluator(k=0, novelty_threshold=0.15)
bridge = BrainTwinClusteringBridge(evaluator=evaluator)

# 1. Process incoming Member 1 telemetry event
telemetry_event = {
    "user_id": "usr_alice",
    "dimension": "working_memory",
    "score_norm": 0.90,
    "response_time_ms": 1150.0,
    "error_flag": False,
    "error_burst": 0,
    "hesitation_jitter": 20.0,
    "trial_index": 1,
}
result = bridge.process_telemetry("usr_alice", telemetry_event)

print(result["active_cluster_id"])       # e.g., 1
print(result["cluster_name"])            # e.g., "User Archetype 1"
print(result["radar_scores"])            # e.g., {"working_memory": 82.5, ...}
print(len(result["latent_state"]))       # 64

# 2. Forecast predictive growth trajectory (Member 4 & 5)
forecast = bridge.predict_trajectory("usr_alice", horizon=5)
for step in forecast["steps"]:
    print(f"Step +{step['step_offset']}: {step['cluster_name']} (uncertainty ±{step['uncertainty_sigma']})")

# 3. Reset user session
bridge.reset_user("usr_alice")
```

---

## 📡 HTTP Endpoints (`clustering_engine/api_router.py`)

All endpoints are hosted under prefix `/v1/brain-twin`:

### 1. Ingest Telemetry Step: `POST /v1/brain-twin/step`
**Request Payload:**
```json
{
  "user_id": "usr_2026_01",
  "dimension": "working_memory",
  "score_norm": 0.88,
  "response_time_ms": 1200.0,
  "error_flag": false,
  "error_burst": 0,
  "hesitation_jitter": 22.0,
  "trial_index": 5
}
```

**Response Payload (HTTP 200):**
```json
{
  "user_id": "usr_2026_01",
  "active_cluster_id": 1,
  "cluster_name": "User Archetype 1",
  "cluster_probabilities": {
    "C1": 1.0
  },
  "has_transitioned": false,
  "transition_event": null,
  "radar_scores": {
    "working_memory": 78.5,
    "pattern_induction": 72.0,
    "processing_speed": 75.0,
    "spatial_orientation": 70.0,
    "verification_rigor": 65.0
  },
  "uncertainty_band": 4.2,
  "latent_state": [0.1245, -0.0452, ..., 0.3129],
  "input_dimension": "working_memory"
}
```

### 2. Trajectory Forecast: `GET /v1/brain-twin/forecast/{user_id}?horizon=5`
**Response Payload (HTTP 200):**
```json
{
  "user_id": "usr_2026_01",
  "forecast_horizon": 5,
  "steps": [
    {
      "step_offset": 1,
      "predicted_cluster_id": 1,
      "cluster_name": "User Archetype 1",
      "cluster_probabilities": { "C1": 0.98 },
      "predicted_radar_scores": { "working_memory": 79.1 },
      "uncertainty_sigma": 1.15,
      "latent_vector": [0.125, -0.044, ...]
    },
    {
      "step_offset": 2,
      "predicted_cluster_id": 1,
      "cluster_name": "User Archetype 1",
      "cluster_probabilities": { "C1": 0.95 },
      "predicted_radar_scores": { "working_memory": 80.2 },
      "uncertainty_sigma": 1.30,
      "latent_vector": [0.128, -0.042, ...]
    }
  ]
}
```

### 3. Reset Session: `POST /v1/brain-twin/reset/{user_id}`
Clears both SAT-JEPA recurrent memory and clustering smoother/gate streak memory for the user.

---

## 🧪 Testing & Verification

Run the test suite using pytest:
```bash
pytest brain_twin_jepa/tests
```

All 49 unit and integration tests verify:
* Exact 12D vectorization and finite number guardrails (`test_featurizer.py`).
* 64-unit GRU recurrence, state isolation, and LRU eviction (`test_encoder.py`).
* Target encoder EMA parameter tracking (`test_target_encoder.py`).
* Latent predictor residual displacement and monotonic uncertainty growth (`test_predictor.py`).
* End-to-end telemetry sequence evaluation and synthetic training (`test_sat_jepa_e2e.py`).
* Zero-archetype dynamic bootstrapping and novelty spawning (`test_zero_archetype_bootstrap.py`).
* Bridge interface and backward compatibility (`test_clustering_bridge.py`).
* FastAPI HTTP route contracts (`test_api_endpoints.py`).
