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
                      │      LRU bounded cache (max_sessions)     │
                      │      Finite number guardrail (NaN/Inf)   │
                      └─────────────────────┬─────────────────────┘
                                            │ Smoothed Latent Vector s̄_t
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │   Soft Gaussian Mixture Model (GMM)       │
                      │    γ_{t, k} = P(C_k | s̄_t) (Log-Sum-Exp)  │
                      │    Supports arbitrary K archetypes        │
                      └─────────────────────┬─────────────────────┘
                                            │ Responsibilities γ_{t, k}
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │    Schmitt-Trigger Hysteresis Gate        │
                      │  Δγ > δ_hyst (0.15) for N_confirm = 3     │
                      │  Anti-chattering & Dwell-Time Filter      │
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
        │ Non-clinical safety guard   │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────────────────────┐
        │ Output Contract: Archetype, Radar, XAI Event, Band      │
        └─────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Modules

### 1. Temporal State Smoothing (`LeakyIntegrator`)
- **Mathematical formulation:**
  $$\bar{s}_t = (1 - \eta)\bar{s}_{t-1} + \eta s_t \quad (\eta = 0.12)$$
- **Numerical Guardrails:** Validates that incoming vectors contain only finite numbers (`np.isfinite`). Rejects `NaN` and `Inf` to prevent permanent state corruption.
- **Session Memory Management:** Employs an `OrderedDict` LRU cache capped at `max_sessions=10000`. Inactive sessions are automatically evicted, preventing memory leaks under high traffic.

### 2. Soft GMM Clustering (`SoftGMMClusterer`)
- **Mathematical formulation:** Computes soft responsibilities using component log-likelihoods:
  $$\ln \mathcal{N}(x; \mu_k, \Sigma_k) = -\frac{1}{2}\left[d \ln(2\pi) + \ln|\Sigma_k| + (x - \mu_k)^T \Sigma_k^{-1} (x - \mu_k)\right]$$
  $$\gamma_{t, k} = \frac{\pi_k \mathcal{N}(\bar{s}_t; \mu_k, \Sigma_k)}{\sum_{j=1}^K \pi_j \mathcal{N}(\bar{s}_t; \mu_j, \Sigma_j)}$$
- **Numerical Stability:** Uses SciPy's `logsumexp` to guarantee posteriors sum to $1.0 \pm 10^{-5}$ without underflow or overflow.
- **Dynamic Clusters:** Supports any $K \ge 1$ clusters with deterministic orthogonal initialization, scikit-learn EM fitting (`fit()`), and JSON parameter serialization.

### 3. Dynamic Archetype Registry (`ArchetypeRegistry`)
- **Extensible Registry:** Allows registering archetypes at runtime, loading from JSON/dict configs, or auto-generating definitions for arbitrary $K$ clusters.
- **Robust Key Parsing:** Robustly parses integer and string keys (`"C1"`, `"c1"`, `"1"`, `"arch_1"`, etc.).
- **Default Grid:** 9 pre-calibrated non-clinical archetypes spanning a $3 \times 3$ grid:
  - **Developing:** Intuitive Explorer (C1), Stepwise Builder (C2), Deliberate Observer (C3)
  - **Operational:** Agile Sprinter (C4), Calibrated Operator (C5), Methodical Analyst (C6)
  - **Strategic:** Rapid Strategist (C7), Adaptive Architect (C8), Deep Systemic Thinker (C9)

### 4. Schmitt-Trigger Hysteresis Gate (`SchmittTriggerHysteresisGate`)
- **Mathematical formulation:** A transition from active cluster $C_{\text{active}}$ to candidate $C_{\text{target}}$ requires:
  $$\gamma_{t, \text{target}} - \gamma_{t, \text{active}} > \delta_{\text{hyst}} \quad (\delta_{\text{hyst}} = 0.15)$$
  consistently maintained for $N_{\text{confirm}} = 3$ consecutive evaluation windows.
- **Anti-Chattering Guarantee:** Momentary lapses, guesses, or boundary noise cannot trigger cluster switching.
- **Dynamic Override:** `set_active_cluster()` supports setting active state for arbitrary cluster counts $K \ge 1$.

### 5. Centroid Prototype Explainability Decoder (`ExplainabilityDecoder`)
- **Linear Projection Matrix:** Calibrates $W_{\text{eval}} \in \mathbb{R}^{M \times d}$ via Moore-Penrose pseudo-inverse against archetype target profiles:
  $$Y = M W_{\text{eval}}^T \implies W_{\text{eval}} = Y^T (M^\dagger)^T$$
- **Differential Transition Vector:** Computes change along each cognitive dimension:
  $$\Delta c = W_{\text{eval}}(\mu_{\text{target}} - \mu_{\text{active}})$$
- **Dominant Driver Identification:**
  $$j^* = \operatorname{argmax}_j |\Delta c_j|$$
- **Non-Clinical Safety Guardrail:** All explanations are validated against `FORBIDDEN_CLINICAL_REGEX`. Rejects pathological or clinical terms (such as *deficit*, *impairment*, *dysfunction*, *ADHD*, *patient*, *diagnosis*).
- **Radar Scores & Uncertainty Band:** Computes 0–100 radar scores smoothly blended across archetype targets, with an uncertainty band scaled from posterior entropy:
  $$H(\gamma_t) = -\sum_{k=1}^K \gamma_{t, k} \ln \gamma_{t, k}, \quad \text{uncertainty} = 3.0 + 8.5 \cdot \frac{H(\gamma_t)}{\ln K}$$

