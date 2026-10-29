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

- **Project**: CISTAC / SynapseTwin Cognitive Architecture & BRIAN Axolotl Twin UI.
- **Frontend Stack**: Vite, React 18, TypeScript, Tailwind CSS with Doodle design token architecture.
- **Centralized Docs**: All specs and architecture documents live under `docs/` (`docs/GLOSSARY.md`, `docs/design/`, `docs/architecture/`).
- **Verification Suite**: Run `cd frontend && npm run qa:checks` (`lint:tokens`, `lint:copy`, `check:contrast`, `test`, `build`).

