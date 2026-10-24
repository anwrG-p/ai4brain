# clustering_engine (Member 3)

The **Clustering Engine & Centroid Explainability Decoder** serves as the behavioral anchor and non-clinical explainability layer of the AI4Brain Cognitive Growth Agent. It consumes continuous latent vectors $s_t \in \mathbb{R}^d$ ($d=64$) produced by the Brain Twin (SAT-JEPA) Context Encoder, decouples transient fluctuations via temporal smoothing, evaluates soft responsibilities across cognitive archetypes, eliminates boundary jitter using a Schmitt-trigger hysteresis filter, and generates supportive, growth-mindset explanations across extensible cognitive dimensions.

---

## 🏛️ System Architecture

```
                                 Raw Latent Vector s_t ∈ ℝ^64
                                            │
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │   Temporal State Smoothing (Leaky Filter) │
                      │      s̄_t = (1 - η)s̄_{t-1} + η s_t (η=0.12) │
                      └─────────────────────┬─────────────────────┘
                                            │ Smoothed Latent Vector s̄_t
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │   Soft Gaussian Mixture Model (GMM)       │
                      │    γ_{t, k} = P(C_k | s̄_t) (Log-Sum-Exp)  │
                      └─────────────────────┬─────────────────────┘
                                            │ Responsibilities γ_{t, k}
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │    Schmitt-Trigger Hysteresis Gate        │
                      │  Δγ > δ_hyst (0.15) for N_confirm = 3     │
                      └──────────────┬────────────────────────────┘
                                     │
                     ┌───────────────┴────────────────┐
                     │ Transition Occurred?           │
                     ▼                                ▼
                   [YES]                            [NO]
        ┌─────────────────────────────┐    ┌────────────────────┐
        │ Centroid Explainability     │    │ Steady State       │
        │ Δc = W_eval(μ_target - μ_c) │    │ Retain Active C_k  │
        │ Dominant Driver j*          │    └────────────────────┘
        │ Growth NL Narrative (XAI)   │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────────────────────┐
        │ Output Contract: Archetype, Radar, XAI Event, Band      │
        └─────────────────────────────────────────────────────────┘
```

---

## ⚡ Features

1. **Temporal State Smoothing (`LeakyIntegrator`):**
   - Exponential smoothing filter with $\eta = 0.12$:
     $$\bar{s}_t = (1 - \eta)\bar{s}_{t-1} + \eta s_t$$
   - Decouples fast transient fatigue/distraction noise from genuine cognitive state progression.
   - Manages per-user session memory with reset capabilities.

2. **Soft GMM Clustering (`SoftGMMClusterer`):**
   - Computes soft posterior responsibilities $\gamma_{t, k} = P(C_k \mid \bar{s}_t)$.
   - Evaluated via Log-Sum-Exp for numerical stability, guaranteeing $\sum_{k=1}^K \gamma_k = 1.0 \pm 10^{-5}$.
   - Fully open to any number of clusters $K \ge 1$ (supports unsupervised EM fitting and JSON persistence).

3. **Dynamic Archetype Registry (`ArchetypeRegistry`):**
   - Decoupled from rigid hardcoding: clusters can be registered at runtime, loaded from JSON configs, or auto-generated for any $K$.
   - Pre-populated with 9 non-clinical cognitive archetypes spanning a $3 \times 3$ grid (Proficiency Tier $\times$ Pacing Strategy).

4. **Schmitt-Trigger Hysteresis Gate (`SchmittTriggerHysteresisGate`):**
   - Anti-chattering filter with confidence margin $\delta_{\text{hyst}} = 0.15$ and dwell confirmation $N_{\text{confirm}} = 3$ consecutive windows.
   - Completely suppresses boundary oscillations caused by lucky guesses or momentary slips.

5. **Extensible Centroid Explainability Decoder (`ExplainabilityDecoder`):**
   - Configurable cognitive dimensions (supports 4 README dimensions, 5 Task 3 dimensions, 6 Member 1 handover dimensions, or custom domain spaces).
   - Calibrated linear projection matrix $W_{\text{eval}} \in \mathbb{R}^{M \times d}$.
   - Differential vector calculation: $\Delta c = W_{\text{eval}}(\mu_{\text{target}} - \mu_{\text{curr}})$.
   - Dominant driver identification: $j^* = \operatorname{argmax}_j |\Delta c_j|$.
   - Supportive growth-mindset narrative generator with strict safety guardrails blocking all clinical/diagnostic keywords.
   - Dynamic 0–100 radar scores and posterior entropy-based uncertainty bands.

