# Cognitive Growth Agent — System Architecture & Work Breakdown Structure

> **CISTAC 1.0 (AI4Brain Challenge)** — IEEE ENIS / IEEE FSS SB Chapter / IEEE Tunisia Section
>
> Continuous, non-clinical cognitive assessment and adaptive growth using Generative AI, self-supervised representation learning, and behavioral clustering.

## 📌 Architectural Overview

The platform uses a closed-loop system divided into **5 decoupled modules**:

1. **Telemetry & Execution** captures real-time user behavior without client lag.

2. **Brain Twin & JEPA** learns continuous state representations and predicts future trajectories.

3. **Clustering & Explainability** anchors users into non-clinical cognitive archetypes with zero boundary jitter.

4. **Assessment Generator & Cache Dispatcher** provides pre-validated, dynamic exercises with sub-10 ms latency.

5. **AI Coach & Dashboard** manages conversational guidance, dynamic collaboration scoring, and visual analytics.

```
       +-------------------------------------------------------+
       |   Member 1: Assessment Execution & Ingestion (Layer A) |
       +-------------------------------------------------------+
                                  │  Raw Telemetry (x_t)
                                  ▼
       +-------------------------------------------------------+
       | Member 3: Brain Twin (SAT-JEPA), Clusters & XAI       |
       +-------------------------------------------------------+
                     │                              │
                     │ Active Centroid (C_k)         │ Archetype Delta (Δc)
                     ▼                              ▼
+------------------------------------+  +------------------------------------+
| Member 5: Assessment Gen & Cache   |  | Member 2: AI Coach & Collab Engine |
+------------------------------------+  +------------------------------------+
         │                                       │
         │ Cached JSON Task                      │ NL Feedback & Scores
         ▼                                       ▼
+------------------------------------+  +------------------------------------+
| (Loops back to Member 1 Interface) |  | Member 4: Adaptive Dashboard (UI)  |
+------------------------------------+  +------------------------------------+

```

## 👥 5-Member Task Breakdown & Deliverables

### Member 1: Assessment Execution & Telemetry Ingestion (Layer A)

* **Objective:** Build the interactive assessment interface, deliver multimodal cognitive tests, and stream telemetry data without biometric storage requirements.

* **Core Responsibilities:**

  * Implement front-end test interfaces for cognitive dimensions: *Working Memory* ($N$-back), *Pattern Induction* (Matrix reasoning), *Executive Function* (Stroop / Task-switching), and *Spatial Orientation*.

  * Guarantee the mandatory **non-biometric mode** (capturing reaction time, error bursts, keystroke latency, and hesitation jitter).

  * Build an optional, privacy-compliant opt-in toggle for voice latency and vocal pacing (strictly non-biometric, no raw audio or face storage).

  * Package events into a structured telemetry format and post them asynchronously to the ingestion queue.

* **Key Inputs & Outputs:**

  * **Input:** Render-ready task schema JSON from Member 5.

  * **Output:** JSON event stream `x_t = [task_id, dimension_id, score_norm, response_time_ms, error_flag, hesitation_jitter]`.

* **Deliverable Files:**

  * `src/client/tasks/` (Cognitive task components)

  * `src/client/telemetry/tracker.ts` (Client-side event capture)

  * `src/api/routes/telemetry.py` (Ingestion endpoint: `POST /v1/telemetry/event`)

### Member 2: AI Coach Collaboration Engine & Natural-Language Feedback (Layer B)

* **Objective:** Implement the conversational AI coach, compute the dynamic AI Collaboration Score, and enforce non-clinical safety guardrails.

