# SynapseTwin

SynapseTwin is a calm, privacy-first cognitive-training web platform developed for the **CISTAC 1.0 (AI4Brain)** challenge that helps users train, track, and reflect on their mental fitness without medical claims or clinical jargon. Built on validated neuropsychological paradigms (such as oMST, UFOV, Stroop, Flanker, Stop Signal, and CANTAB PAL), the platform offers 11 gamified exercises that map into five core skills—Focus & Strategy, Mental Agility, Impulse Control, Deep Memory, and Visual Radar—driven by an adaptive procedural task generator that dynamically calibrates difficulty using an 85% success-rate rule. 

Users are guided through their training by **Loti**, an explainable, non-clinical AI axolotl coach equipped with multi-layered safety guardrails and transparent adaptation reasoning, alongside **Momo**, a dolphin companion who celebrates milestones and supports opt-in mood reflection. Under the hood, an in-process state bus connects performance telemetry to 9 non-clinical practice style archetypes (GMM) with hysteresis gating and a Joint-Embedding Predictive Architecture (SAT-JEPA) digital brain twin for longitudinal session forecasting, all while upholding strict privacy principles through anonymous device identifiers, client-side scoring, full data export/deletion controls, and automated 30-day data retention.

In accordance with spec U5, **SynapseTwin is strictly for personal training and self-reflection, not a medical or diagnostic tool** ("we don't measure your brain"; no clinical claims or brain-region names are surfaced to users).

> **Competition Report:** For complete IEEE challenge alignment, psychometric derivations, and jury defense details, see [docs/CISTAC_AI4Brain_SynapseTwin_Comprehensive_Report.md](docs/CISTAC_AI4Brain_SynapseTwin_Comprehensive_Report.md).

---

## CISTAC 1.0 Challenge Alignment & Bonus Catalog

Under challenge rules (*"Anything not explicitly mentioned in the PDF flyer is considered a bonus"*), SynapseTwin provides 100% of the flyer baseline plus **12 advanced innovation bonuses**:

### 1. Mandated Flyer Baseline (100% Delivered)
- **Continuous Assessment (Layer A):** 11 exercises, tracking normalized score, reaction time, error rate, and hesitation behavior.
- **Explainable AI Coach (Layer B):** Loti the Axolotl provides natural-language guidance without clinical jargon.
- **Adaptive Learning & Dashboard (Layer C):** Dynamic task adaptation, 5-spoke uncertainty radar, progress curves, heatmaps, and weekly goal tracking.
- **AI Collaboration Score ($0–100$):** Documented 5-dimension weighted formula measuring user collaboration with the AI coach.
- **Privacy & Ethics:** 3-tier granular consent, automated 30-day data retention, complete data export and deletion, with a strictly non-biometric mandatory baseline.

### 2. Explicit Flyer Bonuses (Section 4)
- **Voice-Based Coaching:** Optional hands-free Web Speech API integration (`voice_opt_in`).
- **Emotion-Aware AI:** Momo the Dolphin mood reflection with client-side affect guessing and EU AI Act Art 50(3) transparent notification.
- **Predictive Cognitive Growth:** Soft-Anchored Temporal JEPA (SAT-JEPA) longitudinal forecasting with split-conformal prediction intervals.

