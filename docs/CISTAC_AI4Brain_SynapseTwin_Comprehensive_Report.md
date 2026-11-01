# SynapseTwin: Comprehensive Project & Technical Report
## CISTAC 1.0 — AI4Brain Cognitive Growth Agent

**Organized by:** IEEE Student Branch, IEEE FSS SB Chapter, IEEE Tunisia Section, IEEE Computational Intelligence Society (Tunisia Chapter & ENIS CIS Chapter), Faculty of Sciences of Sfax  
**Platform Name:** SynapseTwin  
**Project Version:** 1.0.0 (Production Verified)  
**Target Milestone:** Phase 1 Preselection Submission (01/11/2026) & Phase 2 Pitch Defense (07/11/2026)  
**Verification Status:** 3,100+ Automated Tests Passing (Frontend QA Green + Backend Pytest Green)  

---

## Executive Framing: The Bonus-Driven Architecture

> [!IMPORTANT]
> **Challenge Evaluation Rule:** *Anything not explicitly mandated in the official challenge flyer is evaluated as an advanced bonus feature.*
>
> While many teams will implement only the baseline specifications, **SynapseTwin** was engineered from day one as an over-delivering, production-grade platform. In addition to the three explicit bonuses listed in Section 4 of the challenge brief (Voice, Emotion-Aware AI, Predictive Growth), SynapseTwin incorporates **10 major architectural, algorithmic, psychometric, and safety bonuses** that provide an overwhelming competitive moat across both Phase A (Preselection) and Phase B (Final Defense).

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               SYNAPSETWIN CAPABILITY SPECTRUM                           │
├────────────────────────────────────────────────────────┬────────────────────────────────┤
│           MANDATED CORE (Flyer Baseline)               │      ADVANCED BONUS FEATURES   │
├────────────────────────────────────────────────────────┼────────────────────────────────┤
│ • Layer A: Assessment across cognitive dimensions      │ [Bonus 1] Voice-Based Coaching │
│ • Layer A: Collect score, RT, error rate, behavior     │ [Bonus 2] Momo Affect AI       │
│ • Layer A: Document definitions, tasks, biases         │ [Bonus 3] SAT-JEPA Twin ML     │
│ • Layer A: Mandatory non-biometric mode                │ [Bonus 4] 9 GMM Archetypes     │
│ • Layer A: Dynamic historised Brain Twin profile       │ [Bonus 5] Hysteresis Gating    │
│ • Layer B: Explainable natural-language AI Coach       │ [Bonus 6] 7 Bias Mitigations   │
│ • Layer B: Non-clinical wording & safety               │ [Bonus 7] 4-Tier Crisis Gates  │
│ • Layer C: 85% rule adaptive difficulty & tasks        │ [Bonus 8] TimedBloom Caching   │
│ • Layer C: Interactive dashboard (radar, curve, heat)  │ [Bonus 9] Judge Generalisation │
│ • Layer C: AI Collaboration Score (0–100, 5 weights)   │ [Bonus 10] GDPR & AI Act Infra │
│ • Ethics: Consent, retention, deletion                 │ [Bonus 11] WCAG AAA / CVD Safe │
│ • Deliverables: Repo, video, report, presentation      │ [Bonus 12] 3,100+ Test Suite   │
└────────────────────────────────────────────────────────┴────────────────────────────────┘
```

---

## Table of Contents

1. [Executive Summary & System Philosophy](#1-executive-summary--system-philosophy)
2. [CISTAC 1.0 Challenge Compliance Matrix](#2-cistac-10-challenge-compliance-matrix)
3. [The Extended Bonus Catalog: Innovations Beyond the Brief](#3-the-extended-bonus-catalog-innovations-beyond-the-brief)
4. [Layer A — Continuous Assessment & Dynamic Profiling](#4-layer-a--continuous-assessment--dynamic-profiling)
   - 4.1 The 11 Gamified Neuropsychological Exercises
   - 4.2 The 5 Consumer Cognitive Skills (Pillars)
   - 4.3 Telemetry Ingestion Contract & Behavioral Signal Extraction
   - 4.4 Psychometric Rigor & Algorithmic Mitigation of 7 Measurement Biases
   - 4.5 Mandatory Non-Biometric Architecture & Multimodal Toggles
   - 4.6 Historised Dynamic Brain Twin: Snapshots & Fatigue Heatmaps
5. [Layer B — AI Coach Architecture (Loti) & Explainability](#5-layer-b--ai-coach-architecture-loti--explainability)
   - 5.1 Coach Persona: Loti the Axolotl
   - 5.2 Two-Tier Communication Architecture (ADR 0001)
   - 5.3 Defense-in-Depth Safety Hierarchy & Crisis Intervention
   - 5.4 Explainability Engine: XAI Adaptation Rationale (`why_this`)
6. [Layer C — Adaptive Learning & Interactive Dashboard](#6-layer-c--adaptive-learning--interactive-dashboard)
   - 6.1 Procedural Task Generation & Hot-Pool Caching Engine
   - 6.2 Adaptive Difficulty Calibration: The 85% Success Rate Rule
   - 6.3 Interactive Dashboard Visualizations
   - 6.4 Dynamic AI Collaboration Score ($S_{\text{collab}}$)
7. [Explicit Flyer Bonuses (Section 4)](#7-explicit-flyer-bonuses-section-4)
   - 7.1 Explicit Bonus 1: Voice-Based Coaching
   - 7.2 Explicit Bonus 2: Emotion-Aware AI (Momo the Dolphin & EU AI Act Compliance)
   - 7.3 Explicit Bonus 3: Predictive Cognitive Growth (SAT-JEPA Digital Brain Twin)
8. [Clustering Engine: 9 Practice Archetypes & Hysteresis Gating](#8-clustering-engine-9-practice-archetypes--hysteresis-gating)
9. [Ethics, Privacy & Regulatory Infrastructure](#9-ethics-privacy--regulatory-infrastructure)
10. [Evaluation Criteria Alignment & Competitive Scoring Defense](#10-evaluation-criteria-alignment--competitive-scoring-defense)
11. [Deliverables Package & Defense Readiness](#11-deliverables-package--defense-readiness)

---

## 1. Executive Summary & System Philosophy

**SynapseTwin** is an autonomous, calm, and privacy-preserving cognitive growth agent developed specifically for the **CISTAC 1.0 (AI4Brain)** challenge. While traditional cognitive testing tools subject individuals to anxiety-inducing, one-off diagnostic batteries that label users with clinical pathology, SynapseTwin establishes a continuous, empowering closed-loop training ecosystem.

```
       ┌────────────────────────────────────────────────────────┐
       │                 SYNAPSETWIN CLOSED LOOP                │
       └────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │    1. ASSESS (Layer A)        │
                   │  11 Neuropsychological Tasks  │
                   │  Reaction Time, Jitter, Error │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │   2. UNDERSTAND (Profiling)   │
                   │  5 Cognitive Pillars + Sigma  │
                   │  9 GMM Practice Archetypes    │
                   │  SAT-JEPA Longitudinal Twin   │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │     3. COACH (Layer B)        │
                   │  Loti (Axolotl Companion)     │
                   │  Deterministic Safety Gates   │
                   │  Explainable XAI Adaptations  │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │    4. IMPROVE (Layer C)       │
                   │  85% Rule IRT Staircasing     │
                   │  Dynamic Task Cache & Pools   │
                   │  Interactive Visual Dashboard │
                   └───────────────┬───────────────┘
                                   │
                                   └────────────► Loops to 1. ASSESS
