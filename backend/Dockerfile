# Build from the repo root: docker build -f backend/Dockerfile .
# The app imports the module packages (ai_coach, dynamic_cache, ...) that live at the root.
FROM python:3.13-slim

WORKDIR /srv

COPY requirements.txt ./
COPY backend/requirements.txt backend/
COPY ai_coach/requirements.txt ai_coach/
COPY brain_twin_jepa/requirements.txt brain_twin_jepa/
COPY clustering_engine/requirements.txt clustering_engine/
COPY dynamic_cache/requirements.txt dynamic_cache/
RUN pip install --no-cache-dir -r requirements.txt

COPY ai_coach/ ai_coach/
COPY brain_twin_jepa/ brain_twin_jepa/
COPY clustering_engine/ clustering_engine/
COPY dynamic_cache/ dynamic_cache/
COPY backend/app/ backend/app/
# The BE-08 generator: the bootstrap below fits the served models on its synthetic users.
COPY data/synthetic/ data/synthetic/

# BE-11: fit the clustering model and train the twin at build time (about 3 minutes, synthetic users
# only), into /srv/models, read-only for the app user. The twin ships in shadow mode (validated
# false). To serve other models, mount them and set CLUSTER_MODEL_PATH / TWIN_CHECKPOINT.
RUN python -m brain_twin_jepa.bootstrap

# Run as an unprivileged user; it owns only the per-user data folders and the LLM variant folder.
RUN useradd --system --no-create-home --uid 10001 app \
    && mkdir -p /data/telemetry /data/task_registry /data/coach /data/llm_variants /data/state_bus \
    && chown app /data/telemetry /data/task_registry /data/coach /data/llm_variants /data/state_bus
USER app

ENV TELEMETRY_DIR=/data/telemetry
ENV TASK_REGISTRY_DIR=/data/task_registry
ENV COACH_DIR=/data/coach
ENV LLM_VARIANT_DIR=/data/llm_variants
ENV STATE_BUS_DIR=/data/state_bus
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