* **Core Responsibilities:**

  * Build the natural-language **AI Coach Chatbot** that guides the user, explains task adaptations, and suggests skill-building learning paths.

  * Implement **Explainability Injection**: ingest the differential vector $\Delta c$ from Member 3 to justify recommendations (e.g., *"We adjusted task pacing because your working memory stability improved by 20%"*).

  * Implement the **Dynamic AI Collaboration Score (0–100)**:
    

    $$
    S_{\text{collab}} = \sum_{i=1}^{5} w_i(s_t) \cdot V_i, \quad \sum w_i = 1.0
    $$

    
    Dynamically tune weights ($w_i$) based on the user's active archetype (e.g., prioritizing *Clarification* and *Iteration* for beginners, while weighting *Critical Verification* and *Autonomy* higher for advanced users).

  * Enforce strict **Non-Clinical Guardrails**: filter out medical/diagnostic labels (e.g., ADHD, impairment, pathology) and maintain growth-mindset phrasing.

* **Key Inputs & Outputs:**

  * **Input:** Archetype delta vector $\Delta c$ and latent profile from Member 3; chat logs from the user.

  * **Output:** Natural-language coaching responses, prompt metadata, and computed collaboration score breakdown (0–100).

* **Deliverable Files:**

  * `src/coach/agent.py` (LLM prompt runner with XAI injection)

  * `src/coach/collaboration_scorer.py` (Dynamic weight calculations)

  * `src/coach/safety_guardrails.py` (Non-clinical regex and safety filters)

### Member 3: Brain Twin, Clustering & Explainability Decoder

* **Objective:** Build the temporal representation model (JEPA), manage dynamic behavioral clustering, and compute prototype-based explainability vectors.

* **Core Responsibilities:**

  * Build the **Soft-Anchored Temporal JEPA (SAT-JEPA)** context encoder ($f_\theta$), target encoder ($f_{\bar{\theta}}$ with EMA updates $\tau = 0.996$), and latent predictor ($g_\phi$).

  * Add a leaky integrator temporal filter to decouple long-term cognitive trends from high-frequency noise (e.g., momentary distractions or fatigue).

  * Implement the $3 \times 3$ **Gaussian Mixture Model (GMM)** in latent space ($K = 9$ stable archetypes) and calculate soft posterior responsibilities $\gamma_k = P(C_k \mid s_t)$.

  * Build a **Schmitt-Trigger Hysteresis Gate** ($\delta_{\text{hyst}} = 0.15, N_{\text{confirm}} = 3$) to eliminate boundary chattering when users transition between clusters.

  * Compute the **Prototype Differential Vector** ($\Delta c = W_{\text{eval}} (\mu_{\text{target}} - \mu_{\text{active}})$) to feed Member 2's explainability prompts.

  * Fulfill the **Predictive Cognitive Growth Bonus**: use the latent predictor ($g_\phi$) to forecast future states $\hat{s}_{t+h}$ with uncertainty intervals.

* **Key Inputs & Outputs:**

  * **Input:** Stream of telemetry frames $x_t$ from Member 1.

  * **Output:** Smoothed latent state $\bar{s}_t$, active cluster index $k$, transition vector $\Delta c$, and predicted growth trajectory $\hat{s}_{t+h}$.

* **Deliverable Files:**

  * `clustering_engine/` (Soft GMM, hysteresis gate, explainability decoder, evaluator, and FastAPI router)

  * `brain_twin_jepa/clustering_bridge.py` (JEPA encoder to clustering engine bridge)

  * `clustering_engine/README.md` (Technical documentation, architecture & quickstart)

  * `clustering_engine/HANDOVER.md` (Inter-member handover contracts & integration guide)

### Member 4: Adaptive Dashboard & Visual Analytics (Layer C)

* **Objective:** Build the interactive, uncertainty-aware analytics dashboard and manage data ethics, privacy, and consent controls.

