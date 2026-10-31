"""V1 stand-ins the frontend calls before each module ships its own route.

None of them computes anything yet; each says so instead of inventing values. Each moves to its
module's router (main.py mounts those first, so the module's route wins):
- GET  /v1/tasks/next                -> dynamic_cache.api (BE-04, with the BE-03 generators)
- GET  /v1/dashboard/profile         -> brain_twin_jepa.api (BE-11)
- POST /v1/clustering/evaluate       -> brain_twin_jepa.api (BE-11)

Telemetry ingest is app/api/routes/v1_telemetry.py; the user delete is v1_privacy.py.
POST /v1/coach/chat and GET /v1/coach/collaboration-score live in ai_coach.api (BE-06).
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.privacy.telemetry_store import ID_PATTERN

router = APIRouter(prefix="/v1", tags=["V1 Platform Contract"])

# The anonymous device id (R13), required everywhere: there is no default user.
UserId = Annotated[str, Query(pattern=ID_PATTERN)]
BodyUserId = Annotated[str, StringConstraints(pattern=ID_PATTERN)]


def not_yet(what: str) -> HTTPException:
    return HTTPException(status_code=501, detail=f"{what} not available yet")


@router.get("/tasks/next", status_code=501, responses={501: {}})
def get_next_task(user_id: UserId):
    """BE-04 serves the BE-03 generators here."""
    raise not_yet("task service")


@router.get("/dashboard/profile")
def get_dashboard_profile(user_id: UserId):
    """No estimates until telemetry JSONL runs through the psychometric engine (BE-11).

    The agent engine's Kalman mapping derives some dimensions from others (see the ponytail
    notes in app/tools/digital_brain_updater.py), so its numbers are not estimates to show.
    """
    return {"user_id": user_id, "status": "not_enough_data", "estimates": [], "snapshots": []}


class ClusteringRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    user_id: BodyUserId


@router.post("/clustering/evaluate", status_code=501, responses={501: {}})
def evaluate_clustering(req: ClusteringRequest):
    """The clustering engine has not landed (clustering_engine/ is empty)."""
    raise not_yet("clustering")
