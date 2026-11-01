# SynapseTwin

SynapseTwin is a calm, privacy-first cognitive-training web platform developed for the **CISTAC 1.0 (AI4Brain)** challenge that helps users train, track, and reflect on their mental fitness without medical claims or clinical jargon. Built on validated neuropsychological paradigms (such as oMST, UFOV, Stroop, Flanker, and Stop Signal), the platform offers 11 gamified exercises that map into five core skills—Focus & Strategy, Mental Agility, Impulse Control, Deep Memory, and Visual Radar—driven by an adaptive procedural task generator that dynamically calibrates difficulty using an 85% success-rate rule. Users are guided through their training by **Loti**, an explainable, non-clinical AI axolotl coach equipped with crisis safety guardrails and transparent adaptation reasoning, alongside **Momo**, a dolphin companion who celebrates milestones and supports opt-in mood reflection. Under the hood, an in-process state bus connects performance telemetry to non-clinical practice style archetypes (GMM) and a Joint-Embedding Predictive Architecture (JEPA) digital brain twin for longitudinal session forecasting, all while upholding strict privacy principles through anonymous device identifiers, client-side scoring, full data export/deletion controls, and automated 30-day data retention.

In accordance with spec U5, **SynapseTwin is strictly for personal training and self-reflection, not a medical or diagnostic tool** ("we don't measure your brain"; no clinical claims or brain-region names are surfaced to users).

---

## Core Capabilities

- **11 Gamified Cognitive Exercises:** Grounded in established paradigms (such as oMST, UFOV, Stroop, Arrow Flanker, Stop Signal, CANTAB PAL, N-back, and Tower of London).
- **The 5 Cognitive Skills (Pillars):** Exercises feed into 5 consumer-friendly pillars: Focus & Strategy, Mental Agility, Impulse Control, Deep Memory, and Visual Radar.
- **Adaptive Task Generation & Dynamic Caching:** Pre-generated task pools, 85% rule IRT staircasing, TimedBloom deduplication, and optional Gemini LLM task variants (`dynamic_cache/`).
- **AI Companions & Guardrails:**
  - **Loti (Axolotl):** An empathetic, non-clinical coach that provides plain-language explanations of adaptive progression (`why_this`), bounded conversational choices, keyword & Gemini crisis safety guardrails, and collaboration scoring (`ai_coach/`).
  - **Momo (Dolphin):** Celebrates exercise completion and presents an opt-in, client-side mood guess that users can correct without server-side emotion inference.
- **State Bus & Practice Archetypes:** 9 non-clinical practice style archetypes fitted via Gaussian Mixture Models (GMM) with hysteresis gating to prevent oscillation (`clustering_engine/`).
- **Brain Twin JEPA:** Session feature extraction, longitudinal historical snapshots, session fatigue heatmap grids, and session forecasting in shadow mode (`brain_twin_jepa/`).
- **Privacy-First Anonymous Architecture:** Completely anonymous device IDs (spec R13); scores are calculated client-side; zero telemetry is sent without explicit user opt-in ("Save my answers"); GDPR Art 5(1)(e) automated 30-day retention, full data export, and complete deletion (`backend/app/privacy/`).
- **Accessible Design System:** Brand v2 tactile cards, design tokens (`tokens.css`), 100% WCAG 2.1 AAA contrast, screen-reader compatibility (roving tabindex, live regions), and a colorblind-safe (`cvd_safe`) display mode.

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

*For mathematical scoring details, gate thresholds, and evidence reviews, see [docs/architecture/TASKS_AND_DIMENSIONS.md](docs/architecture/TASKS_AND_DIMENSIONS.md) and the in-app "How we calculate this" page (`/methodology`).*

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
| `GET` | `/v1/tasks/next` | `dynamic_cache` | Serves the next task payload based on user difficulty staircase and filters. |
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
Ensures all internal Markdown links in `docs/` point to existing files and prevents absolute machine paths or `file:///` URLs.

### Data Retention Job

```bash
# Drops telemetry and chat records older than 30 days (GDPR Art 5(1)(e))
python -m backend.app.privacy.retention --days 30
```

---

## Documentation

Start at [docs/README.md](docs/README.md) for architectural blueprints and project specifications:

- [docs/GLOSSARY.md](docs/GLOSSARY.md): Canonical consumer vocabulary, persona guidelines, and banned clinical terms.
- [docs/adr/](docs/adr/): Architecture Decision Records (e.g. ADR 0001: two-tier telemetry, ADR 0002: no server emotion inference).
- [docs/architecture/TASKS_AND_DIMENSIONS.md](docs/architecture/TASKS_AND_DIMENSIONS.md): Detailed mathematical derivation of cognitive pillars from trial events.
- [docs/architecture/SEQUENCE_DIAGRAMS.md](docs/architecture/SEQUENCE_DIAGRAMS.md): Cross-subsystem communication flows and state bus integration.
- [docs/architecture/MEMBER2_HANDOVER.md](docs/architecture/MEMBER2_HANDOVER.md): AI Coach safety architecture, prompt templates, and evaluation.
- [docs/ui/contracts.md](docs/ui/contracts.md): Complete client-server JSON contract schemas.
- [docs/architecture/TEAM_PLAN.md](docs/architecture/TEAM_PLAN.md): Historical five-member challenge architecture.
