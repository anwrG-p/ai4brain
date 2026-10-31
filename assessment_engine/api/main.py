import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# api/ -> assessment_engine/ -> repo root, so `uvicorn main:app` run from here imports the module packages.
REPO_ROOT = str(Path(__file__).resolve().parents[2])
if REPO_ROOT not in sys.path:
    sys.path.append(REPO_ROOT)

from ai_coach.api import router as coach_router  # noqa: E402
from brain_twin_jepa.api import router as brain_twin_router  # noqa: E402
from dynamic_cache.api import router as tasks_router  # noqa: E402
from routes.auth import router as auth_router  # noqa: E402
from routes.privacy import router as privacy_router  # noqa: E402
from routes.telemetry import router as telemetry_router  # noqa: E402

# Every module owns one router; new routes go in the module, never here.
app = FastAPI(title="assessment_engine")
for router in (
    telemetry_router,
    privacy_router,
    auth_router,
    tasks_router,
    coach_router,
    brain_twin_router,
):
    app.include_router(router)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Don't echo the input: it may hold NaN/Infinity, which can't be serialized as JSON.
    errors = [{k: v for k, v in e.items() if k != "input"} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(errors)})
