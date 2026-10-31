"""GET /v1/tasks/next (BE-04): the next TaskPayload for an anonymous user, from the BE-03 generators.

Mounted by backend/app/main.py. The logic is in cache_dispatcher.py; this module wires it to the
server: user ids through telemetry_store.user_key() (R13), recent accuracy from the telemetry
JSONL, Hamza's 85% rule, and the privacy delete/export hooks for the task registry.

A plain `def` route on purpose: FastAPI runs it in its thread pool, so an inline build (empty pool)
never blocks the event loop.
"""

from __future__ import annotations

import threading
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel

from app.privacy.telemetry_store import ID_PATTERN, register_user_store, telemetry_dir, user_key
from app.tools.exercise_generator import ExerciseGenerator

from .cache_dispatcher import Dispatcher, NoFreshTask, TelemetryAccuracy, schemas_for
from .generators import GenerationError

router = APIRouter()

SchemaType = Literal["n_back", "stroop", "matrix", "mental_rotation", "relational", "tower", "ufov", "mst"]
Dimension = Literal[
    "working_memory",
    "pattern_induction",
    "executive_function",
    "spatial_orientation",
    "processing_speed",
    "episodic_memory",
]


class TaskPayload(BaseModel):
    """The envelope the frontend checks (taskSource.ts validTask); params is per schema type."""

    task_id: str
    dimension: Dimension
    schema_type: SchemaType
    params: dict[str, Any]
    surface_seed: int


_dispatcher: Dispatcher | None = None
_dispatcher_lock = threading.Lock()


def make_dispatcher(**overrides: Any) -> Dispatcher:
    """The server's wiring. Tests pass overrides (registry_dir, clock, seed_source, background...)."""
    wiring: dict[str, Any] = {
        "accuracy": TelemetryAccuracy(telemetry_dir),
        "difficulty_rule": ExerciseGenerator.apply_85_percent_rule,
        # pillars: no server profile until BE-07/BE-11, so the projector has nothing and
        # START_THETA seeds each staircase. archetype: NEUTRAL until BE-09/BE-11.
    }
    return Dispatcher(**(wiring | overrides))


def get_dispatcher() -> Dispatcher:
    global _dispatcher
    with _dispatcher_lock:
        if _dispatcher is None:
            _dispatcher = make_dispatcher()
        return _dispatcher


def set_dispatcher(dispatcher: Dispatcher | None) -> Dispatcher | None:
    """Swap the served dispatcher (tests); returns the previous one."""
    global _dispatcher
    with _dispatcher_lock:
        previous, _dispatcher = _dispatcher, dispatcher
        return previous


# The registry is per-user data: the privacy delete removes it and the export includes it.
register_user_store(
    "task_registry",
    delete=lambda key: get_dispatcher().forget(key),
    export=lambda key: get_dispatcher().export(key),
)


@router.get(
    "/v1/tasks/next",
    tags=["Tasks"],
    response_class=Response,
    responses={
        200: {"model": TaskPayload, "description": "The task to play"},
        422: {"description": "bad user_id, unknown filter, or schema_type and dimension disagree"},
        503: {"description": "no task could be built just now; retry"},
    },
)
def next_task(
    user_id: Annotated[str, Query(pattern=ID_PATTERN)],
    schema_type: SchemaType | None = None,
    dimension: Dimension | None = None,
    session_id: Annotated[str | None, Query(pattern=ID_PATTERN)] = None,
    seq: Annotated[int, Query(ge=0, le=100_000)] = 0,
) -> Response:
    """The next task for this user. With session_id (and seq), the same call returns the same task."""
    if not schemas_for(schema_type, dimension):
        raise HTTPException(status_code=422, detail=f"no {schema_type} task has dimension {dimension}")
    try:
        served = get_dispatcher().next_task(
            user_key(user_id), schema_type=schema_type, dimension=dimension, session_id=session_id, seq=seq
        )
    except (NoFreshTask, GenerationError):
        raise HTTPException(status_code=503, detail="no task available, retry", headers={"Retry-After": "1"})
    return Response(served.body, media_type="application/json")
