import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

# The anonymous device id (R13) and the session id. user_id is also a file name: no dots or slashes.
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

# Mounted by app/main.py. The frontend tracker (frontend/src/features/assessment/telemetry) posts here.
router = APIRouter()

# routes/ -> api/ -> app/ -> backend/ -> repo root, whose data/raw/* is gitignored.
REPO_ROOT = Path(__file__).resolve().parents[4]


def telemetry_dir() -> Path:
    env = os.environ.get("TELEMETRY_DIR")
    return Path(env) if env else REPO_ROOT / "data" / "raw" / "telemetry"


@router.post("/v1/telemetry/event", status_code=202)
async def ingest(body: TelemetryEvent | Batch) -> dict[str, int]:
    events = body if isinstance(body, list) else [body]
    out_dir = telemetry_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    received_at = datetime.now(timezone.utc).isoformat()
    # ponytail: sync appends inside an async handler are serialized on the event loop, so lines
    # never interleave within one uvicorn worker; Redis Streams if multiple workers.
    for e in events:
        line = json.dumps(
            {**e.model_dump(mode="json"), "received_at": received_at}, allow_nan=False
        )
        with open(out_dir / f"{e.user_id}.jsonl", "a", encoding="utf-8") as f:
            f.write(line + "\n")
    return {"accepted": len(events)}
