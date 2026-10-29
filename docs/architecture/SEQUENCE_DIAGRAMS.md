# System Architecture Sequence Diagrams

> **CISTAC 1.0 (AI4Brain Challenge)** — 5-Subsystem Interoperability & Closed-Loop Protocol  
> **Source of Truth**: Root `README.md` · `docs/ui/contracts.md` · `assessment_engine/`

---

## 1. High-Level Closed-Loop Overview

The SynapseTwin platform operates as a closed-loop system across 5 decoupled sub-modules:

```mermaid
flowchart LR
    M1["Member 1: Assessment Execution"] -->|"Raw Telemetry (x_t)"| M3["Member 3: Brain Twin SAT-JEPA"]
    M3 -->|"Active Centroid (C_k)"| M5["Member 5: Assessment Gen & Cache"]
    M3 -->|"Archetype Delta (Δc)"| M2["Member 2: AI Coach & Collab Engine"]
    M5 -->|"Cached JSON Task (<10ms)"| M1
    M2 -->|"NL Feedback & Collab Scores"| M4["Member 4: Adaptive Dashboard"]
    M3 -->|"Latent Trajectories"| M4
```

---

## 2. Sequence Diagram 1: Assessment Execution & Telemetry Streaming (Member 1 → Member 3)

Captures non-biometric behavioral telemetry ($x_t$) without UI blocking, buffers local events during network drops, and flushes to the ingestion queue.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as "Learner (Browser)"
    participant TaskUI as "Member 1: Task Runner"
    participant Tracker as "Member 1: Telemetry Queue"
    participant IngestAPI as "Member 1: Ingestion API (POST /v1/telemetry/event)"
    participant JSONL as "Telemetry Log (user_id.jsonl)"
    participant BrainTwin as "Member 3: Brain Twin Ingestion"

    Learner->>TaskUI: Commits trial input (Keyboard / Click)
    TaskUI->>TaskUI: Calculate score_norm, response_time_ms, hesitation_jitter
    TaskUI->>Tracker: Record trial event (Non-biometric payload)
    alt Device is Online
        Tracker->>IngestAPI: POST /v1/telemetry/event (Batch <= 50)
        IngestAPI->>IngestAPI: Validate Pydantic schema (No biometric fields)
        IngestAPI->>JSONL: Append atomic JSON line
        IngestAPI-->>Tracker: 202 Accepted (queuedCount updated)
    else Device is Offline
        Tracker->>Tracker: Buffer in localStorage (Capped at 500 events)
        Note over Tracker: Retries with exponential backoff on reconnection
    end
    JSONL->>BrainTwin: Asynchronous batch read for representation update
```

---

## 3. Sequence Diagram 2: Latent Representation Encoding & Task Blueprints Cache (Member 3 → Member 5)

Encodes telemetry into continuous latent representations via SAT-JEPA, anchors into 9 GMM archetypes with Schmitt-trigger hysteresis, and projects parameters into the cache pool.

```mermaid
sequenceDiagram
    autonumber
    participant BrainTwin as "Member 3: Brain Twin (SAT-JEPA)"
    participant GMM as "Member 3: 3x3 GMM Archetypes"
    participant Hysteresis as "Member 3: Schmitt Hysteresis Gate"
    participant StateBus as "Internal State Bus"
    participant Projector as "Member 5: Parameter Head"
    participant TaskCache as "Member 5: Dynamic Task Pool"

    BrainTwin->>BrainTwin: Process x_t through context encoder f_theta
    BrainTwin->>BrainTwin: Apply leaky temporal filter (Tau = 0.996)
    BrainTwin->>GMM: Compute soft posterior responsibilities gamma_k
    GMM->>Hysteresis: Evaluate boundary distance (delta_hyst = 0.15, N = 3)
    alt Cluster Transition Confirmed
        Hysteresis->>StateBus: Broadcast StateBusEvent (active_cluster_id, centroid_vector)
        StateBus->>Projector: Ingest active centroid coordinates
        Projector->>Projector: Map mu_k to parameter vector theta_cluster
        Projector->>TaskCache: Replenish pre-validated JSON task blueprints
    else Chattering Gated
        Hysteresis-->>BrainTwin: Hold active centroid (Zero boundary jitter)
    end