### 3. Extended Innovation Bonuses (Beyond the Flyer)
- **SAT-JEPA Leaky Integrator Architecture:** Context MLP ($f_\theta$), EMA target encoder ($f_{\bar{\theta}}, \tau=0.996$), learned temporal integrator leak ($a$), and soft anchor regularizer to eliminate representation collapse (`brain_twin_jepa/`).
- **9 Practice Style Archetypes (GMM):** Unsupervised Gaussian Mixture Model clustering training styles into non-stigmatizing profiles ("Steady planner", "Nimble switcher", "Methodical solver") (`clustering_engine/`).
- **Schmitt-Trigger Hysteresis Gating:** $\Delta_{\text{hyst}} = 0.15, N_{\text{confirm}} = 3$ consecutive frames to eliminate boundary-chattering oscillation across clusters.
- **Algorithmic Mitigation of 7 Real-World Measurement Biases:** Sub-second hardware display timestamping (`shown_ms`), chance floor corrections ($p_0$), tab-hidden auto-pause, colorblind-safe palettes, Chelune RCI practice-effect gating ($RCI \ge 1.96$), and EZ-diffusion drift modeling ($DDM\_Caution$).
- **4-Tier Defense-in-Depth Safety Architecture:** Deterministic bilingual crisis interception, medical signposting, secondary Gemini crisis backup classifier, and automated whole-reply withholding via regex banned-terms filtering (`ai_coach/`).
- **Generalisation Judge Tool (`?judge=1`):** Real-time dimension switching across 3, 6, 7, 8, and 10 dimensions (`FULL_DIMENSION_POOL`), directly capturing the 25% Phase B Generalisation score.
- **Procedural Algorithmic Task Generation & Solvers:** 11 procedural generators paired with mathematical solvers proving single-solution validity, sub-millisecond hot-pool dispatching, and TimedBloom deduplication (`dynamic_cache/`).
- **Production GDPR & EU AI Act Legal Infrastructure:** Anonymous device IDs (Spec R13), atomic erasure under striped file locks, one-click JSONL export, automated daily retention sweeps, and zero server-side emotion inference (ADR 0002).
- **Inclusive Brand v2 Design System:** 100% WCAG 2.1 AAA contrast compliance, screen-reader roving tabindex grids, and anti-burnout weekly goal pacing (3 sessions/week + 1 skip).
- **Extreme Reliability Suite:** 3,100+ passing automated tests and resilient offline-first mock fallback mode.

---

## The 5 Skills & 11 Exercises

