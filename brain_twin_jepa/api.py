"""Profile and clustering routes (BE-11), mounted by backend/app/main.py.

GET /v1/dashboard/profile?user_id=...&h=1
    The user's profile from their own telemetry (contract: docs/ui/contracts.md). 200 with
    `status: "not_enough_data"` below PROFILE_MIN_SESSIONS scored sessions (an unknown user
    included); otherwise `status: "ok"` with pillars, archetype (or null + archetype_reason),
    forecast in shadow mode (or null + forecast_reason), collaboration and why_this.
    h (1..6) is the forecast horizon in sessions; anything else is 422.

POST /v1/clustering/evaluate  {"user_id": "..."}
    Runs the user's profile through the state bus (GMM posteriors + the hysteresis gate) and
    returns the gated archetype. 501 without a usable clustering model; 200 not_enough_data
    before the first finished session with all five skills scored. Only a user id is accepted:
    the server clusters what it measured, never a vector a client sends.

Both: 413 when the user's telemetry is over the read limit, 503 + Retry-After when the store is
busy. Plain `def` routes: file reads run in FastAPI's thread pool, never on the event loop.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.lifecycle import on_startup
from app.privacy.telemetry_store import ID_PATTERN, LockTimeout, user_key
from brain_twin_jepa import profile, state_bus
from brain_twin_jepa.telemetry_io import EventsTooLarge

router = APIRouter(tags=["Profile"])

UserId = Annotated[str, Query(pattern=ID_PATTERN)]
BodyUserId = Annotated[str, StringConstraints(pattern=ID_PATTERN)]
Horizon = Annotated[int, Query(ge=1, le=profile.FORECAST_H_MAX, description="forecast horizon, in sessions")]


def _refresh(key: str):
    """The full state bus refresh, with the store's errors as HTTP statuses."""
    try:
        return state_bus.refresh_full(key)
    except EventsTooLarge:
        raise HTTPException(status_code=413, detail="too much telemetry stored to read at once")
    except LockTimeout:
        raise HTTPException(status_code=503, detail="store busy", headers={"Retry-After": "1"})


@router.get("/v1/dashboard/profile", responses={413: {}, 503: {}})
def dashboard_profile(user_id: UserId, h: Horizon = 1) -> dict[str, Any]:
    key = user_key(user_id)
    state, sessions, summaries = _refresh(key)
    return profile.build(key, sessions, summaries, state, h)


class EvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: BodyUserId


@router.post("/v1/clustering/evaluate", responses={413: {}, 501: {}, 503: {}})
def clustering_evaluate(req: EvaluateRequest) -> dict[str, Any]:
    model, _ = profile.cluster_model()
    if model is None:
        raise HTTPException(status_code=501, detail="no clustering model is installed")
    key = user_key(req.user_id)
    before = state_bus.load(key)
    state, _, _ = _refresh(key)
    if not state.tasks or state.model_id != model.model_id:
        return {"user_id": key, "status": "not_enough_data"}
    stepped_now = before is None or before.coach != state.coach
    archetype, _ = profile.archetype_section(state, model, None)
    return {
        "user_id": key,
        "status": "ok",
        "archetype": archetype,
        "frames": len(state.frames),
        # True only on the call whose new frame confirmed a switch (the coach gets the same flag).
        "transition_occurred": bool(stepped_now and state.coach and state.coach["transition_occurred"]),
    }


def _warm_models() -> None:
    """Load the clustering model and the twin once at startup (off the event loop), so the first
    profile request does not pay for it. A missing model is fine: the profile says so."""
    profile.cluster_model()
    profile.twin()


on_startup("brain_twin_jepa", _warm_models)