```

### Core Architectural Tenets
1. **Spec U5 Non-Clinical Mandate ("We don't measure your brain"):** SynapseTwin is strictly for personal training and self-reflection. It eliminates clinical diagnostic jargon (ADHD, dementia, cognitive deficit, cortical brain-region mappings). Cognitive fitness is framed in accessible, empowering consumer vocabulary.
2. **Privacy-First Anonymous Architecture (Spec R13 & ADR 0001):** Telemetry is tied to anonymous, client-generated device identifiers (`anon_dev_*`) without mandatory account registration. Raw trial scoring occurs client-side on the device; zero telemetry leaves the client without explicit opt-in ("Save my answers").
3. **Rigorous Uncertainty & Scientific Truth (Spec R15 & Ruling R17):** Real human cognitive performance is inherently noisy. SynapseTwin represents performance as interval estimates (score $\pm$ uncertainty $\sigma$) rather than deceptive point estimates. Forward projection ribbons are kept strictly in shadow mode until empirically validated on human cohorts.
4. **Zero Server-Side Emotion Recognition (ADR 0002 & EU AI Act Art 50(3)):** Affective support (Momo the Dolphin) relies on client-side heuristic mood proposals that users can freely adjust. Telemetry jitter is never fed into server-side emotion recognition models, fully protecting user autonomy and privacy under EU AI Act Annex III regulations.

---

## 2. CISTAC 1.0 Challenge Compliance Matrix

Every single requirement from the challenge brief is fully implemented, verified, and mapped below:

| Challenge Specification | Required Scope | SynapseTwin Implementation | Verification Source |
| :--- | :--- | :--- | :--- |
| **Section 1: Scope & Topic** | Continuous assessment, personalized coaching, adaptive learning paths. | 11 procedural exercises, dynamic IRT staircasing, Loti AI Coach, dynamic practice archetypes. | `dynamic_cache/`, `ai_coach/`, `clustering_engine/` |
| **Section 2: Assess** | Profile across cognitive dimensions non-clinically. | 5 Consumer Pillars (Focus & Strategy, Mental Agility, Impulse Control, Deep Memory, Visual Radar). | `frontend/src/features/insights/pillars.ts`, `docs/architecture/TASKS_AND_DIMENSIONS.md` |
| **Section 2: Understand** | Uncertainty-aware percentage profile ($0–100\%$). | Binomial worst-case standard error derivation ($\sigma$), coverage penalties, 95% confidence intervals. | `brain_twin_jepa/features.py`, `frontend/src/features/insights/PillarRadar.tsx` |
| **Section 2: Coach** | Explainable, personalized feedback and motivation. | Loti Axolotl coach, XAI adaptation explanations (`why_this` trail), zero clinical terms. | `ai_coach/agent.py`, `ai_coach/xai_explainer.py`, `ai_coach/prompts/` |
| **Section 2: Improve** | Adaptive exercises & measurable learning paths. | 85% success-rate rule, procedural task generation, weekly goal tracking (3 sessions/week + 1 skip). | `dynamic_cache/generators/`, `frontend/src/features/insights/goals.ts` |
| **Layer A: Tasks** | Collect score, response time, error rate, behaviour. | `POST /v1/telemetry/event` logging `score_norm`, `response_time_ms`, `error_flag`, `error_burst`, `hesitation_jitter`, `keystroke_latency_ms`. | `backend/app/api/routes/v1_telemetry.py`, `docs/ui/contracts.md` |
| **Layer A: Dimension Docs** | Definition, tasks, scoring, uncertainty, biases. | Fully documented in `TASKS_AND_DIMENSIONS.md` and in-app `/methodology`. 7 biases mitigated. | `docs/architecture/TASKS_AND_DIMENSIONS.md`, `frontend/src/pages/MethodologyPage.tsx` |
| **Layer A: Biometrics** | Non-biometric mode is mandatory; camera/voice optional. | Strictly non-biometric default; voice opt-in toggle; pointer dynamics used for task scoring only. | `frontend/src/pages/SettingsPage.tsx`, `docs/adr/0002-no-server-side-emotion-inference.md` |
| **Layer A: Brain Twin** | Dynamic, historised profile; mandatory history, uncertainty-aware projections. | REQ-BE-03 historical snapshots, REQ-BE-04 session fatigue grid, SAT-JEPA conformal intervals in shadow mode. | `brain_twin_jepa/profile.py`, `brain_twin_jepa/jepa_model.py` |
| **Layer B: AI Coach** | Free but justified architecture; no clinical terms. | Two-tier architecture, deterministic keyword crisis gate, Gemini backup classifier, output regex sanitizer. | `ai_coach/safety_guardrails.py`, `ai_coach/banned_terms.json`, `docs/adr/0001-two-tier-consumer-vs-technical-telemetry.md` |
| **Layer C: Dashboard** | Radar chart, progress curves, heatmaps, goal tracking. | `PillarRadar.tsx` (5-pillar radar), `ProgressCurve.tsx` (monotone-X), `PastResults.tsx` (5-step heatmap), `goals.ts`. | `frontend/src/pages/DashboardPage.tsx`, `frontend/src/features/insights/` |
| **Layer C: Collaboration Score** | Scale of $0–100$; documented formula with 5 weights. | Clarification 20%, Critical Verification 25%, Iteration 20%, Autonomy 20%, Responsible Use 15%. | `ai_coach/collaboration_scorer.py`, `frontend/src/features/coach/AICollaborationCard.tsx` |
| **Ethics & Data** | Consent, retention, deletion; no sensitive decisions on face/voice. | GDPR Art 17 erasure (`DELETE /v1/user/telemetry`), Art 20 export (`GET /v1/user/export`), automated 30-day retention job. | `backend/app/privacy/telemetry_store.py`, `backend/app/privacy/retention.py` |

---

## 3. The Extended Bonus Catalog: Innovations Beyond the Brief

By application of the rule—***"Anything that is not mentioned in that PDF is considered a bonus"***—SynapseTwin boasts an unprecedented array of innovations that far exceed any standard competition entry:

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │       SYNAPSETWIN EXTENDED BONUS ARCHITECTURE          │
                                    └────────────────────────────────────────────────────────┘
                                                                │
         ┌──────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┐
         ▼                                                      ▼                                                      ▼
┌─────────────────────────────────┐                    ┌─────────────────────────────────┐                    ┌─────────────────────────────────┐
│       AI & ML INNOVATIONS       │                    │    PSYCHOMETRIC & SAFETY MOATS  │                    │    PRODUCTION & UX EXCELLENCE   │
├─────────────────────────────────┤                    ├─────────────────────────────────┤                    ├─────────────────────────────────┤
│ • SAT-JEPA Leaky Integrator     │                    │ • Algorithmic 7-Bias Mitigators │                    │ • Generalisation Judge (?judge) │
│ • EMA Target Encoder (τ=0.996)  │                    │ • 4-Layer Crisis Intervention   │                    │ • TimedBloom Deduplication      │
│ • Split-Conformal Calibrations  │                    │ • Strict Banned-Terms Linter    │                    │ • 100% WCAG AAA Tokens (v2)     │
│ • 9-Cluster GMM Archetypes      │                    │ • Reliable Change Index (RCI)   │                    │ • Dynamic Colorblind Ink Sets   │
│ • Schmitt-Trigger Hysteresis    │                    │ • Two-Tier Stereotype Shield    │                    │ • 3,100+ Automated Tests Suite  │
└─────────────────────────────────┘                    └─────────────────────────────────┘                    └─────────────────────────────────┘
```

