"""SynapseTwin API: the one FastAPI app (BE-00).

Run from the repo root: uvicorn app.main:app --app-dir backend --reload
"""

import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# app/ -> backend/ -> repo root, so the module packages (ai_coach, dynamic_cache, ...) import
# however uvicorn was started.
REPO_ROOT = str(Path(__file__).resolve().parents[2])
if REPO_ROOT not in sys.path:
    sys.path.append(REPO_ROOT)

from ai_coach.api import router as coach_module_router  # noqa: E402
from app.api.routes.brain import router as brain_router  # noqa: E402
from app.api.routes.coach import router as coach_router  # noqa: E402
from app.api.routes.session import router as session_router  # noqa: E402
from app.api.routes.telemetry import router as telemetry_router  # noqa: E402
from app.api.routes.v1_auth import router as auth_router  # noqa: E402
from app.api.routes.v1_interop import router as v1_router  # noqa: E402
from app.api.routes.v1_privacy import router as privacy_router  # noqa: E402
from app.api.routes.v1_telemetry import router as v1_telemetry_router  # noqa: E402
from brain_twin_jepa.api import router as brain_twin_router  # noqa: E402
from dynamic_cache.api import router as tasks_router  # noqa: E402

DEFAULT_CORS_ORIGINS = "http://localhost:5173"


def cors_origins() -> list[str]:
    """CORS_ALLOW_ORIGINS is a comma-separated list; the Vite dev server by default."""
    raw = os.environ.get("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(
    title="SynapseTwin API",
    description="Telemetry ingest, privacy, task delivery, coach and profile routes.",
    version="1.4.0",
)

# Users are anonymous (R13): no cookies or auth headers, so no credentials. That also keeps a
# "*" origin valid, which credentials would forbid.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every module owns one router; new routes go in the module, never here. Module routers come
# before v1_interop, so a /v1 route a module adds (BE-04, BE-06, BE-11) shadows its stand-in there.
for router in (
    v1_telemetry_router,
    privacy_router,
    auth_router,
    tasks_router,
    coach_module_router,
    brain_twin_router,
    v1_router,
):
    app.include_router(router)

# /api: the agent engine's own routes (session, DDM/IRT ingest, Kalman state, reflection).
# No product screen calls them; they served the dashboard_ui cockpit, which stays out of the product.
for router in (session_router, telemetry_router, brain_router, coach_router):
    app.include_router(router, prefix="/api")


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Don't echo the input: it may hold NaN/Infinity, which can't be serialized as JSON.
    errors = [{k: v for k, v in e.items() if k != "input"} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(errors)})


@app.get("/")
def health_check():
    """Liveness and the psychometric methods this server implements."""
    return {
        "status": "OPERATIONAL",
        "version": "1.4.0",
        "psychometrics": ["EZ-Diffusion-DDM", "3PL-IRT-MLE", "SSRT-Integration", "SignalDetection-dPrime", "RCI"],
    }
