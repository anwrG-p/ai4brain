# SynapseTwin

A calm cognitive-training web app for the CISTAC 1.0 (AI4Brain) challenge. You play short exercises, see how you did on 5 skills, and practise with **Loti**, an axolotl coach. **Momo**, a dolphin, celebrates with you and shows a mood guess you can correct. For training and self-reflection. Not a medical tool.

Users are anonymous. Scores are computed on the device, and nothing is sent until you choose "Save my answers".

## The 5 skills (pillars)

| Skill | Listed under (Train) |
|---|---|
| Focus & Strategy | Logic Web, Strategic Blueprint, Pattern Puzzle |
| Mental Agility | Memory Gauntlet, Shape Turn |
| Impulse Control | Color Clash |
| Deep Memory | Precision Archive |
| Visual Radar | Perceptual Radar |

Scores use a weighted mix of exercises per skill: see [docs/architecture/TASKS_AND_DIMENSIONS.md](docs/architecture/TASKS_AND_DIMENSIONS.md).

## Run it

```bash
# Frontend (http://localhost:5173). Mock tasks by default; VITE_USE_MOCKS=false talks to the server.
cd frontend && npm ci && npm run dev

# Server (http://localhost:8000), from the repo root
pip install -r requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

On Windows, `scripts/run_dev.ps1` starts both. Checks: `cd frontend && npm run qa:checks`, and `pytest -q` from the repo root.

## Modules

| Folder | What it is |
|---|---|
| `frontend/` | The web app (Vite, React, TypeScript). Exercises, scoring, Loti, privacy. |
| `backend/app/` | The one API server (FastAPI). Hamza's base (app, `/v1` routes, Docker, scoring library) plus our modules: telemetry ingest, privacy (export, delete, 30-day retention). |
| `ai_coach/` | Loti's server side: crisis check, health signposting, copy guardrails, coach routes. |
| `dynamic_cache/` | Task generators and solvers; the `/v1/tasks/next` dispatcher. |
| `clustering_engine/` | Non-clinical archetypes from exercise performance (GMM). |
| `brain_twin_jepa/` | The brain twin: session features and forecasts. |
| `data/` | Synthetic telemetry generator (`data/synthetic`). Real telemetry lives in `data/raw/telemetry` (git-ignored). |
| `assessment_engine/client/` | Legacy, frozen: the original standalone exercise app. Maintained code is in `frontend/src/features/assessment/`. |

Routes that are not built yet answer 501 ("not available yet"), never a made-up value.

## Docs

Start at [docs/README.md](docs/README.md): the glossary, decisions (ADRs), architecture and research. The original five-member challenge plan is in [docs/architecture/TEAM_PLAN.md](docs/architecture/TEAM_PLAN.md).
