# Member 3: Brain Twin, Clustering Engine & Explainability Decoder Implementation Plan

> **For agentic workers:** Reference plan and design specification for Member 3 of the AI4Brain Challenge (CISTAC 1.0).

**Goal:** A continuous, non-clinical behavioral clustering and explainability engine that consumes 64-dimensional continuous latent vectors $s_t \in \mathbb{R}^{64}$ produced by the Brain Twin (SAT-JEPA) Context Encoder, filters transient noise via temporal state smoothing, computes soft archetype posterior responsibilities, eliminates boundary oscillation through a Schmitt-trigger hysteresis gate, and decodes prototype-based explainability vectors into supportive growth-mindset natural-language narratives.

**Architecture:**
- **Leaky Integrator:** $\bar{s}_t = (1 - \eta)\bar{s}_{t-1} + \eta s_t$ ($\eta = 0.12$) with LRU bounded session memory (`max_sessions=10000`) and finite number validation (`np.isfinite`).
- **Soft GMM Clusterer:** Evaluates $\gamma_{t, k} = P(C_k \mid \bar{s}_t)$ using Log-Sum-Exp stabilization, ensuring $\sum_{k=1}^K \gamma_k = 1.0 \pm 10^{-5}$ across arbitrary cluster counts $K \ge 1$.
- **Archetype Registry:** Dynamic registry decoupling fixed cluster counts; provides default $3 \times 3$ (9 archetypes) non-clinical grid and runtime generation for arbitrary $K$.
- **Schmitt-Trigger Hysteresis Gate:** Anti-chattering filter with margin $\delta_{\text{hyst}} = 0.15$ and dwell confirmation $N_{\text{confirm}} = 3$ consecutive frames.
- **Centroid Explainability Decoder (XAI):** Calibrates linear projection matrix $W_{\text{eval}} \in \mathbb{R}^{M \times d}$ via Moore-Penrose pseudo-inverse, computes differential vector $\Delta c = W_{\text{eval}}(\mu_{\text{target}} - \mu_{\text{curr}})$, identifies dominant driver $j^* = \operatorname{argmax}_j |\Delta c_j|$, generates supportive non-clinical growth narratives, blends 0–100 radar scores, and computes entropy-scaled uncertainty bands.
- **FastAPI HTTP Endpoint:** Serves `POST /v1/clustering/evaluate` with Pydantic contract validation and dependency injection.
- **JEPA Bridge:** Provides `BrainTwinClusteringBridge` for direct in-process coupling between Context Encoder and Clustering Engine.

**Tech Stack:** Python 3.11+, NumPy, SciPy, Scikit-Learn, FastAPI, Pydantic v2, pytest, httpx.

---

## Global Constraints & Design Rules

1. **Strict Non-Clinical Safety:** All user-facing explanations must contain zero clinical or pathological terminology. A regex guardrail (`FORBIDDEN_CLINICAL_REGEX`) actively blocks terms like *deficit*, *impairment*, *dysfunction*, *ADHD*, *patient*, *diagnosis*.
2. **Anti-Chattering Invariant:** The Schmitt-trigger hysteresis gate guarantees that `active_cluster_id` will never oscillate rapidly between adjacent clusters on noisy or borderline trials.
3. **Probability Simplex Invariant:** Posterior responsibilities must always sum to $1.0 \pm 10^{-5}$ regardless of input magnitudes or numerical scaling.
4. **Finite Numerical Safety:** Rejects `NaN` and `Inf` at input boundaries, preventing permanent corruption of user session memory.
5. **Memory Bounding:** Employs LRU eviction with a maximum of 10,000 concurrent sessions, preventing unbounded memory leaks under high web traffic.
6. **Extensible Dimensions & Dynamic K:** Decoupled from hardcoded 5 dimensions and 9 clusters. Seamlessly supports Member 1's 6 dimensions, README's 4 dimensions, or custom domain taxonomies.

---

## File Structure

