"""GET /v1/tasks/next (BE-04): the next TaskPayload for an anonymous user, from the BE-03 generators.

Mounted by backend/app/main.py. The logic is in cache_dispatcher.py; this module wires it to the
server: user ids through telemetry_store.user_key() (R13), trials from the telemetry JSONL,
Hamza's 85% rule, the privacy delete/export hooks for the task registry, the start/stop of the
worker process, and a per-id rate limit.

A plain `def` route on purpose: FastAPI runs it in its thread pool, so an inline build (empty pool)
never blocks the event loop.
"""

from __future__ import annotations

import math
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel

from app.lifecycle import FatalStartupError, on_shutdown, on_startup
from app.privacy.retention import configured_days
from app.privacy.telemetry_store import ID_PATTERN, register_user_store, telemetry_dir, user_key
from app.tools.exercise_generator import ExerciseGenerator

from .cache_dispatcher import Dispatcher, NoFreshTask, TelemetryTrials, schemas_for
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


# --- rate limit -----------------------------------------------------------------------------------

# Per user id: 120 calls an hour, 400 a day (fixed windows). A session is ~8 tasks, so this never
# binds a real user; it stops a leaked id from burning CPU or filling its seen filter (at 400 a
# day a slice still answers a fresh probe 'seen' only ~0.7% of the time, see bloom.py).
RATE_LIMITS: tuple[tuple[int, int], ...] = ((3600, 120), (86_400, 400))
RATE_KEYS = 50_000  # ids tracked at most; the stalest go first


class RateLimiter:
    def __init__(
        self,
        limits: tuple[tuple[int, int], ...] = RATE_LIMITS,
        clock: Callable[[], float] = time.time,
        max_keys: int = RATE_KEYS,
    ) -> None:
        self.limits = limits
        self.clock = clock
        self.max_keys = max_keys
        self._lock = threading.Lock()
        self._hits: OrderedDict[str, list[list[int]]] = OrderedDict()  # key -> [[window, count] per limit]

    def hit(self, key: str) -> int | None:
        """Count one call. None when allowed; else the seconds until the caller may retry."""
        now = self.clock()
        with self._lock:
            windows = self._hits.pop(key, None) or [[-1, 0] for _ in self.limits]
            retry = 0.0
            for (span, limit), w in zip(self.limits, windows):
                current = int(now // span)
                if w[0] != current:
                    w[0], w[1] = current, 0
                if w[1] >= limit:
                    retry = max(retry, (current + 1) * span - now)
            if not retry:
                for w in windows:
                    w[1] += 1
            self._hits[key] = windows  # most recent last
            while len(self._hits) > self.max_keys:
                self._hits.popitem(last=False)
        return math.ceil(retry) if retry else None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()

# --- the dispatcher ---------------------------------------------------------------------------------

_dispatcher: Dispatcher | None = None
_dispatcher_lock = threading.Lock()


def make_dispatcher(**overrides: Any) -> Dispatcher:
    """The server's wiring. Tests pass overrides (registry_dir, clock, seed_source, background...)."""
    wiring: dict[str, Any] = {
        "trials": TelemetryTrials(telemetry_dir),
        "difficulty_rule": ExerciseGenerator.apply_85_percent_rule,
        # The one retention setting (env RETENTION_DAYS), also the retention CLI's default.
        "retention_days": configured_days(),
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


def shutdown() -> None:
    """Server shutdown: stop the worker process and write pending registries."""
    d = set_dispatcher(None)
    if d is not None:
        d.close()


def startup() -> None:
    """Server startup: a bad RETENTION_DAYS stops the boot (logged) rather than every task call
    answering 500; then the worker processes are spawned. start() does not wait for them, and
    workers that cannot start leave the server building tasks inline while it retries."""
    try:
        configured_days()
    except ValueError as e:
        raise FatalStartupError(str(e)) from None
    get_dispatcher().start()


on_startup("dynamic_cache", startup)
on_shutdown("dynamic_cache", shutdown)


# The registry is per-user data: the privacy delete removes it and the export includes it. With an
# explicit directory (a tool or test), only that directory is touched.
def _forget(key: str, directory: Path | None) -> int:
    if directory is not None:
        return Dispatcher(background=False).forget(key, directory)  # a file op, no shared state
    with _dispatcher_lock:
        d = _dispatcher
    # No dispatcher yet in this process: nothing in memory, so the file is all there is.
    return (d or make_dispatcher(background=False)).forget(key)


def _export(key: str, directory: Path | None) -> dict | None:
    if directory is not None:
        return Dispatcher(background=False).export(key, directory)
    with _dispatcher_lock:
        d = _dispatcher
    return (d or make_dispatcher(background=False)).export(key)


register_user_store("task_registry", delete=_forget, export=_export)


@router.get(
    "/v1/tasks/next",
    tags=["Tasks"],
    response_class=Response,
    responses={
        200: {"model": TaskPayload, "description": "The task to play"},
        422: {"description": "bad user_id, unknown filter, or schema_type and dimension disagree"},
        429: {"description": "too many calls for this user id; see Retry-After"},
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
    key = user_key(user_id)
    retry = limiter.hit(key)
    if retry is not None:
        raise HTTPException(status_code=429, detail="too many task requests", headers={"Retry-After": str(retry)})
    try:
        served = get_dispatcher().next_task(
            key, schema_type=schema_type, dimension=dimension, session_id=session_id, seq=seq
        )
    except (NoFreshTask, GenerationError):
        raise HTTPException(status_code=503, detail="no task available, retry", headers={"Retry-After": "1"})
    return Response(served.body, media_type="application/json")
