import json
import os
import time
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

# Also the anonymous device id in the privacy routes; it is a file name, so no dots or slashes.
ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"
Id = Annotated[str, StringConstraints(pattern=ID_PATTERN)]
MetaKey = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,32}$")]
MetaValue = Annotated[str, StringConstraints(max_length=64)] | int | float | bool

Dimension = Literal[
    "working_memory",
    "pattern_induction",
    "executive_function",
    "spatial_orientation",
    "processing_speed",
    "episodic_memory",
]


class TelemetryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    user_id: Id
    session_id: Id
    # 48 so the client item_id `${task_id}:${trial_index}` always fits the 64-char meta string limit.
    task_id: Annotated[str, StringConstraints(min_length=1, max_length=48)]
    trial_index: Annotated[int, Field(ge=0)]
    dimension: Dimension
    score_norm: Annotated[float, Field(ge=0, le=1)]
    response_time_ms: Annotated[float, Field(ge=0, le=600_000)]
    error_flag: bool
    error_burst: Annotated[int, Field(ge=0)]
    hesitation_jitter: Annotated[float, Field(ge=0)]
    keystroke_latency_ms: Annotated[float, Field(ge=0)] | None = None
    trial_meta: Annotated[dict[MetaKey, MetaValue], Field(max_length=16)] = {}
    voice_opt_in: bool = False
    voice_latency_ms: Annotated[float, Field(ge=0)] | None = None
    vocal_pace_hz: Annotated[float, Field(ge=0)] | None = None
    client_ts: datetime

    @model_validator(mode="after")
    def voice_requires_opt_in(self):
        if not self.voice_opt_in and (
            self.voice_latency_ms is not None or self.vocal_pace_hz is not None
        ):
            raise ValueError("voice fields require voice_opt_in")
        return self


Batch = Annotated[list[TelemetryEvent], Field(max_length=100)]

router = APIRouter()

# routes/ -> api/ -> assessment_engine/ -> repo root, whose data/raw/* is gitignored.
REPO_ROOT = Path(__file__).resolve().parents[3]


def telemetry_dir() -> Path:
    env = os.environ.get("TELEMETRY_DIR")
    return Path(env) if env else REPO_ROOT / "data" / "raw" / "telemetry"


@contextmanager
def telemetry_lock(directory: Path) -> Iterator[None]:
    """Exclusive lock over every file in `directory`, across threads and processes.

    Ingest, delete, export and the retention job all hold it, so a rewrite never drops an append.
    """
    directory.mkdir(parents=True, exist_ok=True)
    with open(directory / ".lock", "a+b") as f:
        if os.name == "nt":
            import msvcrt

            f.seek(0)
            while True:
                try:
                    msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    time.sleep(0.01)
            try:
                yield
            finally:
                f.seek(0)
                msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)


@router.post("/v1/telemetry/event", status_code=202)
def ingest(body: TelemetryEvent | Batch) -> dict[str, int]:
    # Sync handler, so it runs in the threadpool: waiting on the lock never stalls the event loop.
    events = body if isinstance(body, list) else [body]
    out_dir = telemetry_dir()
    received_at = datetime.now(timezone.utc).isoformat()
    rows = [
        json.dumps({**e.model_dump(mode="json"), "received_at": received_at}, allow_nan=False)
        for e in events
    ]
    # ponytail: one lock for the whole directory; per-user locks only if ingest ever contends.
    with telemetry_lock(out_dir):
        for e, row in zip(events, rows):
            with open(out_dir / f"{e.user_id}.jsonl", "a", encoding="utf-8") as f:
                f.write(row + "\n")
    return {"accepted": len(events)}