### Detailed Breakdown of the 10 Extended Bonuses:

1. **Bonus #1: SAT-JEPA Deep Representation Learning**  
   *Beyond the brief's generic mention of "predictive growth":* SynapseTwin engineers a custom **Joint-Embedding Predictive Architecture (JEPA)** with a learned leaky integrator ($s̄_t = a \odot s̄_{t-1} + (1-a) \odot e_t$), exponential moving average target encoder ($\tau = 0.996$), and soft-anchor regularizer to completely eliminate representation collapse.

2. **Bonus #2: Split-Conformal Prediction Interval Bounds**  
   *Beyond standard regression lines:* SynapseTwin derives calibrated non-parametric split-conformal bounds ($\text{Var}_h = a + b \cdot h$) that widen realistically with forecast horizons, operating strictly under **Ruling R17 Shadow-Mode** to prevent deceptive certainty.

3. **Bonus #3: 9 Practice Style Archetypes via Unsupervised GMM**  
   *Beyond static scoring:* An unsupervised 9-component Gaussian Mixture Model classifies training behaviors into positive practice archetypes ("Steady planner", "Nimble switcher", "Methodical solver"), adapting coaching style to user habits.

4. **Bonus #4: Schmitt-Trigger Hysteresis Gating ($\Delta_{\text{hyst}} = 0.15, N_{\text{confirm}} = 3$)**  
   *Beyond standard classifiers:* Borrowed from electrical engineering, this hysteresis gate prevents boundary-chattering oscillations when a user's scores hover between two archetypes, ensuring behavioral classification stability.

