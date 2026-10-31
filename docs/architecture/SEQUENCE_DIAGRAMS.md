# System Architecture Sequence Diagrams

> **What is built (2026-10-31).** Sections 1–6 are the original challenge design (see [TEAM_PLAN.md](TEAM_PLAN.md)), not the running system. Live today in `backend/app`: telemetry ingest (`POST /v1/telemetry/event`), export (`GET /v1/user/export`) and delete (`DELETE /v1/user/telemetry`). These answer 501 until their ticket lands: `GET /v1/tasks/next` (BE-04), `POST /v1/coach/chat` and `GET /v1/coach/collaboration-score` (BE-06), `POST /v1/clustering/evaluate` (BE-11); `GET /v1/dashboard/profile` returns `not_enough_data` until BE-11. Section 7 describes the current consumer flows.
>
> **Source of truth**: `backend/app` · [`docs/ui/contracts.md`](../ui/contracts.md) · the root [`README.md`](../../README.md)  
> 🚀 **Interactive Visual Viewer**: Open [`sequence_diagrams_viewer.html`](./sequence_diagrams_viewer.html) in any browser to zoom, pan, inspect and export the 8 rendered diagrams. Section 7's diagrams 1, 2 and 4 were rewritten for brand v2 on 2026-10-31 and render from their Mermaid source only (GitHub draws them inline).

---

## 1. High-Level Closed-Loop Overview

The SynapseTwin platform operates as a closed-loop system across 5 decoupled sub-modules:

![High-Level 5-Subsystem Closed-Loop Overview](./diagrams/01-high-level-closed-loop.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/01-high-level-closed-loop.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/01-high-level-closed-loop.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

```mermaid
flowchart LR
    M1["Member 1: Assessment Execution"] -->|"Raw Telemetry (x_t)"| M3["Member 3: Brain Twin SAT-JEPA"]
    M3 -->|"Active Centroid (C_k)"| M5["Member 5: Assessment Gen & Cache"]
    M3 -->|"Archetype Delta (Δc)"| M2["Member 2: AI Coach & Collab Engine"]
    M5 -->|"Cached JSON Task (<10ms)"| M1
    M2 -->|"NL Feedback & Collab Scores"| M4["Member 4: Adaptive Dashboard"]
    M3 -->|"Latent Trajectories"| M4
```

</details>

---

## 2. Sequence Diagram 1: Assessment Execution & Telemetry Streaming (Member 1 → Member 3)

Captures non-biometric behavioral telemetry ($x_t$) without UI blocking, buffers local events during network drops, and flushes to the ingestion queue.

![Sequence Diagram 1: Assessment Execution & Telemetry Streaming (Member 1 → Member 3)](./diagrams/02-seq1-assessment-telemetry-streaming.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/02-seq1-assessment-telemetry-streaming.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/02-seq1-assessment-telemetry-streaming.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

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

</details>

---

## 3. Sequence Diagram 2: Latent Representation Encoding & Task Blueprints Cache (Member 3 → Member 5)

Encodes telemetry into continuous latent representations via SAT-JEPA, anchors into 9 GMM archetypes with Schmitt-trigger hysteresis, and projects parameters into the cache pool.

![Sequence Diagram 2: Latent Representation Encoding & Task Blueprints Cache (Member 3 → Member 5)](./diagrams/03-seq2-latent-representation-encoding.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/03-seq2-latent-representation-encoding.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/03-seq2-latent-representation-encoding.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

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

</details>

---

## 4. Sequence Diagram 3: State Transition & Prototype Explainability XAI (Member 3 → Member 2)

Ingests the prototype differential vector ($\Delta c$) to justify task pacing and generate non-clinical natural language explanations.

![Sequence Diagram 3: State Transition & Prototype Explainability XAI (Member 3 → Member 2)](./diagrams/04-seq3-prototype-explainability-xai.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/04-seq3-prototype-explainability-xai.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/04-seq3-prototype-explainability-xai.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

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

</details>

---

## 5. Sequence Diagram 4: Low-Latency Task Next & Runtime Adaptive Execution (Member 5 → Member 1)

Delivers pre-validated assessment JSON to the client in under 10 ms, verifies anti-repeat via Bloom filter, and executes client-side staircase adaptation.

![Sequence Diagram 4: Low-Latency Task Next & Runtime Adaptive Execution (Member 5 → Member 1)](./diagrams/05-seq4-low-latency-task-cache.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/05-seq4-low-latency-task-cache.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/05-seq4-low-latency-task-cache.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

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

</details>

---

## 6. Sequence Diagram 5: Profile Ingestion, Radar Chart & Dashboard Analytics (Members 3 & 2 → Member 4)

Aggregates longitudinal profile estimates, confidence intervals, predictive ribbons, and AI collaboration scores into the visual analytics dashboard.

![Sequence Diagram 5: Profile Ingestion, Radar Chart & Dashboard Analytics (Members 3 & 2 → Member 4)](./diagrams/06-seq5-profile-ingestion-dashboard.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/06-seq5-profile-ingestion-dashboard.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/06-seq5-profile-ingestion-dashboard.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

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

</details>

---

## 7. Consumer flows (brand v2), mood guess, coach and review

### Diagram 1: First visit (Welcome → Baseline → Results → Home)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Welcome as Welcome (/)
    participant Baseline as Baseline (/baseline)
    participant Device as This device (taskScores, pillars, sessionStore)
    participant Results as Results (/results)
    participant API as Server (backend/app)
    participant Home as Home (/dashboard)

    User->>Welcome: Opens the app (Loti says hi, one button: Start)
    Welcome->>Baseline: Start
    loop 6 exercises (Logic Web, Memory Gauntlet, Color Clash, Strategic Blueprint, Perceptual Radar, Precision Archive)
        Baseline->>User: Instruction, fixation "+", trials, end card
        User->>Baseline: Answers
        Baseline->>Device: Queues one telemetry event per trial (nothing sent yet)
    end
    Baseline->>Device: Scores the run and saves a session
    Baseline->>Results: Blurred 5-skill chart, then the Dolphin
    Results->>User: Save my answers / Keep them on this device only (equal weight)
    alt Save my answers
        Results->>API: POST /v1/telemetry/event (the queued events)
    else Keep them on this device only
        Results->>Device: Clears the queue; nothing is sent
    end
    Results->>Home: Go to my space
    Home->>User: Greeting, Momo, one Loti line, Start today's session, 5-skill chart
```

A returning device (at least one saved session) skips Welcome and the baseline and opens Home.

---

### Diagram 2: Momo's mood guess (on the device only)

See [EMILY](EMILY_BEHAVIORAL_EMOTION_ENGINE.md) and [ADR 0002](../adr/0002-no-server-side-emotion-inference.md).

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Listener as EmotionListener (app shell)
    participant Rules as emilyEngine.ts (hand-written rules)
    participant Store as useEmilyStore
    participant Momo as Momo (Home)

    loop While the user moves, taps and types
        User->>Listener: pointer, click and key events (kept in the browser)
    end
    loop Every 3 s
        Listener->>Rules: Sliding window of events
        Rules->>Store: A guess: calm_flow, energized, frustrated, hesitant or fatigued
        alt calm_flow or energized
            Store->>Momo: Calm or happy
        else Strained guess with task strain (rage clicks, or 2+ errors when reported)
            Store->>Momo: Proposed only; the user approves it or keeps the current mood
        end
    end
    User->>Store: Picks a mood (locks it until unlocked)
    Note over Listener,Momo: No mood label, buffer or metric is sent to the server.
```

---

### Diagram 3: Assessment Telemetry, Brain Twin (SAT-JEPA + 3x3 GMM), and <10ms Task Cache

![Assessment Telemetry, Brain Twin (SAT-JEPA + 3x3 GMM), and <10ms Task Cache](./diagrams/09-telemetry-jepa-cache.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/09-telemetry-jepa-cache.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/09-telemetry-jepa-cache.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client tracker (tracker.ts)
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

</details>

---

### Diagram 4: Loti, the crisis gates and the optional AI mode

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Loti as Loti page (/coach)
    participant Scripted as Scripted brain (frontend)
    participant API as POST /v1/coach/chat
    participant Gates as crisis_check, then backup classifier, then health_signpost
    participant LLM as LLM (only with a key and VITE_LOTI_COACH=on)
    participant Guard as Output guardrail (banned_terms.json)

    User->>Loti: Taps an answer chip (or types, in AI mode)
    alt Default: scripted
        Loti->>Scripted: Picks the next bubble from the user's own data on the device
        Scripted-->>Loti: Bubble and chips
    else AI mode (R14: every condition met)
        Loti->>API: The transcript the user actually saw (never Momo's mood or unseen scores)
        API->>Gates: Keyword crisis gate first, then the LLM backup classifier
        alt Crisis or health question
            Gates-->>Loti: Fixed reply: crisis line and emergency services, or "A doctor can."
        else Clear
            API->>LLM: Prompt with exercise-level context (no percentages)
            LLM->>Guard: Draft reply
            Guard-->>Loti: The reply, or a fixed fallback if any rule trips
        end
    end
```

`POST /v1/coach/chat` answers 501 until BE-06 ships it. The Collaboration Score (`GET /v1/coach/collaboration-score`, also 501 until BE-06) will be computed from real chat history only, and will appear only in Home's "Further explore" when there is enough data (BE-06/F-C).

---

### Diagram 5: Human-in-the-Loop UX Review & Jargon Gate Workflow (?review_mode=true)

![Human-in-the-Loop UX Review & Jargon Gate Workflow (?review_mode=true)](./diagrams/11-human-ux-review-jargon-gate.svg)

> 📊 **Rendered Visual Diagram**: [🔍 Open Vector SVG](./diagrams/11-human-ux-review-jargon-gate.svg) · [🖼️ View High-DPI Retina PNG](./diagrams/11-human-ux-review-jargon-gate.png)

<details open>
<summary><b>Mermaid Diagram Specification & Code</b></summary>

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

</details>