```
clustering_engine/
  __init__.py                 Public API exports
  archetypes.py               Archetype dataclass, ArchetypeRegistry, dimension formatting
  temporal_smoother.py        LeakyIntegrator (eta=0.12, LRU session cache, NaN guard)
  gmm_clusterer.py            SoftGMMClusterer (K clusters, log-sum-exp, EM fitting, save/load)
  hysteresis_gate.py          SchmittTriggerHysteresisGate (delta=0.15, N_confirm=3, dynamic K)
  explainability.py           ExplainabilityDecoder (W_eval, Delta c, XAI, non-clinical guardrails)
  evaluator.py                CognitiveEvaluator (Unified end-to-end pipeline)
  api_router.py               FastAPI router (/v1/clustering/evaluate, dependency injection)
  README.md                   Technical documentation, architecture & quickstart
  HANDOVER.md                 Inter-member handover contracts & integration guide
  tests/
    test_gmm.py               Soft posteriors, bounds, persistence, and smoother tests
    test_hysteresis.py        Anti-chattering and dwell-time gate tests
    test_explainability.py    XAI projection, dominant drivers, non-clinical guardrails
    test_evaluator.py         End-to-end contract schema and FastAPI tests
    test_dynamic_config.py    Arbitrary K and extensible dimension tests
    test_audit_fixes.py       Regression tests for audit findings and edge cases

brain_twin_jepa/
  __init__.py                 Exports BrainTwinClusteringBridge
  clustering_bridge.py        Direct JEPA encoder to clustering bridge
  tests/
    test_clustering_bridge.py Unit tests for bridge interface
```

---

## Tasks & Verification Checklist

- [x] **Task 1: Temporal State Smoothing (Leaky Integrator)**
  - Implement exponential moving average $\bar{s}_t = (1 - \eta)\bar{s}_{t-1} + \eta s_t$ with $\eta = 0.12$.
  - Implement finite number validation (`np.isfinite`) rejecting `NaN` and `Inf`.
  - Implement LRU bounded session memory (`max_sessions=10000`).
  - Unit tests in `test_gmm.py` and `test_audit_fixes.py`.

- [x] **Task 2: Soft Gaussian Mixture Model (GMM)**
  - Implement soft posterior calculation using Log-Sum-Exp.
  - Implement deterministic orthonormal prototype centroid initialization for any $K$.
  - Implement EM fitting (`fit()`) and JSON parameter persistence (`save()`, `load()`).
  - Verify $\sum \gamma_k = 1.0 \pm 10^{-5}$ across varied scales.
  - Unit tests in `test_gmm.py` and `test_dynamic_config.py`.

- [x] **Task 3: Dynamic Archetype Registry & Modeling**
  - Implement `Archetype` prototype with proficiency tiers and pacing strategies.
  - Build default 9-archetype $3 \times 3$ grid spanning Developing, Operational, and Strategic tiers.
  - Implement `ArchetypeRegistry` with support for custom clusters and auto-generation for arbitrary $K$.
  - Robust cluster key parsing handling lowercase (`'c1'`) and custom prefixes (`'arch_1'`).
  - Unit tests in `test_dynamic_config.py` and `test_audit_fixes.py`.

- [x] **Task 4: Schmitt-Trigger Hysteresis Gate**
  - Implement anti-chattering margin $\delta_{\text{hyst}} = 0.15$ and dwell counter $N_{\text{confirm}} = 3$.
  - Support arbitrary cluster counts $K \ge 1$ in `set_active_cluster()`.
  - Evict inactive user sessions using LRU cache (`max_sessions=10000`).
  - Unit tests in `test_hysteresis.py` and `test_audit_fixes.py`.

- [x] **Task 5: Centroid Explainability Decoder (XAI)**
  - Implement projection matrix $W_{\text{eval}}$ calibration via Moore-Penrose pseudo-inverse.
  - Compute differential vector $\Delta c$ and dominant transition driver $j^* = \operatorname{argmax}_j |\Delta c_j|$.
  - Implement supportive growth-mindset narrative generator with strict non-clinical safety regex filter.
  - Calibrate dynamic 0–100 radar scores and posterior entropy uncertainty bands.
  - Unit tests in `test_explainability.py` and `test_audit_fixes.py`.

- [x] **Task 6: Unified Pipeline & Bridge**
  - Implement `CognitiveEvaluator` coordinating all 5 subcomponents.
  - Implement `BrainTwinClusteringBridge` for direct JEPA context encoder integration.
  - Unit tests in `test_evaluator.py` and `test_clustering_bridge.py`.

- [x] **Task 7: FastAPI Router & API Contract**
  - Implement `/v1/clustering/evaluate` and `/v1/clustering/reset/{user_id}` endpoints.
  - Support dependency injection via `Depends(get_evaluator)` and `set_evaluator()`.
  - Handle input validation and error mapping (`ValueError` -> HTTP 422).
  - Integration tests in `test_evaluator.py` and `test_audit_fixes.py`.
