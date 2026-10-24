# Member 3 Handover: for the other members' agents

Member 3 (`clustering_engine/` and `brain_twin_jepa/`) consumes latent representations $s_t \in \mathbb{R}^d$ from the JEPA encoder and produces continuous cognitive state tracking, soft archetype assignments, anti-chattering hysteresis transitions, and non-clinical explainability (XAI) outputs.

Read this before integrating with Member 3.

---

## 📡 Output Interface Contract

Every evaluation call (or HTTP `POST /v1/clustering/evaluate`) returns the following deterministic JSON schema:

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
    "xai_explanation": "Shifted to Agile Sprinter due to a 35% increase in inductive pattern processing and accelerated pacing."
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
- **Explainability Injection:** When `has_transitioned: true`, inject `transition_event.xai_explanation` directly into your coach system prompt to explain why exercise pacing or task difficulty was adapted.
- **Dynamic Collaboration Scoring ($S_{\text{collab}}$):** Use `cluster_probabilities` to smoothly blend weights across archetypes instead of hard step-functions.
- **Strict Non-Clinical Safety:** Member 3's explanations are guaranteed to contain **zero** clinical diagnostic terms. Maintain the same policy in your conversational feedback.

### Member 4: Adaptive Dashboard & Visual Analytics (Layer C)
- **What you consume:** `active_cluster_id`, `cluster_name`, `radar_scores`, and `uncertainty_band`.
- **Cognitive Radar Chart:** Render `radar_scores` (0–100 scale) for each configured dimension.
- **Uncertainty Ribbon:** Render visual bands using `uncertainty_band` (e.g. $\pm \sigma$ interval around radar points).
- **Extensible Dimensions:** Notice that radar keys and dimension counts are configurable (4, 5, 6, or custom). Iterate over the keys of `radar_scores` dynamically rather than hardcoding 5 axes in frontend components.

### Member 5: Dynamic Assessment Generator & Cache Dispatcher (Model 1)
- **What you consume:** `active_cluster_id`, `cluster_name`, and centroid coordinates.
- **Centroid Projection Head:** Call `evaluator.clusterer.get_centroid(active_cluster_id)` or `evaluator.clusterer.get_all_centroids()` to retrieve $\mu_k \in \mathbb{R}^d$ for continuous task parameter projection $\mathbf{\theta}_{\text{cluster}}$ (complexity, distractor ratios, time limits).
- **Hysteresis Guarantee:** Member 3's Schmitt-trigger hysteresis gate guarantees that `active_cluster_id` will **never chatter** rapidly between trials (requires $>0.15$ probability margin across $\ge 3$ consecutive evaluation frames). You do not need client-side debouncing.

---

## ⚙️ Customizing Clusters and Dimensions

If your module requires a different dimension set (e.g. 6 dimensions including `episodic_memory`) or a different number of clusters $K$:

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
