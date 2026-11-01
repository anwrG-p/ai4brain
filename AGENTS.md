# AGENTS.md

Instructions, conventions, and configuration for autonomous AI agents working in this repository.

## Agent skills

### Issue tracker

Issues and specs for this repo live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles mapped 1:1 (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo layout with canonical consumer vocabulary in `docs/GLOSSARY.md` and architecture decision records in `docs/adr/`. See `docs/agents/domain.md`.

## Project Architecture & Engineering Notes

- **Project**: SynapseTwin (CISTAC 1.0): cognitive training with Loti (coach), Dolphin (celebrations) and Momo (mood guess); 5 skills (pillars) in the UI.
- **Frontend Stack**: Vite, React 18, TypeScript, Tailwind CSS with design tokens in `frontend/src/styles/tokens.css` (the classroom board: brand v2).
- **Centralized Docs**: All specs and architecture documents live under `docs/` (index: `docs/README.md`; vocabulary: `docs/GLOSSARY.md`; decisions: `docs/adr/`). Never link with `file:///`; `tests/test_docs_links.py` fails on it.
- **Verification Suite**: Run `cd frontend && npm run qa:checks` (`lint:tokens`, `lint:copy`, `check:contrast`, `test`, `build`).

## Backend

- **One API server**: `backend/app` (FastAPI). Run from the repo root: `uvicorn app.main:app --app-dir backend --reload` (port 8000; the Vite dev server proxies `/v1` to it). On Windows, `scripts/run_dev.ps1` starts it and the frontend.
- **One router per module**: `backend/app/main.py` mounts `app/api/routes/v1_telemetry.py`, `v1_privacy.py`, `v1_auth.py`, `dynamic_cache/api.py`, `ai_coach/api.py` and `brain_twin_jepa/api.py`. New routes go in the module, never in `main.py`.
- **Tests**: `pip install -r requirements.txt`, then `pytest -q` from the repo root runs every Python suite, `backend/tests` included.
- **Telemetry and privacy**: `backend/app/privacy/telemetry_store.py` owns the JSONL files (append, delete, export, the shared lock, id lowercasing) with no FastAPI; `v1_telemetry.py` and `v1_privacy.py` are thin wrappers. Retention: `python -m backend.app.privacy.retention --days 30` from the repo root, daily (see `scripts/README.md`).
- **Config**: `CORS_ALLOW_ORIGINS` (comma-separated, default `http://localhost:5173`), `TELEMETRY_DIR` (default `data/raw/telemetry`), `STATE_BUS_DIR` (default `data/processed/state_bus`), `CLUSTER_MODEL_PATH` (default `models/clustering/gmm.json`), `TWIN_CHECKPOINT` (default `models/checkpoints/sat_jepa.pt`; both made by `python -m brain_twin_jepa.bootstrap`). See `backend/.env.example`. In `docker-compose.yml`, telemetry lives in the named volume `telemetry` (the image runs as uid 10001), not in the host folder.
- **Payloads**: user-facing responses carry dimension ids, never brain-region names (spec U5: we don't measure your brain). The agent engine's internal state nodes stay internal.