```

---

## 4. Sequence Diagram 3: State Transition & Prototype Explainability XAI (Member 3 → Member 2)

Ingests the prototype differential vector ($\Delta c$) to justify task pacing and generate non-clinical natural language explanations.

```mermaid
sequenceDiagram
    autonumber
    participant Member3 as "Member 3: Explainability Decoder"
    participant StateBus as "Internal State Bus"
    participant Member2 as "Member 2: XAI Explainer Engine"
    participant Safety as "Member 2: Non-Clinical Guardrail"
    participant Coach as "Member 2: AI Coach Chatbot"
    actor Learner as "Learner / Evaluator"

    Member3->>Member3: Compute Prototype Differential Delta c = W_eval * (mu_target - mu_active)
    Member3->>StateBus: Emit transition event with Delta c and uncertainty sigma
    StateBus->>Member2: Ingest differential vector
    Member2->>Member2: Translate Delta c into 5-part WhyThisTrail (Data, Inference, Advice, Confidence, Counterfactual)
    Member2->>Coach: Inject grounded prompt context
    Coach->>Safety: Send generated response for lexical sanitization
    Safety->>Safety: Scan against 18 banned clinical/guilt terms
    Safety-->>Coach: Sanitized non-clinical growth response
    Coach-->>Learner: Display conversational advice with expandable Why-This card
```

---

## 5. Sequence Diagram 4: Low-Latency Task Next & Runtime Adaptive Execution (Member 5 → Member 1)

Delivers pre-validated assessment JSON to the client in under 10 ms, verifies anti-repeat via Bloom filter, and executes client-side staircase adaptation.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as "Learner"
    participant Client as "Member 1: Assessment Interface"
    participant Dispatcher as "Member 5: Cache Dispatcher"
    participant Bloom as "Member 5: 14-Day Bloom Filter"
    participant TaskPool as "Member 5: Pre-Validated Blueprint Pool"

    Learner->>Client: Clicks "Start Next Exercise"
    Client->>Dispatcher: GET /v1/tasks/next?user_id=123
    Dispatcher->>Bloom: Check if variant seed was seen in last 14 days
    alt Seed Not Seen (Clean)
        Dispatcher->>TaskPool: Pop pre-validated JSON blueprint (<10ms)
        Dispatcher->>Bloom: Register variant seed
        Dispatcher-->>Client: Return TaskPayload (task_id, dimension, schema_type, params, surface_seed)
        Client->>Client: Initialize client-side Weighted Staircase (85% target)
        Client-->>Learner: Render reactive SVG/Canvas task stimuli
    else Seed Collision
        Dispatcher->>Dispatcher: Procedural seed shuffling without LLM delay
        Dispatcher-->>Client: Return reshuffled variant
    end
```

---

## 6. Sequence Diagram 5: Profile Ingestion, Radar Chart & Dashboard Analytics (Members 3 & 2 → Member 4)

Aggregates longitudinal profile estimates, confidence intervals, predictive ribbons, and AI collaboration scores into the visual analytics dashboard.

```mermaid
sequenceDiagram
    autonumber
    participant Member3 as "Member 3: Brain Twin State"
    participant Member2 as "Member 2: Collaboration Scorer"
    participant Member4API as "Member 4: Profile Aggregator (GET /v1/dashboard/profile)"
    participant DashboardUI as "Member 4: Dashboard & Radar UI"
    actor Evaluator as "Jury / Evaluator"

    Member3->>Member4API: Stream smoothed latent profile & uncertainty intervals
    Member2->>Member4API: Stream dynamic 5-dimension AI Collaboration Score
    Evaluator->>DashboardUI: Navigates to /dashboard
    DashboardUI->>Member4API: Fetch profile bundle (or load instant demo persona)
    Member4API-->>DashboardUI: Return DimensionEstimates, Snapshots, CollabScore
    DashboardUI->>DashboardUI: Render UncertaintyRadar with 95% CI bands
    opt Low Confidence Detected (confidence < 0.60)
        DashboardUI->>DashboardUI: Apply SVG diagonal stripe hatching (#low-confidence-hatch)
    end
    DashboardUI->>DashboardUI: Render ProjectionFanChart (g_phi forecasted trajectory)
    DashboardUI->>DashboardUI: Render CollaborationScoreCard (Dynamic weights w_i)
    DashboardUI-->>Evaluator: Present comprehensive visual analytics proof
```