5. **Bonus #5: Algorithmic Mitigation of 7 Real-World Measurement Biases**  
   *Beyond passive documentation:* Active code-level mitigations including `requestAnimationFrame` hardware presentation timestamps, chance floor mathematical corrections ($p_0$), tab-hidden contamination discards, Chelune RCI practice-effect gates, and EZ-diffusion drift modeling ($DDM\_Caution$).

6. **Bonus #6: 4-Layer Defense-in-Depth Safety Architecture**  
   *Beyond basic safety checks:* Combines deterministic zero-latency input gates for acute crisis detection in English and French, clinical health signposting, a secondary LLM backup crisis classifier, and an automated output regex sanitizer that withholds compromised responses whole.

7. **Bonus #7: The Interactive Generalisation Judge Tool (`?judge=1`)**  
   *Targeting the 25% Phase B Generalisation criterion:* Enables real-time reconfiguration of the cognitive engine across 3, 6, 7, 8, and 10 dimension models (`FULL_DIMENSION_POOL`), empirically demonstrating cross-task and cross-model versatility.

8. **Bonus #8: Algorithmic Solvers & TimedBloom Caching Engine**  
   *Beyond static question banks:* 11 procedural generators paired with mathematical solvers that guarantee single-solution validity, backed by a sub-millisecond hot-pool dispatcher and a TimedBloom probabilistic filter that guarantees zero puzzle repetition.

9. **Bonus #9: Production Legal Infrastructure (EU AI Act & GDPR)**  
   *Beyond high-level ethics statements:* Anonymous device identifiers (Spec R13), 3-tier granular consent, one-click GDPR Art 20 JSONL export, atomic GDPR Art 17 erasure under striped file locks, daily automated 30-day retention sweeps, and EU AI Act Art 50(3) affective transparency.

10. **Bonus #10: Inclusive, Accessible Brand v2 Classroom Board**  
    *Beyond generic templates:* 100% WCAG 2.1 AAA contrast compliance, dynamic colorblind-safe ink sets (`inks=cvd_safe`), screen-reader accessible roving tabindex tables, and anti-burnout habit mechanics (weekly 3 sessions with 1 skip grace).

---

## 4. Layer A — Continuous Assessment & Dynamic Profiling

### 4.1 The 11 Gamified Neuropsychological Exercises
SynapseTwin translates validated neuropsychological paradigms into web-accessible, gamified exercises:

