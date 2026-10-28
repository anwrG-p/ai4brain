# Cognitive Clustering Engine & Explainability Decoder
## System Specification & Architecture Reference

**Module:** Member 3 (`clustering_engine/` and `brain_twin_jepa/`)  
**Challenge:** CISTAC 1.0 (AI4Brain Challenge) — IEEE ENIS / IEEE FSS SB Chapter / IEEE Tunisia Section  

---

## 1. Overview & Objective

The **Clustering Engine & Centroid Explainability Decoder** serves as the behavioral anchor and non-clinical explainability layer of the AI4Brain Cognitive Growth Agent. It consumes continuous latent vectors $s_t \in \mathbb{R}^d$ ($d=64$) produced by the Brain Twin (SAT-JEPA) Context Encoder, decouples transient fluctuations via temporal smoothing, evaluates soft responsibilities across dynamic cognitive archetypes, eliminates boundary jitter using a Schmitt-trigger hysteresis filter, tracks continuous cognitive trajectories through online centroid adaptation, and generates supportive, growth-mindset explanations across extensible cognitive dimensions.

---

## 2. Complete Mathematical Pipeline

### 2.1 Leaky Integrator (Temporal Smoothing)
Fast fluctuations in user performance—such as momentary fatigue, distraction, or eye-tracking jitter—must not trigger premature archetype transitions. The continuous cognitive state is smoothed via an exponential moving average:

$$\bar{s}_t = (1 - \eta)\bar{s}_{t-1} + \eta s_t$$

- **Smoothing Factor ($\eta$):** Fixed at $0.12$. A sudden burst towards an unfamiliar archetype requires multiple sustained trials before significantly displacing the smoothed state $\bar{s}_t$.
- **Boundary Conditions:** For an unobserved user session ($t=0$), $\bar{s}_0 = s_0$.
- **Numerical Validation:** Validates `np.all(np.isfinite(s_t))`. Inputs containing `NaN` or `Inf` raise `ValueError` immediately, protecting session memory from permanent poisoning.
- **LRU Session Eviction:** Stored in an `OrderedDict` LRU cache with `max_sessions = 10000`. Inactive sessions are dropped when the capacity is exceeded.

---

### 2.2 Soft Gaussian Mixture Model (GMM)
Let $\mathcal{C} = \{C_1, C_2, \dots, C_K\}$ denote the set of cognitive archetypes ($K$ is not fixed to 9, supporting dynamic expansion and discovery). The soft posterior responsibility $\gamma_{t, k} = P(C_k \mid \bar{s}_t)$ represents the degree of alignment with archetype $C_k$ at time step $t$.

#### Log-Likelihood Formulation:
For each component $k \in \{1, \dots, K\}$ with prototype centroid $\mu_k \in \mathbb{R}^d$, diagonal covariance $\Sigma_k = \operatorname{diag}(\sigma_{k, 1}^2, \dots, \sigma_{k, d}^2)$, and prior weight $\pi_k$:

$$\ln \mathcal{N}(\bar{s}_t; \mu_k, \Sigma_k) = -\frac{1}{2}\left[d \ln(2\pi) + \sum_{i=1}^d \ln(\sigma_{k, i}^2) + \sum_{i=1}^d \frac{(\bar{s}_{t, i} - \mu_{k, i})^2}{\sigma_{k, i}^2}\right]$$

#### Posterior via Log-Sum-Exp:
To prevent numerical underflow in floating-point operations:

$$\ln P(C_k, \bar{s}_t) = \ln \pi_k + \ln \mathcal{N}(\bar{s}_t; \mu_k, \Sigma_k)$$
$$\ln P(\bar{s}_t) = \operatorname{LogSumExp}_{j=1}^K \left(\ln P(C_j, \bar{s}_t)\right)$$
$$\gamma_{t, k} = \exp\left(\ln P(C_k, \bar{s}_t) - \ln P(\bar{s}_t)\right)$$

This guarantees:
$$\sum_{k=1}^K \gamma_{t, k} = 1.0 \pm 10^{-5}, \quad \forall t \ge 0, \quad \forall \bar{s}_t \in \mathbb{R}^d$$

---

### 2.3 Dynamic Centroid Adaptation & Discovery

The clustering space is **dynamic**, avoiding rigid static assumptions:

#### 2.3.1 Online Centroid Adaptation (Soft EM)
To track continuous cognitive trajectories and user learning curves, centroid coordinates dynamically evolve with incoming observations:

