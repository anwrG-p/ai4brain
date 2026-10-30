# HANDOVER.md — Member 2: AI Coach Collaboration Engine & Natural-Language Feedback (Layer B)

**Branch:** `feature/member2-ai-coach-engine`  
**Author:** AI Software Engineer on behalf of Member 2  
**Date:** October 2026  
**Status:** Complete, Tested, and Verified (21/21 unit & API tests passing)

---

## 1. Executive Summary

Member 2 is responsible for **Layer B** of the AI4Brain platform. This module implements:
1. **Conversational AI Coach Agent (`AICoachAgent`):** Natural-language guidance, cognitive strategy coaching, and task adaptation explanations.
2. **Explainability Injection Engine (`XAIExplainer`):** Ingests the prototype differential vector $\Delta c$ and transition events from Member 3 to justify task parameter adjustments (e.g., *"We adjusted task pacing because your working memory stability improved by 20%"*).
3. **Dynamic AI Collaboration Scorer (`CollaborationScorer`):** Computes the composite collaboration score ($S_{\text{collab}} \in [0, 100]$) weighted across five canonical dimensions:
   $$S_{\text{collab}} = \sum_{i=1}^5 w_i(s_t) \cdot V_i, \quad \sum_{i=1}^5 w_i = 1.0$$
   Weights $w_i(s_t)$ dynamically adapt to the user's active GMM cluster archetype ($K=9$).
4. **Non-Clinical Safety Guardrails (`SafetyGuardrailEngine`):** Lexical and regex post-processors that intercept, sanitize, or reject diagnostic/pathological labeling (e.g., ADHD, autism, dementia, cognitive impairment, deficit, disorder) while reinforcing growth-mindset, neuroplasticity-focused phrasing.
5. **FastAPI Microservice (`ai_coach.api`):** Production-ready HTTP service exposing chat, collaboration scoring, and safety verification endpoints.

---

## 2. Directory Structure & Deliverables

To guarantee 100% interoperability across the codebase, deliverables are available both as the `ai_coach` package and re-exported at `src/coach/` (as specified in `README.md` lines 103–109):

```
ai4brain/
├── ai_coach/
│   ├── __init__.py                  # Package exports
│   ├── api.py                       # FastAPI application & REST router
│   ├── schemas.py                   # Pydantic v2 data models & contracts
│   ├── safety_guardrails.py         # Non-clinical lexical filters & sanitizer
│   ├── collaboration_scorer.py      # Dynamic 5-dimension scoring engine
│   ├── xai_explainer.py             # Ingestion & translation of Δc vectors
│   ├── agent.py                     # Conversational coach prompt runner
│   └── prompts/
│       ├── system_coach.txt         # Base non-clinical coach prompt
│       ├── xai_adaptation.txt       # Template for adaptation justifications
│       └── learning_path.txt        # Template for cognitive skill-building paths
├── scripts/
│   └── test_coach_service.py        # Automated verification & interactive CLI chat runner
├── src/
│   └── coach/                       # README-compliant proxy imports
│       ├── __init__.py
│       ├── agent.py
│       ├── collaboration_scorer.py
│       └── safety_guardrails.py
└── tests/
    ├── test_coach_module.py         # 15 core engine unit tests
    └── test_coach_api.py            # 6 FastAPI integration tests
```

---

## 3. Interfaces & Data Contracts

### 3.1 Input Contract from Member 3 (Internal State Bus)
Member 3 broadcasts state transitions and differential vectors to Member 2:

```python
from ai_coach.schemas import StateBusEvent

event = StateBusEvent(
    user_id="user_123",
    transition_occurred=True,
    active_cluster_id=3,  # int in 0..8 (3x3 GMM archetype)
    delta_vector={
        "working_memory": 0.20,       # +20% improvement
        "pattern_induction": 0.15,
        "executive_function": -0.10,
        "spatial_orientation": 0.05,
        "processing_speed": 0.12,
    },
    uncertainty=0.08,  # sigma
)
```

### 3.2 Output Contract to Member 4 (Dashboard UI)
Member 4 displays collaboration breakdown in `CollabScoreCard.tsx` and the uncertainty radar:

```python
from ai_coach.schemas import CollaborationScoreResult

result = scorer.calculate_score(dimension_scores, cluster_id=3)
# result.composite_score -> float [0.0, 100.0]
# result.archetype_tier -> ArchetypeTier ("explorer" | "practitioner" | "strategist")
# result.dimension_scores -> {"clarification": 80.0, "critical_verification": 70.0, ...}
# result.dimension_weights -> {"clarification": 0.20, "critical_verification": 0.20, ...}
# result.weighted_contributions -> {"clarification": 16.0, ...}
# result.growth_recommendation -> str ("Skill Expansion: Try challenging initial intuitions...")
```

### 3.3 Dynamic Weight Distribution ($w_i$) Across Archetype Tiers