* **Core Responsibilities:**

  * Build the **Cognitive Multi-Axis Radar Chart** displaying the user's percentage profile across all dimensions, including visual uncertainty bands ($\pm 1\sigma$).

  * Render **Historical Progress Curves** and forward **Predictive Trajectory Ribbons** (consuming Member 3's forecasted latent steps).

  * Implement **Session Fatigue Heatmaps** displaying response time and error rates across session duration and time-of-day.

  * Display the **AI Collaboration Score breakdown** (radar/bar views of Clarification, Verification, Iteration, Autonomy, and Responsible Use).

  * Implement **Data Ethics & Governance**:

    * Explicit opt-in/opt-out consent toggles for optional modalities.

    * 30-day retention policies and a functional data deletion trigger (`DELETE /v1/user/telemetry`).

* **Key Inputs & Outputs:**

  * **Input:** Profile metrics and predictions from Member 3; collaboration scores from Member 2.

  * **Output:** User dashboard UI components and data management API hooks.

* **Deliverable Files:**

  * `src/dashboard/components/RadarChart.tsx` (Uncertainty-aware radar visualization)

  * `src/dashboard/components/GrowthCurve.tsx` (Predictive trajectory projection)

  * `src/dashboard/components/CollabScoreCard.tsx` (Collaboration score visualization)

  * `src/api/routes/privacy.py` (Data export & deletion endpoints)

### Member 5: Dynamic Assessment Generator & Cache Dispatcher (Model 1)

* **Objective:** Decouple assessment generation from the runtime loop using continuous parameter projection, background LLM workers, and anti-repetition caching.

* **Core Responsibilities:**

  * Build the **Continuous Parameter Projection Head**: map latent centroids $\mu_k \in \mathbb{R}^d$ into numerical task parameter vectors $\mathbf{\theta}_{\text{cluster}}$ (complexity, time limits, distractor ratios, step counts).

  * Manage asynchronous background workers using LLM generation to maintain pre-validated pools of structured JSON blueprints for each cluster archetype.

  * Implement the **Runtime Dispatcher**: deliver an assessment to Member 1 in $<10\text{ ms}$ from the active archetype cache.

  * Implement **Anti-Repeat Deduplication**: maintain a per-user Bloom filter and a 14-day Time-To-Live (TTL) registry to guarantee no user encounters the same task variant twice within the cooldown window.

  * Add **Procedural Seed Shuffling**: alter surface tokens, shapes, and numbers deterministically without invoking the LLM repeatedly.

* **Key Inputs & Outputs:**

  * **Input:** Active cluster assignment $k$ and centroid coordinates $\mu_k$ from Member 3; task request event from Member 1.

  * **Output:** Ready-to-render, validated assessment JSON payload served to Member 1.

* **Deliverable Files:**

  * `src/generator/parameter_projector.py` (Centroid-to-parameter vector mapping)

  * `src/generator/llm_worker.py` (Async task generation and validation worker)

  * `src/generator/cache_dispatcher.py` (In-memory cache pool, TTL registry & Bloom filter)

## 🔄 Inter-Subsystem Communication Interfaces

| Source | Target | Endpoint / Channel | Data Contract | 
| ----- | ----- | ----- | ----- | 
| **Member 1** | **Member 3** | `POST /v1/telemetry/event` | `{ user_id, task_id, dimension, score, rt_ms, error, jitter }` | 
| **Member 3** | **Platform / All** | `POST /v1/clustering/evaluate` | `{ user_id, active_cluster_id, cluster_name, probabilities, transition_event, radar_scores, uncertainty_band }` |
| **Member 3** | **Member 5** | Centroid Head / API | `{ user_id, active_cluster_id, centroid_vector, confidence }` | 
| **Member 3** | **Member 2** | XAI Injection / Bus | `{ user_id, transition_occurred: bool, delta_vector, xai_explanation, uncertainty }` | 
| **Member 5** | **Member 1** | `GET /v1/tasks/next` | `{ task_id, dimension, schema_type, params, surface_seed }` | 
| **Member 3 & 2** | **Member 4** | `GET /v1/dashboard/profile` | `{ profile_pct, uncertainty_sigma, collab_score, predictions }` | 
