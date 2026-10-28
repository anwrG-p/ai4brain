# Member 3 Handover: for the other members' agents

Member 3 (`clustering_engine/` and `brain_twin_jepa/`) consumes continuous latent representations $s_t \in \mathbb{R}^d$ ($d=64$) from the Brain Twin JEPA context encoder and produces:
1. Temporal state smoothing with LRU session tracking and NaN guardrails.
2. Soft Gaussian Mixture Model (GMM) archetype assignments.
3. Schmitt-trigger hysteresis transitions with dwell-time confirmation.
4. Non-clinical explainability (XAI) narratives and calibrated cognitive radar scores.

Read this before integrating with Member 3.

---

## 📡 Output Interface Contract

Every evaluation call (`evaluator.evaluate(...)`, `bridge.process_jepa_state(...)`, or HTTP `POST /v1/clustering/evaluate`) returns the following deterministic JSON schema:

```json
{
  "user_id": "usr_test_01",
  "active_cluster_id": 4,
  "cluster_name": "Agile Sprinter",
  "cluster_probabilities": {
    "C1": 0.05,
    "C2": 0.08,
    "C3": 0.02,
    "C4": 0.65,
    "C5": 0.15,
    "C6": 0.03,
    "C7": 0.01,
    "C8": 0.01,
    "C9": 0.00
  },
  "has_transitioned": true,
  "transition_event": {
    "from_cluster": 1,
    "to_cluster": 4,
    "confidence_margin": 0.22,
    "delta_vector": {
      "working_memory": 0.14,
      "pattern_processing": 0.35,
      "processing_speed": 0.18,
      "spatial_reasoning": 0.05,
      "verification_rigor": -0.08
    },
    "dominant_driver": "pattern_processing",
    "xai_explanation": "Shifted to Agile Sprinter due to a 35% increase in inductive pattern processing and fast / accelerated pacing."
  },
  "radar_scores": {
    "working_memory": 72.4,
    "pattern_processing": 81.0,
    "processing_speed": 79.5,
    "spatial_reasoning": 65.2,
    "verification_rigor": 58.0
  },
  "uncertainty_band": 6.8
}
```

*Note: When `has_transitioned` is `false`, `transition_event` is `null`.*

---

## 👥 Inter-Member Integration Details

### Member 2: AI Coach & Collaboration Engine (Layer B)
- **What you consume:** `has_transitioned`, `transition_event` (`from_cluster`, `to_cluster`, `delta_vector`, `dominant_driver`, `xai_explanation`), and `cluster_probabilities`.
- **Explainability Injection:** When `has_transitioned: true`, inject `transition_event.xai_explanation` directly into your coach prompt to explain why task difficulty or pacing adapted.
- **Dynamic Collaboration Scoring ($S_{\text{collab}}$):** Use `cluster_probabilities` to smoothly blend weights across archetypes instead of hard step-functions.
- **Strict Non-Clinical Safety:** Member 3 explanations are strictly free of clinical diagnostic terms (e.g. *deficit*, *impairment*, *dysfunction*, *ADHD*, *patient*). Maintain this policy in your conversational feedback.

### Member 4: Adaptive Dashboard & Visual Analytics (Layer C)
- **What you consume:** `active_cluster_id`, `cluster_name`, `radar_scores`, and `uncertainty_band`.
- **Cognitive Radar Chart:** Render `radar_scores` (0–100 scale) for each configured dimension.
- **Uncertainty Ribbon:** Render visual bands using `uncertainty_band` (e.g. $\pm \sigma$ interval around radar points).
- **Extensible Dimensions:** Radar keys and dimension counts are configurable (4, 5, 6, or custom). Iterate over the keys of `radar_scores` dynamically rather than hardcoding 5 axes in frontend components.

### Member 5: Dynamic Assessment Generator & Cache Dispatcher (Model 1)
- **What you consume:** `active_cluster_id`, `cluster_name`, and centroid coordinates.
- **Centroid Retrieval:** Call `evaluator.clusterer.get_centroid(active_cluster_id)` or `evaluator.clusterer.get_all_centroids()` to retrieve $\mu_k \in \mathbb{R}^d$ for continuous task parameter projection $\mathbf{\theta}_{\text{cluster}}$ (complexity, distractor ratios, time limits).
- **Hysteresis Guarantee:** Member 3's Schmitt-trigger hysteresis gate guarantees that `active_cluster_id` will **never chatter** rapidly between trials (requires $>0.15$ probability margin across $\ge 3$ consecutive evaluation frames). You do not need client-side debouncing.

---

## 🔌 Python Bridge Integration

If calling directly from Python within the same process:

```python
from brain_twin_jepa import BrainTwinClusteringBridge

bridge = BrainTwinClusteringBridge()
data = bridge.process_jepa_state(user_id="usr_session_123", s_t=latent_vector)
```

To reset a user session (e.g. on new assessment start):
```python
bridge.reset_user("usr_session_123")
```

---

## ⚙️ Customizing Clusters and Dimensions

If your module requires a different dimension set (e.g. Member 1 handover's 6 dimensions) or a different number of clusters $K$:

```python
from clustering_engine import CognitiveEvaluator

evaluator = CognitiveEvaluator(
    k=6,
    dimensions=[
        "working_memory",
        "pattern_induction",
        "executive_function",
        "spatial_orientation",
        "processing_speed",
        "episodic_memory",
    ],
)
```
All outputs (`cluster_probabilities`, `delta_vector`, `radar_scores`) will dynamically align with your configuration.

---

## 🛡️ Error Handling & Operational Rules

- **Finite Vectors:** All input latent vectors must contain only finite numbers. Payloads containing `NaN` or `Inf` return HTTP 422 (or raise `ValueError` in Python).
- **Session Memory:** In-memory sessions are tracked using an LRU cache with a maximum capacity of 10,000 users. Inactive sessions are automatically evicted to prevent memory leaks.
- **Reset Endpoint:** Call `POST /v1/clustering/reset/{user_id}` when a user finishes a session to free resources immediately.