### 6. Brain Twin JEPA Bridge (`BrainTwinClusteringBridge`)
- Located in `brain_twin_jepa/clustering_bridge.py`.
- Bridges Task 2's JEPA Context Encoder output vectors to the clustering engine, returning serialized evaluation dictionaries matching the team data contract.

### 7. FastAPI Router (`api_router.py`)
- Exposes `POST /v1/clustering/evaluate` and `POST /v1/clustering/reset/{user_id}`.
- Supports dependency injection via `Depends(get_evaluator)` and `set_evaluator()`.
- Validates vector dimensions and finite values, returning HTTP 422 for malformed payloads.

---

## 📂 Directory Layout

```
clustering_engine/
├── __init__.py               # Public API exports
├── archetypes.py             # Archetype dataclass, ArchetypeRegistry, dimension formatting
├── temporal_smoother.py      # LeakyIntegrator (eta = 0.12, LRU session cache, NaN guard)
├── gmm_clusterer.py          # SoftGMMClusterer (K clusters, log-sum-exp, EM fitting, save/load)
├── hysteresis_gate.py        # SchmittTriggerHysteresisGate (delta=0.15, N_confirm=3, dynamic K)
├── explainability.py         # ExplainabilityDecoder (W_eval, Delta c, XAI, non-clinical guardrails)
├── evaluator.py              # CognitiveEvaluator (Unified end-to-end pipeline)
├── api_router.py             # FastAPI router (/v1/clustering/evaluate, dependency injection)
├── README.md                 # Technical documentation & guide
├── HANDOVER.md               # Inter-member integration contracts
└── tests/
    ├── __init__.py
    ├── test_gmm.py           # Soft posteriors, bounds, persistence, and smoother tests
    ├── test_hysteresis.py    # Anti-chattering and dwell-time gate tests
    ├── test_explainability.py# XAI projection, dominant drivers, non-clinical guardrails
    ├── test_evaluator.py     # End-to-end contract schema and FastAPI tests
    ├── test_dynamic_config.py# Arbitrary K and extensible dimension tests
    └── test_audit_fixes.py   # Regression tests for audit findings and edge cases

brain_twin_jepa/
├── __init__.py               # Exports BrainTwinClusteringBridge
├── clustering_bridge.py      # Direct JEPA encoder to clustering bridge
└── tests/
    ├── __init__.py
    └── test_clustering_bridge.py # Unit tests for the bridge interface
```

---

## 🛠️ Environment & Installation

The project runs in the `ai4brain-clustering` Conda environment:

```powershell
# Create environment (if not already created)
conda create -y -n ai4brain-clustering python=3.11 numpy scipy scikit-learn pydantic fastapi uvicorn httpx pytest

# Activate environment
conda activate ai4brain-clustering
```

---

## 💻 Usage Examples

### 1. Standard End-to-End Pipeline

```python
import numpy as np
from clustering_engine import CognitiveEvaluator

# Initialize evaluator with default 9 archetypes and 5 dimensions
evaluator = CognitiveEvaluator(dim=64)

# Ingest latent vector from Task 2 JEPA
s_t = np.random.randn(64)
result = evaluator.evaluate(user_id="usr_01", latent_vector=s_t)

print("Active Archetype:", result.cluster_name)
print("Radar Scores:", result.radar_scores)
print("Transitioned:", result.has_transitioned)
if result.has_transitioned:
    print("XAI Explanation:", result.transition_event.xai_explanation)
```

### 2. Member 1 Handover (6 Dimensions)

```python
from clustering_engine import CognitiveEvaluator

six_dims = [
    "working_memory",
    "pattern_induction",
    "executive_function",
    "spatial_orientation",
    "processing_speed",
    "episodic_memory",
]

evaluator = CognitiveEvaluator(k=6, dimensions=six_dims)
result = evaluator.evaluate("usr_02", np.random.randn(64))

# Radar scores contain exactly the 6 configured dimensions
print(result.radar_scores)
```

### 3. JEPA Clustering Bridge

```python
from brain_twin_jepa import BrainTwinClusteringBridge

bridge = BrainTwinClusteringBridge()
data = bridge.process_jepa_state(user_id="usr_03", s_t=[0.05] * 64)

# Returns dictionary conforming to team contract
print(data["active_cluster_id"], data["cluster_name"])
```

### 4. FastAPI Service with Dependency Injection

```python
from fastapi import FastAPI
from clustering_engine.api_router import router, set_evaluator
from clustering_engine import CognitiveEvaluator

app = FastAPI(title="AI4Brain Cognitive Service")
app.include_router(router)

# Optional: customize evaluator parameters globally
custom_evaluator = CognitiveEvaluator(k=6, dimensions=["dim_1", "dim_2"])
set_evaluator(custom_evaluator)
```

---

## 🧪 Testing & Verification

Run the full test suite across both `clustering_engine` and `brain_twin_jepa`:

```powershell
C:\Users\User\miniconda3\envs\ai4brain-clustering\python.exe -m pytest clustering_engine/tests brain_twin_jepa/tests -v
```

All 56 unit and integration tests verify:
- Soft responsibilities sum to $1.0 \pm 10^{-5}$ across diverse inputs.
- Finite number validation rejects `NaN` and `Inf` inputs, preserving clean session memory.
- LRU cache evicts inactive sessions when `max_sessions` is reached.
- Schmitt-trigger hysteresis gate prevents chattering and requires 3 sustained frames.
- Extensible dimensions (4, 5, 6, custom) and arbitrary cluster counts ($K \ge 1$) execute deterministically.
- Non-clinical safety guardrails strictly reject pathological terminology.
- `BrainTwinClusteringBridge` correctly processes vectors and handles user resets.
