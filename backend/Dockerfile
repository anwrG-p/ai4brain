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

# Run as an unprivileged user; it owns only the telemetry and coach folders.
RUN useradd --system --no-create-home --uid 10001 app \
    && mkdir -p /data/telemetry /data/coach && chown app /data/telemetry /data/coach
USER app

ENV TELEMETRY_DIR=/data/telemetry
ENV COACH_DIR=/data/coach
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