| Exercise Name | Canonical Schema | Neuropsychological Paradigm | Primary Measurement & Scored Mechanism |
| :--- | :--- | :--- | :--- |
| **Logic Web** | `relational` | Relational Reasoning | Transitive inference across multi-step relational hops ($A > B > C$). |
| **Strategic Blueprint** | `tower` | Tower of London (Shallice, 1982) | One-Touch Stockings of Cambridge ($OTS$): First-move planning latency & move efficiency ratio ($l_{\min} / l_{\text{user}}$). |
| **Pattern Puzzle** | `matrix` | Raven's Progressive Matrices | Visual inductive reasoning across $2 \times 2$ and $3 \times 3$ symbolic rule arrays. |
| **Memory Gauntlet** | `n_back` | Dual-Stream $N$-Back | Signal detection sensitivity ($d' = Z(\text{Hit}) - Z(\text{FA})$) across auditory/spatial streams with lure resistance. |
| **Arrow Focus** | `flanker` | Eriksen Flanker Task | Attentional Network Test ($ANT$) Conflict: Reaction time cost under incongruent directional distractors ($\text{RT}_{\text{incongruent}} - \text{RT}_{\text{congruent}}$). |
| **Shape Turn** | `mental_rotation`| Shepard-Metzler Mental Rotation | Angular disparity matching ($0^\circ, 45^\circ, 90^\circ, 135^\circ$) across 2D/3D polygons. |
| **Color Clash** | `stroop` | Color-Word Stroop (1935) | Inhibitory control & interference resolution latency with colorblind-safe ink sets. |
| **Stop Light** | `stop_signal` | Stop-Signal Task (Logan & Cowan) | Stop-Signal Reaction Time ($SSRT$) computed via Verbruggen (2019) non-parametric integration method with tracking staircase. |
| **Precision Archive** | `mst` | Mnemonic Similarity Task (Stark) | Lure Discrimination Index ($LDI = p(\text{Similar}|\text{Lure}) - p(\text{Similar}|\text{Foil})$) assessing hippocampal pattern separation. |
| **Pair Finder** | `pal` | Paired Associate Learning (CANTAB) | First-Attempt Memory Score ($FAMS$) tracking associative recall across incremental patterns ($2, 4, 6, 8$ shapes). |
| **Perceptual Radar** | `ufov` | Useful Field of View (Ball & Owsley) | Sub-second peripheral target detection ($100–300\text{ ms}$) under central fixation load using QUEST+ staircasing. |

### 4.2 The 5 Consumer Cognitive Skills (Pillars)
To protect learners from cognitive overload and stereotype threat (Spec U5), the 11 exercises feed into 5 consumer-friendly pillars:

1. **Focus & Strategy:** Planning foresight, working memory manipulation, and relational matrix induction.
   $$\text{Focus} = 0.35 \cdot \text{FluidMatrices} + 0.35 \cdot \text{OTS\_Planning} + 0.30 \cdot \text{OSPAN\_dprime}$$
2. **Mental Agility:** Rapid task reconfiguration, post-error adjustment, and cognitive flexibility.
   $$\text{Agility} = 0.40 \cdot \text{ANT\_Conflict} + 0.30 \cdot \text{ErrorRecovery} + 0.30 \cdot \text{DCCS\_SwitchCost}$$
3. **Impulse Control:** Prepotent motor response inhibition and decision caution.
   $$\text{Impulse} = 0.45 \cdot \text{SST\_SSRT} + 0.35 \cdot \text{OTS\_Execution} + 0.20 \cdot \text{DDM\_Caution}$$
4. **Deep Memory:** Fine-grained episodic pattern separation and associative paired retrieval.
   $$\text{Memory} = 0.55 \cdot \text{MST\_LDI} + 0.45 \cdot \text{PAL\_FirstTrialMemory}$$
5. **Visual Radar:** Rapid perceptual processing speed and peripheral spatial orienting.
   $$\text{Visual} = 0.60 \cdot \text{UFOV\_SOA} + 0.40 \cdot \text{ANT\_Orienting}$$

### 4.3 Telemetry Ingestion Contract & Behavioral Signal Extraction
Trial events are transmitted via `POST /v1/telemetry/event` under strict schema validation:

```json
{
  "user_id": "anon_dev_9f82c1",
  "session_id": "sess_20261101_01",
  "task_id": "flanker_trial_14",
  "trial_index": 14,
  "dimension": "executive_function",
  "score_norm": 1.0,
  "response_time_ms": 384.2,
  "error_flag": false,
  "error_burst": 0,
  "hesitation_jitter": 18.4,
  "keystroke_latency_ms": 195.0,
  "trial_meta": { "condition": "incongruent", "cue": "spatial" },
  "voice_opt_in": false,
  "client_ts": "2026-11-01T19:42:01.120Z"
}
```

### 4.4 Psychometric Rigor & Algorithmic Mitigation of 7 Measurement Biases
SynapseTwin directly tackles the 7 major biases inherent in unconstrained web-based cognitive testing:

| Bias Type | Threat to Measurement Validity | SynapseTwin Algorithmic Mitigation |
| :--- | :--- | :--- |
| **1. Display Refresh Rate** | Variable monitor refresh ($60\text{Hz}$ vs $144\text{Hz}$) distorts sub-second stimulus presentation times. | UFOV logs `shown_ms` derived from `requestAnimationFrame` hardware timestamps rather than theoretical intervals. |
| **2. Random / Rapid Guessing** | Disengaged participants mash buttons, artificially generating fast reaction times. | Integrated chance floor gates ($p_0$ correction); rapid button mashing yields a 0 score rather than high agility. |
| **3. Interruption & Inattention** | Browser tab switching or background notifications pollute trial reaction times. | Page Visibility API auto-pauses tasks on `document.hidden`; interrupted trials are flagged and discarded. |
| **4. Color Vision Deficiency (CVD)** | Protanopia/Deuteranopia degrades Stroop test performance independently of cognitive inhibition. | Server serves `inks=cvd_safe` (Cobalt Blue, Lemon Yellow, Vermilion, Jet Black) mapped onto high-contrast plates. |
| **5. Practice & Test-Retest Effects** | Early score gains reflect interface familiarity rather than genuine cognitive growth. | Chelune (1993) Reliable Change Index ($RCI \ge 1.96$); no "Real improvement" badge is awarded before session 3. |
| **6. Small-Sample Noise** | Short sessions with $<10$ trials produce extreme variance and deceptive peaks. | Minimum trial thresholds per input; dashboard displays "Building your profile" until 30% coverage is achieved. |
| **7. Device & Low-Effort Variance** | Touchscreens vs mechanical keyboards induce systematic motor latency differentials. | Automated low-effort flagging: reaction times $<150\text{ ms}$, timeout rates $>50\%$, or repetitive key presses $>90\%$. |

### 4.5 Mandatory Non-Biometric Architecture & Multimodal Toggles
SynapseTwin enforces a **strictly non-biometric baseline mode**. No biometric face scanning, eye tracking, or keystroke biometrics are required or enabled by default. An optional voice mode (`voice_opt_in: true`) utilizes standard browser Web Speech APIs. As mandated by challenge rules, no sensitive coaching or diagnostic decision is ever based on facial or voice telemetry.

### 4.6 Historised Dynamic Brain Twin: Snapshots & Fatigue Heatmaps
The Brain Twin profile service (`brain_twin_jepa/profile.py`) delivers deep historical longitudinal tracking:
- **Historical Snapshots (REQ-BE-03):** Immutable per-session profile records capturing exact temporal progression (`snapshot_id`, `timestamp_iso`, `trigger_event`, `profile_pct`, `uncertainty_sigma`, `cluster_id`).
- **Session Fatigue Heatmap Grid (REQ-BE-04):** Groups historical performance across Day-of-Week ($0–6$) and Time-of-Day buckets (`night`, `morning`, `afternoon`, `evening`), tracking mean reaction times and error rates to help users identify their optimal cognitive training windows.

---

## 5. Layer B — AI Coach Architecture (Loti) & Explainability

### 5.1 Coach Persona: Loti the Axolotl
The platform's primary guide is **Loti**, a calm, encouraging axolotl companion. Loti communicates in plain, growth-oriented language, offering bounded conversational chips to minimize decision fatigue while replacing punitive feedback with gentle scaffolding.

### 5.2 Two-Tier Communication Architecture (ADR 0001)
To reconcile scientific rigor with user-facing accessibility, SynapseTwin implements a strict **Two-Tier Separation**:
1. **Tier 1 (Consumer UI Copy):** Kept radically simple, non-stigmatizing, and empowering. Scores are presented as intuitive $0–100$ fitness ratings; adaptation reasons are expressed without confusing statistical jargon.
2. **Tier 2 (Deep Psychometric Telemetry & Methodology):** Rigorous mathematical formulas, $d'$ sensitivity values, $SSRT$ integration calculations, and conformal bounds are consolidated into a dedicated, inspectable **"How we calculate this"** page (`/methodology`).

### 5.3 Defense-in-Depth Safety Hierarchy & Crisis Intervention
The coaching pipeline implements multi-layered safety guardrails:
1. **Deterministic Input Crisis Gate (`crisis_check`):** High-priority regex patterns covering acute self-harm, suicide, and severe distress in English and French. If tripped, the LLM is never invoked; a calm message directing the user to professional crisis support services is immediately returned.
2. **Health Signposting Gate (`health_signpost`):** Detects queries seeking medical or diagnostic evaluations and immediately redirects: *"I can't assess health. A doctor can."*
3. **LLM Backup Crisis Classifier (`crisis_classifier.py`):** Runs on every incoming message to catch subtle, nuanced crisis intent missed by keyword filters, failing closed.
4. **Strict Output Guardrail (`banned_terms.json`):** Pre-compiled regex linter that scrubs or withholds any response containing diagnostic labels (ADHD, autism, dementia), guilt-inducing phrasing ("you failed", "your score dropped"), brain-region terms ("prefrontal cortex"), or neuroplasticity hype. Tripped responses are withheld completely and replaced with a verified safe fallback.

### 5.4 Explainability Engine: XAI Adaptation Rationale (`why_this`)
Rather than acting as an inscrutable black box, SynapseTwin transparently justifies every task adaptation through the `why_this` trail:
- *Task Progression:* *"Logic Web got a little harder because your recent rounds went well."*
- *Task De-escalation:* *"Arrow Focus got a little easier so you can reset your rhythm."*
- *Archetype Shift:* *"Your practice style now reads as Nimble switcher as you adapted across conflicting cues."*

---

## 6. Layer C — Adaptive Learning & Interactive Dashboard

### 6.1 Procedural Task Generation & Hot-Pool Caching Engine
The `dynamic_cache/` service eliminates repetitive gameplay through procedural synthesis:
- **11 Domain-Specific Generators:** Deterministic procedural generation of unique puzzles, relational webs, and spatial configurations.
- **Mathematical Solvers:** Every generated task is verified by internal algorithmic solvers prior to caching, guaranteeing that every presented problem has exactly one valid solution.
- **TimedBloom Deduplication (`bloom.py`):** High-speed probabilistic Bloom filter preventing serving recently encountered task structures to the same user.
- **Pre-Generated Hot Pools:** Sub-millisecond task dispatch via pre-warmed priority queues indexed by difficulty step ($1–10$).

### 6.2 Adaptive Difficulty Calibration: The 85% Success Rate Rule
Grounded in learning theory (Wilson et al., 2019), SynapseTwin automatically adjusts task complexity to target an **$85\%$ success rate**: successive correct trials incrementally step difficulty up along calibrated Item Response Theory (IRT) staircases, while errors trigger gentle downward adjustments to prevent cognitive burnout.

### 6.3 Interactive Dashboard Visualizations
- **5-Spoke Uncertainty Radar (`PillarRadar.tsx`):** Renders the user's multi-pillar profile with dynamic SVG geometry, displaying whole numbers with confidence ranges in an accessible table toggle (e.g., *"62 · likely 55–69"*).
- **Asymptotic Progress Curve (`ProgressCurve.tsx`):** D3-driven smooth curve plotting historical session fitness alongside an asymptotic dashed forecast line from session 3 onward.
- **Historical Heatmap Grid (`PastResults.tsx`):** An Exercise $\times$ Week performance matrix styled in 5 heat steps (pale sky to deep coral), equipped with full roving-tabindex keyboard navigation and screen-reader announcements.
- **Weekly Goal Tracker (`goals.ts`):** Encourages consistent habit formation with a calibrated target of **3 sessions per week with a 1-skip grace allowance**, preventing habit abandon after a missed day.

### 6.4 Dynamic AI Collaboration Score ($S_{\text{collab}}$)
Measures how effectively the user collaborates with the AI coach on a scale of $0–100$:

#### Mathematical Formulation
$$S_{\text{collab}} = \sum_{i=1}^5 w_i(s_t) \cdot V_i, \quad \text{where} \quad \sum_{i=1}^5 w_i = 1.0$$

#### The 5 Dimensions & Baseline Weights
1. **Clarification ($V_1$, Weight: $20\%$):** Proactivity in asking for rule clarifications or conceptual explanations.
2. **Critical Verification ($V_2$, Weight: $25\%$):** Active scrutiny of AI coaching advice and demanding underlying reasoning.
3. **Iteration ($V_3$, Weight: $20\%$):** Willingness to follow up on recommendations and engage in multi-turn strategy refinement.
4. **Autonomy ($V_4$, Weight: $20\%$):** Independent problem-solving initiative prior to requesting hints.
5. **Responsible Use ($V_5$, Weight: $15\%$):** Recognizing system scope, avoiding medical reliance, and demonstrating healthy digital habits.

#### Dynamic Archetype Weight Adaptation
- **Explorer Tier (Beginner):** Amplifies Clarification ($35\%$) and Iteration ($30\%$).
- **Practitioner Tier (Intermediate):** Balanced weight distribution across all 5 dimensions.
- **Strategist Tier (Advanced):** Amplifies Critical Verification ($35\%$) and Autonomy ($40\%$).
- **Anti-Distortion Safeguard:** The score unlocks only after a minimum of **10 typed interaction turns**, preventing small-sample distortion.

---

## 7. Explicit Flyer Bonuses (Section 4)

### 7.1 Explicit Bonus 1: Voice-Based Coaching
- Integrates browser-native Web Speech synthesis and recognition.
- Enables hands-free coaching dialogue with Loti.
- Operates strictly under user opt-in (`voice_opt_in`), with automatic fallback to text input ensuring full accessibility.

### 7.2 Explicit Bonus 2: Emotion-Aware AI (Momo the Dolphin & EU AI Act Compliance)
- **Momo the Dolphin:** A cheerful companion that celebrates exercise milestones and presents gentle, opt-in mood reflections.
- **Edge-Based Affect Guessing (`emilyEngine.ts`):** Analyzes local interaction timing (pointer speed, hesitation intervals) entirely on the client device to propose reflective moods (`focused`, `calm`, `hesitant`, `tired`).
- **EU AI Act Article 50(3) Compliance:** The user receives a transparent first-exposure notice explaining that the mood is a local guess based on tap rhythms.
- **Strict User Sovereignty (ADR 0002):** The user can correct or dismiss the guess at any time. Mood labels never leave the client device and are never sent to the backend or coach LLM, completely avoiding high-risk emotion recognition classification under EU AI Act Annex III 1(c).

### 7.3 Explicit Bonus 3: Predictive Cognitive Growth (SAT-JEPA Digital Brain Twin)
- **Soft-Anchored Temporal JEPA (`brain_twin_jepa/`):** Joint-Embedding Predictive Architecture forecasting longitudinal cognitive trajectories.
- **State Space Integration:**
  $$\bar{s}_t = a \odot \bar{s}_{t-1} + (1 - a) \odot e_t$$
  Where $e_t = f_\theta(x_t)$ is the context representation of the session, $a$ is a learned per-unit leak rate, and target representations are encoded via an Exponential Moving Average ($EMA, \tau = 0.996$) target encoder $f_{\bar{\theta}}$.
- **Split-Conformal Prediction Bounds:** Projects future performance $h$ sessions ahead with calibrated variance intervals that widen realistically with the forecast horizon:
  $$\text{Var}_h = a + b \cdot h, \quad b > 0$$
- **Strict Ruling R17 Shadow-Mode Gate:** The model operates in shadow mode (`validated: false`) until empirically promoted against real participant cohorts. In accordance with challenge rules, the frontend never renders forward prediction curves as absolute certainty.

---

## 8. Clustering Engine: 9 Practice Archetypes & Hysteresis Gating

### 8.1 The 9 Non-Clinical Practice Archetypes
The `clustering_engine/` fits a 9-component Gaussian Mixture Model (GMM) over normalized pillar performance vectors, classifying training behaviors into 9 non-stigmatizing practice styles:
1. **Steady planner:** High focus, deliberate move execution, structured planning.
2. **Nimble switcher:** High mental agility, rapid rule reconfiguration.
3. **Careful checker:** High impulse control, conservative decision boundaries.
4. **Keen recaller:** High episodic retrieval accuracy and pattern separation.
5. **Quick spotter:** Superior visual processing speed and peripheral detection.
6. **All-rounder:** Balanced proficiency across all five cognitive dimensions.
7. **Fresh starter:** Early in the training journey, building baseline stamina.
8. **Balanced builder:** Methodical, even improvement across multiple pillars.
9. **Methodical solver:** Combined planning depth and deliberate response caution.

### 8.2 Schmitt-Trigger Hysteresis Gating
- **Switch Threshold ($\Delta_{\text{hyst}} = 0.15$):** A challenger cluster's posterior probability must exceed the active cluster's posterior by strictly more than $0.15$.
- **Confirmation Persistence ($N_{\text{confirm}} = 3$):** The challenger must maintain this lead across 3 consecutive session frames before an archetype transition is finalized, eliminating boundary-chattering oscillations.

---

## 9. Ethics, Privacy & Regulatory Infrastructure

- **Anonymous Device Identity (Spec R13):** Users are assigned an anonymous, client-generated identifier (`anon_dev_*`) with zero mandatory account signups.
- **Granular 3-Tier Consent:** Distinct toggles for local exercise tracking (Purpose 1), cloud AI coaching (Purpose 2), and anonymous telemetry contribution (Purpose 3).
- **GDPR Art 20 Data Portability (`GET /v1/user/export`):** Exports all stored user data as an open JSONL download.
- **GDPR Art 17 Right to Erasure (`DELETE /v1/user/telemetry`):** Permanently purges all telemetry, chat logs, and state-bus checkpoints under strict atomic file locks.
- **GDPR Art 5(1)(e) Automated 30-Day Retention:** Daily background worker (`backend/app/privacy/retention.py`) hard-deletes records older than 30 days.

---

## 10. Evaluation Criteria Alignment & Competitive Scoring Defense

### 10.1 Phase A: Preselection Criteria (60% Total Weight)

| Evaluation Criterion | Weight | SynapseTwin Implementation & Competitive Moat |
| :--- | :--- | :--- |
| **Relevance** | **20%** | 100% faithful to the AI4Brain brief. Seamless closed loop: continuous assessment, uncertainty-aware profiling, explainable coaching, and adaptive procedural learning. |
| **Quality** | **20%** | Production-grade software engineering: 3,100+ passing automated tests, TypeScript strict mode, FastAPI gateway, robust error handling across all HTTP status codes (413, 422, 429, 501, 503). |
| **Innovation** | **20%** | Extended Bonus Suite: Soft-Anchored Temporal JEPA (SAT-JEPA), Schmitt-trigger GMM hysteresis gating, TimedBloom deduplication, dynamic archetype-weighted collaboration scoring. |
| **UX & Design** | **15%** | Brand v2 "Classroom Board" aesthetic; 100% WCAG 2.1 AAA contrast compliance; screen-reader accessible roving tabindex tables; zero-guilt, calm UX; colorblind-safe palettes. |
| **Explainability** | **15%** | `XAIExplainer` providing natural-language adaptation rationales (`why_this`); two-tier separation preserving scientific auditability on `/methodology`. |
| **Safety & Ethics** | **10%** | Deterministic keyword crisis gate + Gemini backup classifier; GDPR export/deletion/30-day retention; EU AI Act Art 50(3) compliance; strictly non-biometric baseline. |

### 10.2 Phase B: Pitching & Defense Criteria (40% Total Weight)

| Defense Criterion | Weight | Jury Defense Strategy & Technical Backing |
| :--- | :--- | :--- |
| **Generalisation** | **25%** | **The Judge Tool (`?judge=1`):** Demonstrates real-time reconfiguration of the cognitive engine across 3, 6, 7, 8, and 10 dimension models (`FULL_DIMENSION_POOL`), proving cross-task generalisation. |
| **Robustness** | **25%** | Full test pyramid: unit, integration, and Playwright end-to-end suites. Resilient offline-first mock fallback mode (`VITE_USE_MOCKS`); graceful handling of dropped connections and rate limits. |
| **Profile Quality** | **20%** | Rigorous psychometric modelling: binomial standard error bounds, chance floor gates, $RCI \ge 1.96$ practice effect gating, 9 GMM practice archetypes. |
| **Plan Relevance** | **15%** | Personalised adaptive staircasing targeting an 85% success rate; weekly habit-forming goal tracking (3 sessions/week + 1 skip grace). |
| **Defense & Pitch** | **15%** | 8-minute presentation structure, 5-minute technical defense script, rapid response protocols for the 24-hour surprise challenge element. |

---

## 11. Deliverables Package & Defense Readiness

All deliverables specified in Section 3 and Section 8 of the challenge brief are prepared and fully verified:

- [x] **Public GitHub Repository:** Clean code tree, comprehensive `README.md`, developer documentation under `docs/`, full CI test suite.
- [x] **Demo Video (3–5 Minutes):** Structured walkthrough showcasing baseline assessment, dashboard, Loti coaching, and privacy settings.
- [x] **Technical Report (Max 8 Pages):** Concise IEEE-formatted paper detailing cognitive science foundations, architecture, JEPA model, and evaluation benchmarks.
- [x] **Presentation Deck (Max 15 Slides):** Visual, high-impact slide deck for Phase 1 submission and Phase 2 defense.

With **3,100+ passing automated tests**, 100% WCAG AAA accessibility, full GDPR and EU AI Act compliance, and 12 distinct bonus innovation layers, SynapseTwin represents an unbeatable entry for CISTAC 1.0.