| Skill (Pillar) | Exercise | Schema Type | Telemetry Dimension | Paradigm / Measurement |
| :--- | :--- | :--- | :--- | :--- |
| **Focus & Strategy** | Logic Web | `relational` | `pattern_induction` | Relational reasoning across multi-step hops |
| | Strategic Blueprint | `tower` | `executive_function` | Tower of London planning time & move efficiency |
| | Pattern Puzzle | `matrix` | `pattern_induction` | Visual matrix pattern completion (Raven-style) |
| | Memory Gauntlet | `n_back` | `working_memory` | Dual-stream n-back working memory ($d'$ signal detection) |
| **Mental Agility** | Arrow Focus | `flanker` | `executive_function` | Eriksen flanker conflict resolution & spatial cues |
| | Shape Turn | `mental_rotation` | `spatial_orientation` | 2D/3D polygon angle matching |
| | Color Clash | `stroop` | `executive_function` | Stroop interference & conflict resolution (fallback proxy) |
| | *Cross-Task* | *all tasks* | *multi-dimensional* | `ErrorRecovery`: accuracy on trials immediately following errors |
| **Impulse Control** | Stop Light | `stop_signal` | `executive_function` | Stop-Signal Reaction Time (SSRT, Verbruggen integration) |
| | Strategic Blueprint | `tower` | `executive_function` | `OTS_Execution`: ratio of minimum to actual moves ($l_{\min} / l_{\text{user}}$) |
| | *Cross-Task* | `stop_signal`, `flanker`, `stroop` | `executive_function` | `DDM_Caution`: EZ-diffusion boundary separation ($a$) on speeded 2AFC |
| **Deep Memory** | Precision Archive | `mst` | `episodic_memory` | Mnemonic Similarity Task (Lure Discrimination Index, LDI) |
| | Pair Finder | `pal` | `episodic_memory` | Paired Associate Learning (CANTAB first-attempt accuracy) |
| **Visual Radar** | Perceptual Radar | `ufov` | `processing_speed` | Useful Field of View (QUEST+ adaptive threshold & peripheral accuracy) |

*For mathematical scoring derivations, gate thresholds, and evidence reviews, see [docs/architecture/TASKS_AND_DIMENSIONS.md](docs/architecture/TASKS_AND_DIMENSIONS.md) and the in-app "How we calculate this" page (`/methodology`).*

---

## AI Collaboration Score Formula

The AI Collaboration Score ($S_{\text{collab}} \in [0, 100]$) evaluates how constructively the learner interacts with the AI guide:

$$S_{\text{collab}} = \sum_{i=1}^5 w_i(s_t) \cdot V_i, \quad \text{where} \quad \sum_{i=1}^5 w_i = 1.0$$

- **Clarification ($V_1$, Weight: $20\%$):** Proactivity in asking for rule clarifications, task strategies, or conceptual explanations.
- **Critical Verification ($V_2$, Weight: $25\%$):** Active scrutiny of AI coaching advice, demanding underlying reasoning, and self-testing.
- **Iteration ($V_3$, Weight: $20\%$):** Willingness to follow up on recommendations and engage in multi-turn strategy refinement.
- **Autonomy ($V_4$, Weight: $20\%$):** Independent problem-solving initiative prior to requesting hints.
- **Responsible Use ($V_5$, Weight: $15\%$):** Recognizing non-clinical system scope and demonstrating healthy digital training habits.

Weights dynamically tune to the user's active GMM practice tier (Explorer, Practitioner, Strategist) while enforcing a 10-turn minimum threshold to prevent small-sample distortion.

---

## Workspace Modules

```
CISTAC/
├── frontend/             # Single-page web app (React 18, Vite, TypeScript, Tailwind v4, Zustand)
├── backend/              # Unified API server (FastAPI) and privacy telemetry store
│   └── app/              # Routes (/v1), lifecycle hooks, data retention, and exercise rules
├── ai_coach/             # Loti: crisis filter, safety guardrails, Gemini runner, collaboration scorer
├── dynamic_cache/        # Task dispatcher (/v1/tasks/next), 11 procedural generators & solvers, LLM pool
├── clustering_engine/    # 9 practice style archetypes (GMM) with hysteresis state gating
├── brain_twin_jepa/      # Brain twin: session features, profile builder, fatigue grid, JEPA forecasts
├── data/                 # Synthetic generator (data/synthetic) & local telemetry storage (data/raw)
├── docs/                 # Centralized documentation, specifications, glossary, and ADRs
└── scripts/              # Development runners, diagram parsers, and golden fixture utilities
```

---

## API Endpoints

All endpoints are mounted on the single FastAPI application (`backend/app/main.py`) under `/v1`:

| Method | Route | Module | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/telemetry/event` | `backend/app/api` | Ingests batches of anonymized trial telemetry events under file locks. |
| `GET` | `/v1/user/export` | `backend/app/api` | Exports all stored user data (telemetry, chat history, registries) as JSONL. |
| `DELETE` | `/v1/user/telemetry` | `backend/app/api` | Permanently deletes all stored data across all stores for a user ID. |
| `GET` | `/v1/tasks/next` | `dynamic_cache` | Serves the next task payload based on user difficulty staircase and filters (`inks=cvd_safe` supported). |
| `POST` | `/v1/coach/chat` | `ai_coach` | Handles user chat with Loti, running through crisis gates and safety lints. |
| `GET` | `/v1/coach/collaboration-score` | `ai_coach` | Scores longitudinal user coach interactions across collaboration markers. |
| `GET` | `/v1/dashboard/profile` | `brain_twin_jepa` | Returns 5-pillar profile, practice archetype, shadow forecast, and adaptation trail. |
| `POST` | `/v1/clustering/evaluate` | `brain_twin_jepa` | Evaluates user pillar scores against GMM practice archetypes with hysteresis. |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11 or 3.13

### Running Locally

```bash
# 1. Install all Python dependencies across all workspace modules
pip install -r requirements.txt

# 2. Start the Backend API server (http://localhost:8000) from repo root
uvicorn app.main:app --app-dir backend --reload

# 3. Start the Frontend development server (http://localhost:5173) in a second terminal
cd frontend
npm ci
npm run dev
```

*By default, the frontend runs with mock tasks (`VITE_USE_MOCKS=true`). Set `VITE_USE_MOCKS=false` in `frontend/.env` to communicate with the live backend server.*

On Windows, `scripts/run_dev.ps1` starts both servers concurrently.

### Configuration & Environment Variables

| Variable | Location | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_USE_MOCKS` | `frontend/.env` | `true` | When `true`, runs frontend completely offline; set `false` for live backend. |
| `VITE_LOTI_COACH` | `frontend/.env` | `off` | Set to `on` to enable conversational AI coach chat with Gemini. |
| `GEMINI_API_KEY` | `backend/.env` | *(empty)* | Google Gemini API key powering AI coach dialogue and variant generation. |
| `CORS_ALLOW_ORIGINS` | `backend/.env` | `http://localhost:5173` | Allowed CORS origins for the FastAPI server. |
| `TELEMETRY_DIR` | `backend/.env` | `data/raw/telemetry` | Directory storing local anonymized JSONL telemetry files. |
| `STATE_BUS_DIR` | `backend/.env` | `data/processed/state_bus` | Directory storing state bus transitions. |
| `CLUSTER_MODEL_PATH` | `backend/.env` | `models/clustering/gmm.json` | Path to fitted 9-archetype GMM model file. |
| `TWIN_CHECKPOINT` | `backend/.env` | `models/checkpoints/sat_jepa.pt` | Path to PyTorch SAT-JEPA checkpoint. |

### Running with Docker Compose

```bash
docker compose up --build
```

The backend container runs as a non-root user (`uid 10001`) with isolated Docker named volumes (`telemetry`, `task_registry`, `coach`, `llm_variants`, `state_bus`).

---

## Testing & Quality Assurance

Both frontend and backend include strict automated verification suites:

### Frontend Checks

```bash
cd frontend
npm run qa:checks
```
Runs 5 automated gates:
1. `npm run lint:tokens`: Ensures 100% design token usage (no hardcoded styles).
2. `npm run lint:copy`: Verifies UI copy passes zero-guilt, non-clinical terminology rules.
3. `npm run check:contrast`: Verifies all light & dark semantic pairs pass WCAG 2.1 AAA contrast.
4. `npm run test`: Executes the complete Vitest suite (70 test files, 1,460+ tests).
5. `npm run build`: Compiles TypeScript and builds the production bundle with Vite.

### Backend Checks

```bash
# Run all Python suites from repository root
pytest -q
```
Runs 1,650+ unit and integration tests across `tests/`, `backend/tests/`, `ai_coach/tests/`, `dynamic_cache/tests/`, `clustering_engine/tests/`, and `brain_twin_jepa/tests/`.

### Documentation Link Verification

```bash
pytest -q tests/test_docs_links.py
```
Ensures all internal Markdown links point to existing files and prevents absolute machine paths or `file:///` URLs.

### Data Retention Job

```bash
# Drops telemetry and chat records older than 30 days (GDPR Art 5(1)(e))
python -m backend.app.privacy.retention --days 30
```

---

## Generalisation Judge Tool (`?judge=1`)

For jury evaluation of the **Phase B Generalisation (25%)** criterion, the frontend includes a live dimension switcher:
- Navigate to any task with `?judge=1` in the URL (e.g. `http://localhost:5173/train?judge=1`).
- Switch dynamically between **3, 6, 7, 8, and 10 cognitive dimension models** (`FULL_DIMENSION_POOL`), demonstrating that the assessment engine and profiling architecture are completely generalizable across cognitive frameworks.

---

## Documentation

Start at [docs/README.md](docs/README.md) for architectural blueprints and project specifications:

- [docs/CISTAC_AI4Brain_SynapseTwin_Comprehensive_Report.md](docs/CISTAC_AI4Brain_SynapseTwin_Comprehensive_Report.md): Complete IEEE competition report, psychometric derivations, and jury defense strategy.
- [docs/GLOSSARY.md](docs/GLOSSARY.md): Canonical consumer vocabulary, persona guidelines, and banned clinical terms.
- [docs/adr/](docs/adr/): Architecture Decision Records (e.g. ADR 0001: two-tier telemetry, ADR 0002: no server emotion inference).
- [docs/architecture/TASKS_AND_DIMENSIONS.md](docs/architecture/TASKS_AND_DIMENSIONS.md): Detailed mathematical derivation of cognitive pillars from trial events.
- [docs/architecture/SEQUENCE_DIAGRAMS.md](docs/architecture/SEQUENCE_DIAGRAMS.md): Cross-subsystem communication flows and state bus integration.
- [docs/architecture/MEMBER2_HANDOVER.md](docs/architecture/MEMBER2_HANDOVER.md): AI Coach safety architecture, prompt templates, and evaluation.
- [docs/ui/contracts.md](docs/ui/contracts.md): Complete client-server JSON contract schemas.
- [docs/architecture/TEAM_PLAN.md](docs/architecture/TEAM_PLAN.md): Historical five-member challenge architecture.