| Archetype Cluster ($k$) | Tier | Clarification ($w_1$) | Verification ($w_2$) | Iteration ($w_3$) | Autonomy ($w_4$) | Responsible Use ($w_5$) | $\sum w_i$ |
|---|---|---|---|---|---|---|---|
| **0, 1, 2** | **Explorer (Beginner)** | 0.25 – 0.35 | 0.10 – 0.15 | 0.30 | 0.10 – 0.15 | 0.15 – 0.20 | **1.00** |
| **3, 4, 5** | **Practitioner (Intermediate)** | 0.15 – 0.20 | 0.20 – 0.25 | 0.20 – 0.25 | 0.20 – 0.25 | 0.15 – 0.20 | **1.00** |
| **6, 7, 8** | **Strategist (Advanced)** | 0.05 – 0.10 | 0.30 – 0.35 | 0.10 – 0.15 | 0.30 – 0.40 | 0.10 – 0.15 | **1.00** |

---

## 4. Specific Integration Instructions for Peer Agents

### For Member 3 (Brain Twin, Clustering & XAI Decoder):
* **How to feed $\Delta c$ to Member 2:**
  ```python
  from ai_coach import AICoachAgent, XAIExplainer
  
  # When computing Δc = W_eval * (μ_target - μ_active):
  delta_vector = {"working_memory": 0.20, "pattern_induction": 0.10}
  
  # Generate natural language explanation for telemetry event:
  explainer = XAIExplainer()
  rationale = explainer.generate_adaptation_rationale(delta_vector, active_cluster_id=current_cluster_k)
  ```
* Ensure dimension keys in `delta_vector` use canonical lower snake_case: `working_memory`, `pattern_induction`, `executive_function`, `spatial_orientation`, `processing_speed`.

### For Member 4 (Adaptive Dashboard UI):
* **Consuming the Collaboration Score:**
  Import `CollaborationScoreResult` from `ai_coach.schemas` (or `src.coach`).
  Use `dimension_scores` and `dimension_weights` to populate the 5-spoke radar view on `CollabScoreCard.tsx`.
* **Consuming Explainability Strings:**
  Display `CoachingResponse.xai_explanation` as the tooltip or caption above predictive trajectory ribbons.

### For Member 1 (Assessment Telemetry Ingestion):
* Telemetry metrics such as `response_time_ms` and `hesitation_jitter` can be passed into `scorer.evaluate_interaction_signals(history, telemetry_summary)` to tune the runtime estimate of user autonomy.

### For Member 5 (Dynamic Assessment Generator):
* When Member 5's parameter projection head adjusts difficulty based on centroid $\mu_k$, Member 2 uses the exact corresponding $\Delta c$ to explain the rationale to the user in the conversational panel.

---

## 5. Verification & Testing

### 5.1 Automated Unit & Integration Tests (21/21 Passing)
Run all unit and API tests with `pytest`:
```bash
python -m pytest tests/test_coach_module.py tests/test_coach_api.py -v
```

### 5.2 Automated Service Demonstration Script
Run the automated diagnostic verification runner:
```bash
python scripts/test_coach_service.py
```
This runs an end-to-end check of engine initialization, $\Delta c$ prototype delta decoding, dynamic archetype weight shifts, safety filter sanitization, and full conversational turns.

### 5.3 Interactive Terminal Chat Session
To test chatting with the AI Coach in real-time directly from the CLI:
```bash
python scripts/test_coach_service.py --interactive
```

### 5.4 Starting the FastAPI Microservice
Start the Member 2 HTTP microservice:
```bash
python -m uvicorn ai_coach.api:app --reload --port 8000
```
- Interactive OpenAPI / Swagger UI: `http://localhost:8000/docs`
- Endpoints:
  - `POST /v1/coach/chat`
  - `GET /v1/coach/collaboration-score`
  - `POST /v1/coach/state-event`
  - `GET /v1/coach/learning-path/{user_id}`
  - `POST /v1/coach/verify-safety`

---

## 6. Edge Cases & Operational Notes

1. **Diagnostic Inquiries:** If a user asks *"Do I have ADHD?"* or *"Am I bipolar?"*, `is_diagnostic_inquiry()` flags the prompt, and `wrap_with_disclaimer_if_needed()` appends a disclaimer clarifying that the platform is non-clinical.
2. **Deficit Language Sanitization:** If an LLM response contains terms like `"patient"`, `"cognitive deficit"`, or `"dysfunction"`, `SafetyGuardrailEngine.sanitize()` automatically translates them to `"learner"`, `"targeted growth opportunity"`, and `"suboptimal strategy"`.
3. **Offline / Fallback Resilience:** `AICoachAgent` runs fully offline using deterministic cognitive fitness heuristics when no external LLM API key is present. If an external LLM callable is provided and fails, it automatically degrades gracefully to the local engine.
4. **Cluster Index Clamping:** Any cluster ID passed outside the range $[0, 8]$ is safely clamped to cluster 4 (balanced intermediate archetype).