---

## 7. Consumer UX, Behavioral Adaptation & Governance Flows

### Diagram 1: End-to-End User UX Flow (First Click to De-Cluttered Dashboard)

```mermaid
sequenceDiagram
    autonumber
    actor User as Human User
    participant Welcome as WelcomePage (/) [Manual Lock]
    participant Auth as AuthPage (/auth) [Manual Lock]
    participant Arena as Zen Practice Arena (/practice?mode=baseline)
    participant EMILY as EMILY Emotion Engine (Client JS)
    participant Twin as Brain Twin API (/v1/telemetry)
    participant Reveal as Twin Reveal (/reveal)
    participant Dash as Consumer Dashboard (/dashboard)

    User->>Welcome: Lands on site (sees BRIAN & "Start 2-Min Calibration")
    Welcome->>Auth: Clicks CTA -> 1-click Sign In or Guest Alias ("Maya")
    Auth->>Arena: Routes to distraction-free 2-Minute Baseline (4 micro-rounds)

    loop 4 Visual Micro-Rounds (~90s total)
        Arena->>User: Renders tactile visual puzzle (zero navbars or math clutter)
        User->>Arena: Moves pointer & clicks / presses keys
        Arena->>EMILY: Streams pointer velocity, jerk, curvature & dwell time
        Arena->>Twin: POST /v1/telemetry/event (rt_ms, accuracy, hesitation_jitter)
    end

    EMILY-->>Reveal: Sets initial ambient emotion state (e.g., calm_flow -> Teal)
    Twin-->>Reveal: Computes humanized "Thinking Style" + 6-Skill Clarity Halos
    Arena->>Reveal: Celebratory transition -> Shows "Steady Strategist" & top strengths
    User->>Reveal: Clicks "Enter My Cognitive Space →"
    Reveal->>Dash: Routes to de-cluttered 3-section Dashboard
    Dash->>User: Renders BRIAN greeting + EMILY Mood Pill, 6-Skill Radar & 7-Day Strip
```

---

### Diagram 2: EMILY Behavioral Emotion Tracking & Human-Approved Color Adaptation

```mermaid
sequenceDiagram
    autonumber
    actor User as Human User
    participant DOM as Browser DOM Listener (rAF ~50ms)
    participant Buffer as 15s Sliding Window Buffer
    participant EMILY as EMILY Circumplex Classifier
    participant Pill as BRIAN & EmilyMoodPill UI
    participant Theme as CSS Token Adapter (html[data-emotion])

    loop Continuous Passive Interaction
        User->>DOM: pointermove, mousedown, mouseup, click, keydown
        DOM->>Buffer: Pushes {x, y, t, type, target} (100% on-device)
    end

    loop Every 3000ms Evaluation Tick
        Buffer->>EMILY: Computes {velocity, jerk, pathDirectness, clickDwellMs, rageClicks, hoverHesitation, directionFlips}
        EMILY->>EMILY: Maps Valence x Arousal -> ('calm_flow' | 'energized' | 'frustrated' | 'hesitant' | 'fatigued')

        alt Positive State ('calm_flow' or 'energized')
            EMILY->>Theme: Smoothly transitions ambient tokens (Teal #0D9488 or Terracotta #D96B43)
            Theme->>User: Updates doodle card glow & BRIAN expression (WCAG >= 4.5:1 ink locked)
        else Stressed / Low-Energy State ('frustrated', 'hesitant', or 'fatigued')
            EMILY->>Pill: Triggers gentle BRIAN check-in ("Pace felt intense—switch to Calm Mode?")
            Pill->>User: Requests explicit Human Approval [Apply Calm Palette] / [Keep Current]
            opt User Approves Adaptation (or Manually Selects via Mood Pill)
                User->>Theme: Applies counter-regulatory Sage (#4D9078), Periwinkle (#5A67D8), or Indigo (#5C6B9C)
                Theme->>User: Softens visual density & slows task pacing
            end
        end
    end
```