---

## 📂 Directory Layout

```
clustering_engine/
├── __init__.py               # Public API exports
├── archetypes.py             # Archetype dataclass, ArchetypeRegistry, and dimension utilities
├── temporal_smoother.py      # LeakyIntegrator (eta = 0.12)
├── gmm_clusterer.py          # SoftGMMClusterer (K clusters, log-sum-exp, EM fitting)
├── hysteresis_gate.py        # SchmittTriggerHysteresisGate (delta=0.15, N_confirm=3)
├── explainability.py         # ExplainabilityDecoder (W_eval, Delta c, XAI, non-clinical guardrails)
├── evaluator.py              # CognitiveEvaluator (Unified end-to-end pipeline)
├── api_router.py             # FastAPI route (/v1/clustering/evaluate)
├── README.md                 # Technical documentation & guide
├── HANDOVER.md               # Inter-member integration contracts
└── tests/
    ├── __init__.py
    ├── test_gmm.py           # Soft posteriors, bounds, persistence, and smoother tests
    ├── test_hysteresis.py    # Anti-chattering and dwell-time gate tests
    ├── test_explainability.py# XAI projection, dominant drivers, non-clinical guardrails
    ├── test_evaluator.py     # End-to-end contract schema and FastAPI tests
    └── test_dynamic_config.py# Arbitrary K and extensible dimension tests
```

---

## 🛠️ Environment & Installation

The project uses Conda for dependency isolation:

```powershell
# Create environment (if not already created)
conda create -y -n ai4brain-clustering python=3.11 numpy scipy scikit-learn pydantic fastapi uvicorn httpx pytest

# Activate environment
conda activate ai4brain-clustering
```

---

## 💻 Quickstart Usage

### 1. In-Python Direct Pipeline

```python
import numpy as np
from clustering_engine import CognitiveEvaluator

# Initialize evaluator (supports custom K and custom dimensions if desired)
evaluator = CognitiveEvaluator(
    dim=64,
    k=9,
    dimensions=["working_memory", "pattern_processing", "processing_speed", "spatial_reasoning", "verification_rigor"],
)

# Ingest latent vector from Task 2 JEPA
s_t = np.random.randn(64)
result = evaluator.evaluate(user_id="usr_01", latent_vector=s_t)

# Output dictionary matching exact AI4Brain contract
print(result.to_dict())
```

### 2. Custom Dimensions & Dynamic Clusters

```python
# Support Member 1's 6 cognitive dimensions:
six_dims = [
    "working_memory", "pattern_induction", "executive_function",
    "spatial_orientation", "processing_speed", "episodic_memory"
]

evaluator = CognitiveEvaluator(k=6, dimensions=six_dims)
result = evaluator.evaluate("usr_02", np.random.randn(64))
print(result.radar_scores)  # Exactly 6 keys
```

### 3. FastAPI HTTP Service

Mount the router onto your FastAPI application:

```python
from fastapi import FastAPI
from clustering_engine.api_router import router as clustering_router

app = FastAPI()
app.include_router(clustering_router)
```

**Evaluate Endpoint:**
- `POST /v1/clustering/evaluate`
- Body:
  ```json
  {
    "user_id": "usr_test_01",
    "latent_vector": [0.05, -0.12, 0.44, ...] // 64 floats
  }
  ```

---

## 🧪 Running Unit Tests

Run the full pytest suite in the `ai4brain-clustering` conda environment:

```powershell
C:\Users\User\miniconda3\envs\ai4brain-clustering\python.exe -m pytest clustering_engine/tests/ -v
```

All 43 unit and integration tests verify:
- Soft probabilities sum to $1.0 \pm 10^{-5}$.
- Boundary anti-chattering and dwell-time hysteresis hold under oscillating signals.
- Explanations are strictly free of clinical diagnostic terms.
- Dynamic cluster counts ($K \in \{2, 3, 5, 8, 12\}$) and extensible dimensions (4, 5, 6, custom) execute deterministically.