$$\mu_k \leftarrow \mu_k + \eta_{\text{lr}} \cdot \gamma_{t, k} (\bar{s}_t - \mu_k)$$

- **Adaptation Rate ($\eta_{\text{lr}}$):** Default $0.02$. Centroids move smoothly towards empirical user states weighted by the posterior responsibility $\gamma_{t, k}$.
- **Decoupled Preservation:** Only components with active responsibility ($\gamma_{t, k} > 10^{-5}$) undergo adaptation, preserving unvisited archetype definitions.

#### 2.3.2 Novelty-Based Centroid Spawning
When an observed state represents an unmapped cognitive mode outside existing cluster density envelopes:

$$\operatorname{affinity}(\bar{s}_t, \mu_k) = \exp\left(-\frac{1}{2d} \sum_{i=1}^d \frac{(\bar{s}_{t, i} - \mu_{k, i})^2}{\sigma_{k, i}^2}\right) \in (0, 1]$$

If $\max_{k} \operatorname{affinity}(\bar{s}_t, \mu_k) < \tau_{\text{novel}}$:
1. Centroid $K+1$ is spawned directly at $\bar{s}_t$: $\mu_{K+1} = \bar{s}_t$.
2. Prior weights $\pi$ are re-normalized: $\pi_{K+1} = \frac{1}{K+1}$.
3. A dynamic archetype is automatically registered in `ArchetypeRegistry`.
4. The explainability projection matrix $W_{\text{eval}}$ is recalibrated.

#### 2.3.3 Dynamic $K$ Discovery (BIC)
Given a batch of historical or calibration vectors $X \in \mathbb{R}^{N \times d}$, candidate mixture models are evaluated across $k \in [k_{\min}, k_{\max}]$:

$$\operatorname{BIC}(k) = k \cdot (2d + 1) \ln(N) - 2 \ln \mathcal{L}(X; \Theta_k)$$

The optimal cluster count $K^* = \operatorname{argmin}_k \operatorname{BIC}(k)$ is chosen dynamically, balancing explanatory fidelity against model complexity.

---

### 2.4 Schmitt-Trigger Hysteresis Gate
Boundary oscillations (chattering) occur when a user's latent state hovers near the decision boundary between two archetypes. To guarantee stability:

1. **Top Candidate Identification:**
   $$C^* = \operatorname{argmax}_{k \in \{1, \dots, K\}} \gamma_{t, k}$$
2. **Confidence Margin Check:**
   $$\Delta \gamma = \gamma_{t, C^*} - \gamma_{t, C_{\text{active}}}$$
   If $\Delta \gamma > \delta_{\text{hyst}}$ (where $\delta_{\text{hyst}} = 0.15$), candidate $C^*$ accumulates a confirmation dwell frame:
   $$\operatorname{streak}(C^*) \leftarrow \operatorname{streak}(C^*) + 1$$
   Otherwise, the candidate streak is reset to zero.
3. **Dwell Confirmation:**
   A transition is executed if and only if:
   $$\operatorname{streak}(C^*) \ge N_{\text{confirm}} \quad (N_{\text{confirm}} = 3)$$
   Upon transition:
   $$C_{\text{active}} \leftarrow C^*, \quad \operatorname{has\_transitioned} \leftarrow \text{true}$$

---

### 2.5 Centroid Prototype Explainability Decoder (XAI)
When a transition occurs, an explainability payload is generated by projecting the centroid displacement vector into human-interpretable cognitive dimensions.

#### Projection Matrix Calibration ($W_{\text{eval}}$):
Given $K$ archetype centroids $M \in \mathbb{R}^{K \times d}$ and target radar profiles across $M$ dimensions $Y \in \mathbb{R}^{K \times M}$:
$$Y_{k, j} = \frac{\text{target\_radar}_{k, j} - 70.0}{100.0}$$
$$W_{\text{eval}} = Y^T (M^\dagger)^T \in \mathbb{R}^{M \times d}$$
where $M^\dagger$ is the Moore-Penrose pseudo-inverse of $M$. Dynamically recalibrated via `update_centroids()` when centroids adapt or expand.

#### Differential Transition Vector ($\Delta c$):
$$\Delta c = W_{\text{eval}}(\mu_{C_{\text{target}}} - \mu_{C_{\text{active}}})$$

#### Dominant Driver Identification ($j^*$):
$$j^* = \operatorname{argmax}_{j \in \{1, \dots, M\}} |\Delta c_j|$$

#### Radar Score Blending:
$$\text{radar}_j = \sum_{k=1}^K \gamma_{t, k} \cdot \text{target\_radar}_{k, j}$$