---

### Diagram 3: Assessment Telemetry, Brain Twin (SAT-JEPA + 3x3 GMM), and <10ms Task Cache

```mermaid
sequenceDiagram
    autonumber
    participant Client as Layer A Client (tracker.ts)
    participant API as Telemetry API (/v1/telemetry/event)
    participant JEPA as Member 3: SAT-JEPA & 3x3 GMM
    participant Cache as Member 5: Bloom Filter Cache (/v1/tasks/next)
    participant Worker as Async LLM Blueprint Worker

    Client->>API: POST TelemetryEvent (score_norm, rt_ms, hesitation_jitter)
    API->>JEPA: Updates EMA latent state & leaky integrator filter
    JEPA->>JEPA: Evaluates 3x3 GMM posteriors + Schmitt-Trigger Hysteresis (N=3)
    JEPA->>Cache: Publishes active_cluster_id, centroid_vector & uncertainty
    Client->>Cache: GET /v1/tasks/next
    Cache->>Cache: Checks per-user Bloom Filter + 14-day TTL & shuffles procedural seed
    Cache-->>Client: Returns validated JSON task in <10ms
    Cache-)Worker: Async trigger if archetype pool drops below threshold
```

---

### Diagram 4: Explainable AI Coach, Non-Clinical Firewall & Dynamic Collaboration Scorer

```mermaid
sequenceDiagram
    autonumber
    actor User as Human User
    participant CoachUI as Coach Page (/coach)
    participant Guard as Non-Clinical Firewall (safety_guardrails.py)
    participant Scorer as Collaboration Scorer (collaboration_scorer.py)
    participant Agent as XAI Coach Agent (agent.py)

    User->>CoachUI: Asks question, verifies hint, or clicks "Why Brian suggests this"
    CoachUI->>Guard: Scans input for clinical/diagnostic terms
    CoachUI->>Scorer: Extracts 5 synergy signals (Clarification, Verification, Iteration, Autonomy, Responsible Use)
    Scorer-->>CoachUI: Updates 0-100 Co-Pilot Synergy Score (20/25/20/20/15 & Dynamic Weights)
    Agent->>Guard: Drafts empathetic response injected with Brain Twin progress delta (Δc) & EMILY mood
    Guard-->>CoachUI: Verifies 0 clinical terms & renders message + 3-bullet "Why Brian Suggests This" card
```

---

### Diagram 5: Human-in-the-Loop UX Review & Jargon Gate Workflow (?review_mode=true)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / Coding Agent
    participant Grill as Matt Pocock /grill-me & GLOSSARY.md
    participant App as Staging Preview (?review_mode=true)
    participant Gate as HumanReviewGate.tsx (DOM Scanner)
    actor Lead as Human UX Reviewer / Product Lead

    Dev->>Grill: Interrogates layout decisions & locks consumer vocabulary in GLOSSARY.md
    Grill->>App: Implements UI updates without touching locked Welcome/Auth pages
    Lead->>App: Opens screen with ?review_mode=true (or Shift + J drawer)
    App->>Gate: Runs automated DOM scan for forbidden jargon (JEPA, GMM, Sigma, Covariance) & contrast check
    Gate-->>Lead: Displays Jargon Check Status (0 violations), EMILY simulator, & "Approve Screen" button

    alt Fails Human UX Criteria or Jargon Found
        Lead->>Dev: Rejects screen with specific copy/density note
        Dev->>App: Refines layout & re-submits
    else Approved by Human Reviewer
        Lead->>Gate: Clicks "Approve Screen UX" (logs timestamped human sign-off to JSON report)
    end
```
```

