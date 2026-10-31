# scripts

Run from any directory; paths resolve from the repo root. With missing input, each script prints a `Usage:` line and exits non-zero.

| Script | Needs |
|---|---|
| `parse_and_render_diagrams.mjs` | `frontend/node_modules` (`cd frontend && npm ci`) for Playwright, Microsoft Edge, and network for the pinned mermaid CDN build |
| `update_sequence_diagrams_md.mjs`, `build_html_viewer.mjs` | Node only |
| `download_stitch.mjs` | `STITCH_API_KEY` in the env and the Stitch `list_screens` JSON as its argument |
| `python -m backend.app.privacy.retention --days 30` (a module, not a file here) | Run from the repo root. Drops telemetry lines received more than `--days` ago (default 30) under the ingest lock and prints one JSON line of counts. Reads `TELEMETRY_DIR` like the server. Schedule it daily (cron, Task Scheduler). In Docker: `docker compose exec backend python -m backend.app.privacy.retention --days 30` |
| `run_dev.ps1` | Windows. `pip install -r requirements.txt` (uses `.venv` at the repo root when present) and `frontend/node_modules`. Starts the API server (`backend/app`, :8000) in a new window, then the frontend (:5173) |