#### Uncertainty Band:
Derived from the Shannon entropy of the posterior distribution:
$$H(\gamma_t) = -\sum_{k=1}^K \gamma_{t, k} \ln \gamma_{t, k}$$
$$\text{uncertainty} = 3.0 + 8.5 \cdot \frac{H(\gamma_t)}{\ln K} \in [3.0, 11.5]$$

---

## 3. Cognitive Archetype Specifications

The default registry organizes cognitive behavior into a $3 \times 3$ grid spanning three **Proficiency Tiers** and three **Pacing Strategies**:

```
                       Fast / Exploratory    Balanced / Calibrated   Deliberate / Methodical
                    ┌──────────────────────┬───────────────────────┬────────────────────────┐
   Developing Tier  │ C1: Intuitive        │ C2: Stepwise          │ C3: Deliberate         │
                    │     Explorer         │     Builder           │     Observer           │
                    ├──────────────────────┼───────────────────────┼────────────────────────┤
   Operational Tier │ C4: Agile            │ C5: Calibrated        │ C6: Methodical         │
                    │     Sprinter         │     Operator          │     Analyst            │
                    ├──────────────────────┼───────────────────────┼────────────────────────┤
   Strategic Tier   │ C7: Adaptive         │ C8: Systemic          │ C9: Precision          │
                    │     Strategist       │     Integrator        │     Architect          │
                    └──────────────────────┴───────────────────────┴────────────────────────┘
```

---

## 4. API Endpoints & Data Contracts

All endpoints are hosted under prefix `/v1/clustering`:

### 4.1 Evaluation Endpoint: `POST /v1/clustering/evaluate`
**Request Payload:**
```json
{
  "user_id": "usr_2026_001",
  "latent_vector": [0.12, -0.04, ..., 0.31] // Exactly d finite floats
}
```

**Response Payload (HTTP 200):**
```json
{
  "user_id": "usr_2026_001",
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

### 4.2 Dynamic Centroid Status: `GET /v1/clustering/centroids`
Returns current cluster count $K$, cluster codes, online adaptation parameters, and coordinates.

### 4.3 Centroid Spawning: `POST /v1/clustering/centroids/spawn`
Dynamically registers a new centroid, expands $K \leftarrow K + 1$, and generates an archetype definition.

### 4.4 Centroid Adaptation Config: `POST /v1/clustering/centroids/adapt`
Configures online adaptation toggle, learning rate $\eta_{\text{lr}}$, and novelty threshold $\tau_{\text{novel}}$.

### 4.5 Runtime K Discovery: `POST /v1/clustering/centroids/discover`
Receives empirical batch vectors and fits optimal $K$ components using BIC.

### 4.6 Reset Endpoint: `POST /v1/clustering/reset/{user_id}`
Clears session history, smoother memory, and gate streak counters for a user.

---

## 5. Non-Clinical Safety Architecture

All text generated by the explainability decoder is validated against the safety guardrail filter:

```python
FORBIDDEN_CLINICAL_REGEX = re.compile(
    r"\b(adhd|deficit|deficits|impairment|impairments|pathology|pathologies|"
    r"disorder|disorders|dysfunction|dysfunctions|abnormal|subnormal|retarded|"
    r"clinical|patient|patients|symptom|symptoms|diagnosis|diagnostic|handicap)\b",
    re.IGNORECASE,
)
```

If any forbidden term is detected, execution raises `ValueError` immediately. All narrative templates employ growth-mindset, capability-oriented language (*calibrated*, *streamlined*, *stabilizing*, *expanding*).

---

## 6. Integration Guide for Other Members

### Member 1: Assessment Interface
- Receives dynamic assessment parameters derived from centroid coordinates.
- Streams telemetry frames without client-side debouncing (handled by Member 3's hysteresis gate).

### Member 2: AI Coach
- When `has_transitioned` is `true`, inject `transition_event.xai_explanation` into conversational guidance.
- Blend collaboration scores $S_{\text{collab}}$ smoothly using `cluster_probabilities`.

### Member 4: Adaptive Dashboard
- Render dynamic radar charts from `radar_scores` (supports 4, 5, 6, or custom axes).
- Draw visual confidence ribbons using `uncertainty_band` ($\pm \sigma$).

### Member 5: Task Generator & Dispatcher
- Retrieve active archetype centroids via `evaluator.clusterer.get_centroid(active_cluster_id)` to drive the continuous parameter projection head $\mathbf{\theta}_{\text{cluster}}$.
